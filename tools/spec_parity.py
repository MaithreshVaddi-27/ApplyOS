#!/usr/bin/env python3
"""Compare the workflow specs, the Python tooling, and the engine.

Phase 2 of docs/PROJECT_BLUEPRINT.md. Three implementations of the same
workflow exist in this repository:

  - the SPEC LAYER (`.claude/`) — what a candidate actually experiences,
  - the TOOLING (`tools/rank_state.py`) — the spec's state engine,
  - the ENGINE (`applyos/`) — the clean-room TypeScript implementation.

This module parses the spec's markdown and compares it, mechanically, with the
other two. The SPEC is the reference: it is what the candidate sees.

Divergences are not all bugs. Some are deliberate (the spec's model needs a
model; the engine's is deterministic) and some are unresolved (Phase 5's
scoring decision). Each known divergence is listed in
`docs/parity-known-differences.json` with the phase that will close it.

THE RATCHET:
  - A NEW divergence fails. That is a regression.
  - A KNOWN divergence that disappears also fails, telling you to remove it
    from the manifest. The list may only ever get shorter.

Stdlib only, like every other script in tools/. Exit 0 when the only
divergences are the known ones, 1 otherwise.

Usage:
  python tools/spec_parity.py            # print the report
  python tools/spec_parity.py --quiet    # summary only
  python tools/spec_parity.py --json     # machine-readable
"""

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

RANK_SPEC = ROOT / ".claude" / "commands" / "rank.md"
EVAL_SPEC = ROOT / ".claude" / "skills" / "job-application-assistant" / "04-job-evaluation.md"
ENGINE_SCORE = ROOT / "applyos" / "packages" / "matching" / "src" / "score.ts"
ENGINE_GATES = ROOT / "applyos" / "packages" / "matching" / "src" / "gates.ts"
MANIFEST = ROOT / "docs" / "parity-known-differences.json"

STAGES = ("student", "fresher", "experienced", "remote-global")
DIMENSIONS = ("technical", "experience", "behavioral", "career")

# The spec's dimension names map to the engine's factor names only loosely:
# the engine's three factors are NOT the spec's four dimensions.
ENGINE_FACTORS = ("skill", "title", "freshness")


# ------------------------------------------------------------------ parsing

def parse_spec_weights(text: str) -> dict:
    """The stage weight table in `.claude/commands/rank.md`.

    A row looks like:
        | `student` | 30 / 15 / 15 / 40 | "rule text" |
    """
    weights = {}
    row = re.compile(
        r"^\|\s*`(?P<stage>[a-z-]+)`\s*\|\s*"
        r"(?P<w>\d+\s*/\s*\d+\s*/\s*\d+\s*/\s*\d+)\s*\|",
        re.M,
    )
    for m in row.finditer(text):
        stage = m.group("stage")
        if stage not in STAGES:
            continue
        parts = [int(x.strip()) for x in m.group("w").split("/")]
        if len(parts) != len(DIMENSIONS):
            continue
        weights[stage] = dict(zip(DIMENSIONS, (p / 100 for p in parts)))
    return weights


def parse_spec_bands(text: str) -> dict:
    """The verdict bands in `.claude/commands/rank.md`.

    The line reads: "Strong Fit 75+, Good Fit 60-74, Moderate Fit 45-59,
    Weak Fit 30-44, Poor Fit <30".
    """
    bands = {}
    for m in re.finditer(r"([A-Z][a-z]+ Fit)\s+(\d+)\s*(?:\+|-|–|<)", text):
        bands[m.group(1)] = int(m.group(2))
    for m in re.finditer(r"([A-Z][a-z]+ Fit)\s*<\s*(\d+)", text):
        bands[m.group(1)] = 0
    return bands


def parse_spec_gates(text: str) -> list:
    """The gate headings in `04-job-evaluation.md`.

    A heading like "### Notice-Period Gate (runs for `experienced`)" becomes
    "notice-period"; "### 4. Location & Logistics (Pass/Fail + Notes)"
    becomes "location".
    """
    gates = []
    for m in re.finditer(r"^#{2,4}\s+(?P<head>.+)$", text, re.M):
        head = m.group("head")
        name = None
        gate = re.search(r"\b([A-Z][a-zA-Z-]+)\s+Gate\b", head)
        if gate:
            name = gate.group(1)
        elif re.search(r"\bLocation\b.*\bLogistics\b", head):
            name = "Location"
        if not name:
            continue
        slug = name.strip().lower()
        if slug not in gates:
            gates.append(slug)
    return gates


def parse_engine_weights(text: str) -> dict:
    """`weightsFor()` in `applyos/packages/matching/src/score.ts`."""
    weights = {}
    body = re.search(r"export function weightsFor.*?\n}", text, re.S)
    if not body:
        return weights
    block = body.group(0)
    for m in re.finditer(
        r'stage\s*===\s*"([a-z-]+)"\)\s*return\s*\{([^}]*)\}', block
    ):
        stage, factors = m.group(1), m.group(2)
        pairs = re.findall(r"(\w+)\s*:\s*([\d.]+)", factors)
        weights[stage] = {k: float(v) for k, v in pairs}
    default = re.search(r"return\s*\{([^}]*)\}\s*;?\s*\n?\}", block)
    if default and "experienced" not in weights:
        pairs = re.findall(r"(\w+)\s*:\s*([\d.]+)", default.group(1))
        if pairs:
            weights["experienced"] = {k: float(v) for k, v in pairs}
            weights["remote-global"] = weights["experienced"]
    return weights


def parse_engine_bands(text: str) -> dict:
    """The verdict thresholds in the engine's `scorePosting()`."""
    bands = {}
    chain = re.search(r"const verdict\s*=\s*(.+?);", text, re.S)
    if not chain:
        return bands
    expr = chain.group(1)
    for m in re.finditer(r'score\s*>=\s*(\d+)\s*\?\s*"([a-z ]+)"', expr):
        bands[m.group(2).strip()] = int(m.group(1))
    return bands


def parse_engine_gates(text: str) -> list:
    """The gates `runGates()` actually runs."""
    body = re.search(r"export function runGates.*?\n}", text, re.S)
    if not body:
        return []
    gates = []
    for m in re.finditer(r"(\w+)Gate\(", body.group(0)):
        name = m.group(1)
        if name not in gates:
            gates.append(name)
    return gates


# ------------------------------------------------------------- normalising

def normalise_band(name: str) -> str:
    return " ".join(name.lower().split())


def python_tables():
    """The tooling's own constants — imported, not re-parsed."""
    import rank_state  # noqa: E402  (sys.path was extended above)

    weights = {
        stage: dict(values)
        for stage, values in rank_state.STAGE_WEIGHTS.items()
    }
    bands = {name: threshold for threshold, name in rank_state.BANDS}
    return weights, bands


# --------------------------------------------------------------- comparing

def compare_weights(label: str, spec: dict, other: dict) -> list:
    """Differences between two weight tables, as readable strings."""
    diffs = []
    for stage in STAGES:
        a, b = spec.get(stage), other.get(stage)
        if a is None:
            diffs.append(f"{label}: the spec has no weight row for stage '{stage}'")
            continue
        if b is None:
            diffs.append(f"{label}: no weight row for stage '{stage}'")
            continue
        if set(a) != set(b):
            diffs.append(
                f"{label}: stage '{stage}' scores {sorted(a)} but the spec scores {sorted(b)}"
            )
            continue
        for dim in a:
            if abs(a[dim] - b[dim]) > 1e-9:
                diffs.append(
                    f"{label}: stage '{stage}' weights {dim} at {a[dim]} but the spec weights it {b[dim]}"
                )
    return diffs


def compare_bands(label: str, spec: dict, other: dict) -> list:
    diffs = []
    spec_norm = {normalise_band(k): v for k, v in spec.items()}
    other_norm = {normalise_band(k): v for k, v in other.items()}
    if set(spec_norm) != set(other_norm):
        only_spec = sorted(set(spec_norm) - set(other_norm))
        only_other = sorted(set(other_norm) - set(spec_norm))
        diffs.append(
            f"{label}: band names differ — the spec has {only_spec or 'none extra'}, "
            f"the other has {only_other or 'none extra'}"
        )
    for name, threshold in spec_norm.items():
        if name in other_norm and other_norm[name] != threshold:
            diffs.append(
                f"{label}: band '{name}' starts at {other_norm[name]} but the spec starts it at {threshold}"
            )
    return diffs


# The same gate under two names. The spec calls the compensation floor the
# "Compensation Gate"; the engine calls it `ctc`. That is a naming
# difference, not a missing gate, and the comparison must not report it as
# one.
GATE_ALIASES = {
    "ctc": "compensation",
    "salary": "compensation",
    "timezone": "timezone-overlap",
    "notice": "notice-period",
    "residency": "eligibility",
    "citizenship": "eligibility",
}


def canonical_gate(name: str) -> str:
    slug = name.strip().lower()
    return GATE_ALIASES.get(slug, slug)


def compare_gates(label: str, spec: list, other: list) -> list:
    spec_set = {canonical_gate(g) for g in spec}
    other_set = {canonical_gate(g) for g in other}
    diffs = []
    missing = sorted(spec_set - other_set)
    extra = sorted(other_set - spec_set)
    if missing:
        diffs.append(f"{label}: no gate for {', '.join(missing)}")
    if extra:
        diffs.append(f"{label}: runs a {', '.join(extra)} gate the spec does not define")
    return diffs


# ------------------------------------------------------------------ report

def build_report() -> dict:
    spec_weights = parse_spec_weights(RANK_SPEC.read_text(encoding="utf-8"))
    spec_bands = parse_spec_bands(RANK_SPEC.read_text(encoding="utf-8"))
    spec_gates = parse_spec_gates(EVAL_SPEC.read_text(encoding="utf-8"))

    py_weights, py_bands = python_tables()

    engine_text = ENGINE_SCORE.read_text(encoding="utf-8")
    engine_weights = parse_engine_weights(engine_text)
    engine_bands = parse_engine_bands(engine_text)
    engine_gates = parse_engine_gates(ENGINE_GATES.read_text(encoding="utf-8"))

    agreements = []
    differences = []

    # The tooling is the spec's own state engine: it must agree exactly.
    for diff in compare_weights("tooling", spec_weights, py_weights):
        differences.append({"area": "weights", "detail": diff})
    for diff in compare_bands("tooling", spec_bands, py_bands):
        differences.append({"area": "bands", "detail": diff})
    if not compare_weights("tooling", spec_weights, py_weights) and \
       not compare_bands("tooling", spec_bands, py_bands):
        agreements.append("the Python tooling's weights and bands match the spec exactly")

    # The engine is a separate implementation: compare, but expect differences.
    for diff in compare_weights("engine", spec_weights, engine_weights):
        differences.append({"area": "weights", "detail": diff})
    for diff in compare_bands("engine", spec_bands, engine_bands):
        differences.append({"area": "bands", "detail": diff})
    for diff in compare_gates("engine", spec_gates, engine_gates):
        differences.append({"area": "gates", "detail": diff})

    return {
        "spec": {
            "weights": spec_weights,
            "bands": spec_bands,
            "gates": spec_gates,
        },
        "tooling": {
            "weights": py_weights,
            "bands": py_bands,
        },
        "engine": {
            "weights": engine_weights,
            "bands": engine_bands,
            "gates": engine_gates,
        },
        "agreements": agreements,
        "differences": differences,
    }


def known_differences() -> dict:
    if not MANIFEST.is_file():
        return {}
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def classify(report: dict, manifest: dict) -> dict:
    """Split the observed differences into known and unexpected."""
    known_entries = manifest.get("knownDifferences", [])
    known_patterns = [entry.get("pattern", "") for entry in known_entries]

    known, unexpected = [], []
    for diff in report["differences"]:
        matched = None
        for entry in known_entries:
            pattern = entry.get("pattern", "")
            if pattern and pattern in diff["detail"]:
                matched = entry
                break
        if matched:
            known.append({"detail": diff["detail"], "id": matched.get("id"),
                          "phase": matched.get("phase"), "area": diff["area"]})
        else:
            unexpected.append(diff)

    # The ratchet: a known difference that no longer occurs is a failure too,
    # because the manifest must only ever shrink.
    observed = {k["detail"] for k in known}
    resolved = []
    for entry in known_entries:
        pattern = entry.get("pattern", "")
        if pattern and not any(pattern in d["detail"] for d in report["differences"]):
            resolved.append(entry)

    return {"known": known, "unexpected": unexpected, "resolved": resolved,
            "unusedPatterns": [p for p in known_patterns if not any(p in d["detail"] for d in report["differences"])]}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quiet", action="store_true")
    parser.add_argument("--json", action="store_true", dest="as_json")
    args = parser.parse_args(argv)

    report = build_report()
    manifest = known_differences()
    split = classify(report, manifest)

    if args.as_json:
        print(json.dumps({"report": report, "known": split["known"],
                          "unexpected": split["unexpected"],
                          "resolved": split["resolved"]}, indent=2))
    elif not args.quiet:
        print("Spec (the reference):")
        for stage in STAGES:
            w = report["spec"]["weights"].get(stage)
            if w:
                print(f"  {stage:<14} " + " / ".join(f"{w[d]:.2f}" for d in DIMENSIONS))
        print(f"  bands          " + ", ".join(
            f"{k} {v}+" for k, v in sorted(report["spec"]["bands"].items(), key=lambda kv: -kv[1])))
        print(f"  gates          {', '.join(report['spec']['gates'])}")
        print()
        print(f"Engine ({len(report['engine']['gates'])} gates, {len(report['engine']['bands'])} bands):")
        for stage in STAGES:
            w = report["engine"]["weights"].get(stage)
            if w:
                print(f"  {stage:<14} " + " / ".join(f"{w[f]:.2f}" for f in ENGINE_FACTORS))
        print(f"  bands          " + ", ".join(
            f"{k} {v}+" for k, v in sorted(report["engine"]["bands"].items(), key=lambda kv: -kv[1])))
        print(f"  gates          {', '.join(report['engine']['gates'])}")
        print()
        for a in report["agreements"]:
            print(f"  AGREE  {a}")
        for k in split["known"]:
            print(f"  known  [{k.get('id')}] {k['detail']}")
        for u in split["unexpected"]:
            print(f"  NEW    {u['detail']}")
        for r in split["resolved"]:
            print(f"  FIXED  [{r.get('id')}] no longer occurs — remove it from the manifest")

    problems = len(split["unexpected"]) + len(split["resolved"])
    if problems:
        if not args.as_json and not args.quiet:
            print()
        print(f"spec_parity: FAILED — {len(split['unexpected'])} unexpected difference(s), "
              f"{len(split['resolved'])} resolved-but-still-listed")
        return 1
    print(f"spec_parity: OK ({len(split['known'])} known difference(s), none unexpected)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

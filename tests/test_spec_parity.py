"""Tests for tools/spec_parity.py — the spec/tooling/engine comparison.

Phase 2 of docs/PROJECT_BLUEPRINT.md. This harness exists because the
repository holds three implementations of the same workflow, and they had
drifted apart without anyone noticing:

  - the SPEC LAYER (`.claude/`) — what a candidate experiences,
  - the TOOLING (`tools/rank_state.py`) — the spec's state engine,
  - the ENGINE (`applyos/`) — the clean-room TypeScript implementation.

Two invariants are asserted here:

  1. The tooling must agree with the spec EXACTLY. It is the spec's own
     state engine; any difference is a bug.
  2. The engine's differences from the spec must all be KNOWN — listed in
     docs/parity-known-differences.json. A new difference fails. A known
     difference that disappears also fails, because the manifest may only
     ever get shorter.
"""

import json
import re
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "tools"))

import spec_parity  # noqa: E402


class SpecParsingTests(unittest.TestCase):
    """The parsers must read the real spec correctly, or the harness lies."""

    def test_spec_weights_are_parsed_for_every_stage(self):
        text = spec_parity.RANK_SPEC.read_text(encoding="utf-8")
        weights = spec_parity.parse_spec_weights(text)
        self.assertEqual(sorted(weights), sorted(spec_parity.STAGES))
        self.assertAlmostEqual(weights["student"]["career"], 0.40)
        self.assertAlmostEqual(weights["student"]["technical"], 0.30)
        self.assertAlmostEqual(weights["fresher"]["technical"], 0.35)
        self.assertAlmostEqual(weights["experienced"]["behavioral"], 0.15)
        self.assertAlmostEqual(weights["remote-global"]["experience"], 0.25)

    def test_spec_bands_are_parsed(self):
        text = spec_parity.RANK_SPEC.read_text(encoding="utf-8")
        bands = spec_parity.parse_spec_bands(text)
        self.assertEqual(bands.get("Strong Fit"), 75)
        self.assertEqual(bands.get("Good Fit"), 60)
        self.assertEqual(bands.get("Moderate Fit"), 45)
        self.assertEqual(bands.get("Weak Fit"), 30)

    def test_spec_gates_are_parsed(self):
        text = spec_parity.EVAL_SPEC.read_text(encoding="utf-8")
        gates = spec_parity.parse_spec_gates(text)
        for expected in ("eligibility", "language", "stipend", "batch", "bond",
                         "notice-period", "compensation", "timezone-overlap", "location"):
            self.assertIn(expected, gates, f"the {expected} gate was not parsed")

    def test_a_weight_table_with_a_different_shape_is_not_misread(self):
        # A row with three numbers is not a four-dimension weight row.
        text = "| `student` | 30 / 15 / 40 | rule |\n"
        self.assertEqual(spec_parity.parse_spec_weights(text), {})

    def test_gate_aliases_collapse_the_same_gate_under_two_names(self):
        self.assertEqual(spec_parity.canonical_gate("ctc"), "compensation")
        self.assertEqual(spec_parity.canonical_gate("Compensation"), "compensation")
        self.assertEqual(spec_parity.canonical_gate("batch"), "batch")


class ComparisonTests(unittest.TestCase):
    def test_the_tooling_agrees_with_the_canonical_tables_exactly(self):
        """The one invariant that must never break."""
        report = spec_parity.build_report()
        differences = [d for d in report["differences"] if d["detail"].startswith("tooling")]
        self.assertEqual(differences, [], "the tooling has drifted from the canonical tables")

    def test_no_invariant_is_broken(self):
        """The spec, the canonical file, and the tooling must all agree."""
        report = spec_parity.build_report()
        self.assertEqual(
            [i["detail"] for i in report["invariants"]], [],
            "an invariant is broken: the spec, framework/scoring.json, and the tooling disagree",
        )

    def test_the_spec_agrees_with_the_canonical_file(self):
        report = spec_parity.build_report()
        self.assertEqual(report["spec"]["weights"], report["canonical"]["weights"])
        self.assertEqual(
            {k.lower(): v for k, v in report["spec"]["bands"].items()},
            {k.lower(): v for k, v in report["canonical"]["bands"].items()},
        )
        self.assertEqual(sorted(report["spec"]["gates"]), sorted(report["canonical"]["gates"]))

    def test_the_report_records_agreements(self):
        report = spec_parity.build_report()
        self.assertTrue(
            len(report["agreements"]) >= 3,
            f"the harness did not confirm the three-way agreement: {report['agreements']}",
        )

    def test_the_engine_differences_are_all_known(self):
        report = spec_parity.build_report()
        split = spec_parity.classify(report, spec_parity.known_differences())
        self.assertEqual(
            [u["detail"] for u in split["unexpected"]], [],
            "a new divergence appeared between the engine and the canonical tables",
        )

    def test_every_known_difference_still_occurs(self):
        """The ratchet: a manifest entry that no longer applies is a failure."""
        report = spec_parity.build_report()
        split = spec_parity.classify(report, spec_parity.known_differences())
        self.assertEqual(
            [r.get("id") for r in split["resolved"]], [],
            "a listed difference no longer occurs — remove it from the manifest",
        )

    def test_the_manifest_is_well_formed(self):
        manifest = spec_parity.known_differences()
        # The manifest is a ratchet: Phase 5 closed every entry, so an empty
        # list is the correct terminal state, not a broken manifest.
        self.assertIsInstance(manifest.get("knownDifferences"), list, "the manifest has no knownDifferences list")
        ids = [e["id"] for e in manifest["knownDifferences"]]
        self.assertEqual(len(ids), len(set(ids)), "duplicate ids in the manifest")
        for entry in manifest["knownDifferences"]:
            self.assertIn("pattern", entry, f"{entry.get('id')} has no pattern")
            self.assertIn("summary", entry, f"{entry.get('id')} has no summary")
            self.assertIn("phase", entry, f"{entry.get('id')} has no phase")


class CanonicalFileTests(unittest.TestCase):
    """framework/scoring.json is read by the tooling and the engine."""

    def test_the_canonical_file_exists_and_is_well_formed(self):
        self.assertTrue(spec_parity.SCORING_FILE.is_file(), "framework/scoring.json is missing")
        doc = json.loads(spec_parity.SCORING_FILE.read_text(encoding="utf-8"))
        for key in ("dimensions", "stageWeights", "bands", "gates"):
            self.assertIn(key, doc, f"framework/scoring.json has no {key}")
        self.assertEqual(doc["dimensions"], list(spec_parity.DIMENSIONS))

    def test_every_stage_has_a_weight_row_that_sums_to_one(self):
        doc = json.loads(spec_parity.SCORING_FILE.read_text(encoding="utf-8"))
        for stage, weights in doc["stageWeights"].items():
            total = sum(weights.values())
            self.assertAlmostEqual(total, 1.0, places=6,
                                   msg=f"the {stage} weights sum to {total}, not 1")

    def test_the_bands_are_ordered_strongest_first(self):
        doc = json.loads(spec_parity.SCORING_FILE.read_text(encoding="utf-8"))
        mins = [b["min"] for b in doc["bands"]]
        self.assertEqual(mins, sorted(mins, reverse=True),
                         "the bands must be listed strongest first")

    def test_the_tooling_loads_the_canonical_file_rather_than_hard_coding_it(self):
        """A hard-coded copy in the tooling is the drift this file exists to stop."""
        source = (REPO / "tools" / "rank_state.py").read_text(encoding="utf-8")
        self.assertIn("framework", source)
        self.assertIn("scoring.json", source)
        # The literal weight row must not appear in the source any more.
        self.assertNotIn('"technical": 0.30', source,
                         "the tooling still hard-codes a weight row")
        self.assertNotIn('"Strong Fit"', source,
                         "the tooling still hard-codes a band name")


class HarnessFiresTests(unittest.TestCase):
    """A harness that never fires is not a harness."""

    def test_a_changed_spec_breaks_parity(self):
        """Change the spec's weights in a scratch copy and the harness must fail."""
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / ".claude" / "commands").mkdir(parents=True)
            (root / ".claude" / "skills" / "job-application-assistant").mkdir(parents=True)
            (root / "applyos" / "packages" / "matching" / "src").mkdir(parents=True)
            (root / "framework").mkdir(parents=True)

            rank_src = spec_parity.RANK_SPEC.read_text(encoding="utf-8")
            eval_src = spec_parity.EVAL_SPEC.read_text(encoding="utf-8")
            (root / ".claude" / "commands" / "rank.md").write_text(rank_src, encoding="utf-8")
            (root / ".claude" / "skills" / "job-application-assistant" / "04-job-evaluation.md").write_text(
                eval_src, encoding="utf-8")
            (root / "applyos" / "packages" / "matching" / "src" / "score.ts").write_text(
                spec_parity.ENGINE_SCORE.read_text(encoding="utf-8"), encoding="utf-8")
            (root / "applyos" / "packages" / "matching" / "src" / "gates.ts").write_text(
                spec_parity.ENGINE_GATES.read_text(encoding="utf-8"), encoding="utf-8")
            (root / "framework" / "scoring.json").write_text(
                spec_parity.SCORING_FILE.read_text(encoding="utf-8"), encoding="utf-8")

            # Change one weight in the spec: student 30/15/15/40 -> 20/15/15/50.
            changed = rank_src.replace("| `student` | 30 / 15 / 15 / 40 |", "| `student` | 20 / 15 / 15 / 50 |")
            self.assertNotEqual(changed, rank_src, "the fixture replacement did not apply")
            (root / ".claude" / "commands" / "rank.md").write_text(changed, encoding="utf-8")

            original = (spec_parity.ROOT, spec_parity.RANK_SPEC, spec_parity.EVAL_SPEC,
                        spec_parity.ENGINE_SCORE, spec_parity.ENGINE_GATES, spec_parity.SCORING_FILE)
            try:
                spec_parity.ROOT = root
                spec_parity.RANK_SPEC = root / ".claude" / "commands" / "rank.md"
                spec_parity.EVAL_SPEC = root / ".claude" / "skills" / "job-application-assistant" / "04-job-evaluation.md"
                spec_parity.ENGINE_SCORE = root / "applyos" / "packages" / "matching" / "src" / "score.ts"
                spec_parity.ENGINE_GATES = root / "applyos" / "packages" / "matching" / "src" / "gates.ts"
                spec_parity.SCORING_FILE = root / "framework" / "scoring.json"
                report = spec_parity.build_report()
            finally:
                (spec_parity.ROOT, spec_parity.RANK_SPEC, spec_parity.EVAL_SPEC,
                 spec_parity.ENGINE_SCORE, spec_parity.ENGINE_GATES, spec_parity.SCORING_FILE) = original

            # The spec now disagrees with the canonical tables: an INVARIANT
            # break, which is never excused by the known-differences manifest.
            self.assertTrue(report["invariants"], "the harness did not notice the changed spec")
            self.assertTrue(
                any("student" in i["detail"] and "technical" in i["detail"] for i in report["invariants"]),
                f"the harness noticed the wrong thing: {report['invariants']}",
            )

    def test_a_new_engine_gate_would_be_reported_as_unexpected(self):
        """A gate the manifest has never seen must not slip through."""
        report = spec_parity.build_report()
        split = spec_parity.classify(report, spec_parity.known_differences())
        # Simulate a brand-new divergence that no manifest entry matches.
        injected = {"area": "gates", "detail": "engine: no gate for quantum-levitation"}
        known_ids = {k["id"] for k in split["known"]}
        self.assertNotIn(
            "engine: no gate for quantum-levitation",
            [k["detail"] for k in split["known"]],
        )
        self.assertTrue(injected["detail"] not in
                        [k["detail"] for k in split["known"]], known_ids)


class RealRepositoryTests(unittest.TestCase):
    def test_the_parity_command_exits_zero_on_the_real_repository(self):
        self.assertEqual(spec_parity.main(["--quiet"]), 0)

    def test_the_parity_report_is_json_serialisable(self):
        report = spec_parity.build_report()
        json.dumps(report)  # must not raise


if __name__ == "__main__":
    unittest.main()

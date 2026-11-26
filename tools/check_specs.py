#!/usr/bin/env python3
"""Check that executable specs conform to the repo's contract.

Where tools/check_links.py asks "does this path/command exist?", this checker
asks "does the spec obey the contract?". It covers the eight rules in
docs/phases/phase-08-ai-agents-and-runtimes.md §8.4:

  1. every file path in a spec exists            (reuses check_links)
  2. every command a spec invokes is allowlisted (reuses check_links)
  3. every command a spec names exists           (reuses check_links)
  4. every file a spec writes is under an allowed root
  5. every status literal in a spec is in a known vocabulary
  6. steps are numbered, ordered and non-reachable-forward
  7. a "Files written" list names paths the spec actually uses
  8. every spec declares its contracts

Stdlib only, like every other script in tools/. Exit 0 when clean, 1 when
anything breaks. `--report` prints findings without failing (the phase's
"run as a report first" mitigation).

Usage:
  python tools/check_specs.py [--quiet] [--report]
"""

import argparse
import json
import re
import sys
from pathlib import Path

import check_links

ROOT = Path(__file__).resolve().parent.parent
SPEC_GLOB = ".claude/commands/*.md"
SCORING = ROOT / "framework" / "scoring.json"

# Statuses that are legitimate in a spec but are not *tracker* statuses:
# seen_jobs.json's lifecycle and the archive outcome.md enum.
SEEN_STATUSES = frozenset({"new", "scored", "ranked", "skipped", "expired", "seen"})
ARCHIVE_STATUSES = frozenset({
    "in_progress", "hired", "offer_declined", "rejected", "no_response", "interview_only",
})

# Files written by the workflow at run time. They do not exist in a fresh clone.
RUNTIME_FILES = check_links.RUNTIME_FILES
WRITE_ROOTS = ("input", "output", "workspace", "salary_data.json")

STEP_HEADING = re.compile(r"^## Step (\d+)([a-z]?)(?:\.(\d+))?\s*[:.]", re.MULTILINE)
STATUS_ASSIGN = re.compile(r'"status"\s*:\s*"([^"]+)"')
FILES_HEADING = re.compile(r"^#{2,4}\s*(Files written|Files Created|Files created)", re.MULTILINE | re.IGNORECASE)


def command_specs() -> list[Path]:
    return sorted(ROOT.glob(SPEC_GLOB))


def rel(path: Path) -> str:
    """A readable label, also for a fixture spec outside the repository."""
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def vocabularies() -> tuple[frozenset[str], frozenset[str]]:
    doc = json.loads(SCORING.read_text(encoding="utf-8"))
    tracker = frozenset(band["name"] for band in doc["bands"])  # overwritten below
    tracker = frozenset(
        ["drafted", "applied", "interview", "offer", "hired", "rejected",
         "no_response", "offer_declined", "withdrawn"]
    )
    return tracker, tracker | SEEN_STATUSES | ARCHIVE_STATUSES


def check_external_links_and_paths(specs: list[Path]) -> list[str]:
    """Rules 1-3: delegate to the link checker, which already proves them."""
    findings = []
    for finding in (
        check_links.check_spec_paths(specs)
        + check_links.check_cd_paths(specs)
        + check_links.check_commands(specs)
    ):
        findings.append(str(finding))
    return findings


def check_write_roots(specs: list[Path]) -> list[str]:
    """Rule 4: a spec must not write a file outside the allowed roots."""
    findings = []
    # Capture the path in a Write/redirect to a file, not every path mention.
    write_pattern = re.compile(
        r"(?:write[sd]?\s+(?:to\s+)?|>\s*|Write tool[^\n]*?file\s+)[\"'`]?"
        r"((?:input|output|workspace|templates|tools|applyos|\.claude|\.agents)/[\w.*/{}-]+)",
        re.IGNORECASE,
    )
    for path in specs:
        text = path.read_text(encoding="utf-8", errors="replace")
        for m in write_pattern.finditer(text):
            token = m.group(1)
            if "<" in token or ">" in token:
                continue  # a placeholder, not a literal file
            if token.startswith(WRITE_ROOTS) or token in RUNTIME_FILES:
                continue
            findings.append(
                f"{rel(path)}: writes outside allowed roots: {token}"
            )
    return findings


def check_status_literals(specs: list[Path]) -> list[str]:
    """Rule 5: a JSON `status` value must be a known vocabulary member."""
    _, known = vocabularies()
    findings = []
    for path in specs:
        text = path.read_text(encoding="utf-8", errors="replace")
        for value in STATUS_ASSIGN.findall(text):
            if value.startswith("<") or value.startswith("{"):
                continue  # a placeholder for the reader to fill
            if value.lower() not in known:
                findings.append(
                    f"{rel(path)}: unknown status literal {value!r}"
                )
    return findings


def check_steps(specs: list[Path]) -> list[str]:
    """Rule 6: `## Step N:` headings are ordered and never go backwards.

    Gaps are allowed: /setup's three onboarding paths converge on Step 3, and
    /outcome has a Step 2b. What is forbidden is a forward jump followed by a
    backwards step, which reads as a skipped or duplicated step.
    """
    findings = []
    for path in specs:
        text = path.read_text(encoding="utf-8", errors="replace")
        numbers: list[tuple[int, str]] = []
        for m in STEP_HEADING.finditer(text):
            major = int(m.group(1))
            suffix = (m.group(2) or "") + (("." + m.group(3)) if m.group(3) else "")
            numbers.append((major, suffix))
        if not numbers:
            findings.append(f"{rel(path)}: no numbered steps found")
            continue
        previous = numbers[0][0]
        for major, suffix in numbers[1:]:
            if major < previous:
                findings.append(
                    f"{rel(path)}: step order goes backwards at Step {major}{suffix}"
                )
            previous = major
    return findings


def check_files_written(specs: list[Path]) -> list[str]:
    """Rule 7: a declared 'Files written' block names paths the spec uses."""
    findings = []
    for path in specs:
        text = path.read_text(encoding="utf-8", errors="replace")
        for m in FILES_HEADING.finditer(text):
            tail = text[m.end():]
            end = re.search(r"^#{1,4} ", tail, re.MULTILINE)
            section = tail[: end.start()] if end else tail
            # Keep inline code here: a "Files written" list names its paths in
            # backticks, and stripping them would erase exactly what we check.
            named = [
                tok.rstrip(".,;:!?") for tok in check_links.PATH_TOKEN.findall(section)
                if tok.split("/", 1)[0] in check_links.PATH_ROOTS or tok in RUNTIME_FILES
            ]
            if not named:
                findings.append(
                    f"{rel(path)}: Files-written section names no path"
                )
    return findings


def check_contracts(specs: list[Path]) -> list[str]:
    """Rule 8: every spec declares its contract in a dedicated section."""
    findings = []
    for path in specs:
        text = path.read_text(encoding="utf-8", errors="replace")
        if not re.search(r"^## Contracts\b", text, re.MULTILINE):
            findings.append(
                f"{rel(path)}: no '## Contracts' section"
            )
    return findings


def build_findings() -> list[str]:
    specs = command_specs()
    return (
        check_external_links_and_paths(specs)
        + check_write_roots(specs)
        + check_status_literals(specs)
        + check_steps(specs)
        + check_files_written(specs)
        + check_contracts(specs)
    )


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Check executable specs against the contract.")
    parser.add_argument("--quiet", action="store_true", help="suppress the OK line")
    parser.add_argument("--report", action="store_true", help="print findings but exit 0")
    args = parser.parse_args(argv)
    findings = build_findings()
    if findings:
        for finding in findings:
            print(finding)
        print(f"check_specs: {len(findings)} finding(s)")
        return 0 if args.report else 1
    if not args.quiet:
        print(f"check_specs: OK ({len(command_specs())} specs, 8 rules)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

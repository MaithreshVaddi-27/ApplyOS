"""Phase 8.4 — the spec conformance checker and its eight rules."""

import subprocess
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "tools"))

import check_specs  # noqa: E402


class ConformanceTests(unittest.TestCase):
    def test_the_real_specs_are_clean(self):
        self.assertEqual([], check_specs.build_findings(), "\n".join(check_specs.build_findings()))

    def test_the_cli_is_green(self):
        result = subprocess.run(
            [sys.executable, str(REPO / "tools" / "check_specs.py"), "--quiet"],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
        )
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)

    def test_report_mode_never_fails(self):
        result = subprocess.run(
            [sys.executable, str(REPO / "tools" / "check_specs.py"), "--report"],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
        )
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)


class RuleTests(unittest.TestCase):
    """A fixture spec that breaks each rule must be caught."""

    def setUp(self):
        self.temp = __import__("tempfile").TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / ".claude" / "commands").mkdir(parents=True)
        self.spec = self.root / ".claude" / "commands" / "bad.md"

    def tearDown(self):
        self.temp.cleanup()

    def run_rule(self, fn):
        return fn([self.spec])

    def test_status_literal(self):
        self.spec.write_text('## Step 0: X\n\n```json\n{"status": "invented"}\n```\n', encoding="utf-8")
        self.assertTrue(any("unknown status" in f for f in self.run_rule(check_specs.check_status_literals)))

    def test_step_order(self):
        self.spec.write_text("## Step 3: X\n\n## Step 1: Y\n", encoding="utf-8")
        self.assertTrue(any("backwards" in f for f in self.run_rule(check_specs.check_steps)))

    def test_missing_steps(self):
        self.spec.write_text("No steps here.\n", encoding="utf-8")
        self.assertTrue(any("no numbered steps" in f for f in self.run_rule(check_specs.check_steps)))

    def test_missing_contracts(self):
        self.spec.write_text("## Step 0: X\n", encoding="utf-8")
        self.assertTrue(any("Contracts" in f for f in self.run_rule(check_specs.check_contracts)))

    def test_write_outside_allowed_roots(self):
        self.spec.write_text("Write to `templates/cv-stock/main.tex`.\n", encoding="utf-8")
        self.assertTrue(any("writes outside" in f for f in self.run_rule(check_specs.check_write_roots)))

    def test_files_written_without_a_path(self):
        self.spec.write_text("## Files written\n\nNothing here.\n", encoding="utf-8")
        self.assertTrue(any("names no path" in f for f in self.run_rule(check_specs.check_files_written)))


if __name__ == "__main__":
    unittest.main()

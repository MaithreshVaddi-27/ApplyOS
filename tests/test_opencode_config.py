"""Guards for opencode.json — the primary runtime's permission gating.

OpenCode is the reference runtime. Its pre-approved command allowlist lives in
opencode.json (mirroring .claude/settings.json for Claude Code): the portal
search CLIs plus the Python tools the workflows shell out to, and nothing
broader. A regression that widens this (e.g. a blanket shell allow) turns
into a red CI run.
"""
import json
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CONFIG = REPO / "opencode.json"


def rules():
    return json.loads(CONFIG.read_text(encoding="utf-8"))["permissions"]


class OpenCodeConfig(unittest.TestCase):
    def test_config_parses_with_schema(self):
        data = json.loads(CONFIG.read_text(encoding="utf-8"))
        self.assertIn("$schema", data)
        self.assertIn("permissions", data)

    def test_blanket_shell_is_not_allowed(self):
        for rule in rules():
            with self.subTest(rule=rule):
                if rule.get("action") == "shell" and rule.get("resource") == "*":
                    self.assertNotEqual(
                        rule.get("effect"), "allow",
                        "opencode.json must not blanket-allow shell commands",
                    )

    def test_portal_clis_are_allowed_by_one_glob(self):
        resources = [r.get("resource", "") for r in rules() if r.get("effect") == "allow"]
        self.assertTrue(
            any("bun run .agents/skills/" in r for r in resources),
            "opencode.json must allow the portal search CLIs (one glob covers "
            "current and future portals — no per-portal maintenance)",
        )

    def test_workflow_tools_are_allowed(self):
        resources = [r.get("resource", "") for r in rules() if r.get("effect") == "allow"]
        for tool in ("tools/rank_state.py", "tools/verify_pdf.py", "tools/robots_check.py", "salary_lookup.py", "pdftotext", "pdfinfo"):
            with self.subTest(tool=tool):
                self.assertTrue(
                    any(tool in r for r in resources),
                    f"opencode.json must allow {tool} (used by /rank, /apply, salary lookup)",
                )


if __name__ == "__main__":
    unittest.main()

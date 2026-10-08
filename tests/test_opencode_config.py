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
                if rule.get("action") == "shell":
                    self.assertNotEqual(
                        rule.get("resource"), "*",
                        "opencode.json must not contain a wildcard shell rule "
                        "(ask or allow) - a single-word flip turns ask into allow",
                    )
                    if rule.get("resource") == "*":
                        self.assertNotEqual(
                            rule.get("effect"), "allow",
                            "opencode.json must not blanket-allow shell commands",
                        )

    def test_portal_clis_are_allowed_explicitly(self):
        from pathlib import Path as _P
        skills_dir = REPO / ".agents" / "skills"
        shipped = sorted(
            d.name for d in skills_dir.iterdir()
            if (d / "cli" / "src" / "cli.ts").is_file()
        )
        resources = [r.get("resource", "") for r in rules() if r.get("effect") == "allow"]
        for skill in shipped:
            with self.subTest(skill=skill):
                self.assertIn(
                    f"bun run .agents/skills/{skill}/cli/src/cli.ts",
                    " ".join(resources),
                    f"opencode.json must explicitly allow {skill} "
                    "(no glob - mirrors .claude/settings.json)",
                )
        for r in resources:
            with self.subTest(resource=r):
                self.assertNotIn(
                    ".agents/skills/*", r,
                    "opencode.json must not use a portal glob - list each CLI explicitly",
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

"""Guards for the permission-allowlist <-> shipped-skills pairing (REFACTOR_PLAN U5).

Three files must agree on which portal CLIs are pre-approved:
  1. .claude/settings.json          - what Claude Code actually allows
  2. tools/security_guards.py       - the CI-reviewed mirror of (1)
  3. each portal SKILL.md           - the allowed-tools the skill declares

settings.json and ALLOWED_PERMISSIONS are already checked in lockstep by
tools/security_guards.py itself (subset direction). These tests close the
remaining gap: a shipped portal skill with no allowlist entry (so /scrape
hits a permission prompt or silently skips it), or an allowlist entry whose
CLI does not exist (dead pre-approval left behind when a skill was removed).
Both directions, derived from the filesystem - no hand-maintained list.
"""
import json
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "tools"))

from security_guards import ALLOWED_PERMISSIONS  # noqa: E402

SETTINGS = REPO / ".claude" / "settings.json"
SKILLS_DIR = REPO / ".agents" / "skills"


def shipped_portal_skills() -> dict[str, Path]:
    """Every portal skill (has a Bun CLI entry point), by name."""
    portals = {}
    for skill_dir in sorted(SKILLS_DIR.iterdir()):
        cli = skill_dir / "cli" / "src" / "cli.ts"
        if cli.is_file():
            portals[skill_dir.name] = cli
    return portals


def expected_permission(skill: str) -> str:
    return f"Bash(bun run .agents/skills/{skill}/cli/src/cli.ts:*)"


class AllowlistPairing(unittest.TestCase):
    def setUp(self):
        self.settings_allow = set(
            json.loads(SETTINGS.read_text(encoding="utf-8"))["permissions"]["allow"]
        )

    def test_every_shipped_portal_is_allowlisted_everywhere(self):
        portals = shipped_portal_skills()
        self.assertGreaterEqual(len(portals), 11, "portal discovery regressed")
        for skill in portals:
            entry = expected_permission(skill)
            with self.subTest(skill=skill):
                self.assertIn(
                    entry, self.settings_allow,
                    f"{skill} ships a CLI but settings.json has no pre-approval for it - "
                    "/scrape will prompt or skip. Add the entry AND its mirror in "
                    "tools/security_guards.py's ALLOWED_PERMISSIONS.",
                )
                self.assertIn(
                    entry, ALLOWED_PERMISSIONS,
                    f"{skill} is in settings.json but not in ALLOWED_PERMISSIONS - "
                    "the two allowlists must agree in the same change.",
                )

    def test_every_bun_run_allowlist_entry_resolves_to_a_real_cli(self):
        for entry in self.settings_allow:
            if not entry.startswith("Bash(bun run .agents/skills/"):
                continue
            with self.subTest(entry=entry):
                prefix = "Bash(bun run "
                suffix = ":*)"
                rel = entry[len(prefix):len(entry) - len(suffix)]
                self.assertTrue(
                    (REPO / rel).is_file(),
                    f"allowlist pre-approves a CLI that does not exist: {rel} - "
                    "remove the dead entry from settings.json AND ALLOWED_PERMISSIONS",
                )

    def test_every_portal_skill_declares_its_cli_in_allowed_tools(self):
        for skill in shipped_portal_skills():
            with self.subTest(skill=skill):
                text = (SKILLS_DIR / skill / "SKILL.md").read_text(encoding="utf-8")
                self.assertIn(
                    f"allowed-tools: Bash(bun run .agents/skills/{skill}/cli/src/cli.ts *",
                    text,
                    f"{skill}'s SKILL.md does not declare its own CLI in allowed-tools",
                )


if __name__ == "__main__":
    unittest.main()

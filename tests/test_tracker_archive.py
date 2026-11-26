"""Phase 7.5–7.6: one archive rule and one shared writer across the commands."""

import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
COMMANDS = REPO / ".claude" / "commands"


class SharedArchiveRule(unittest.TestCase):
    def test_the_rule_is_defined_once_in_code(self):
        src = (REPO / "applyos" / "packages" / "core" / "src" / "archive.ts").read_text(encoding="utf-8")
        self.assertIn("archiveSlug", src)
        self.assertIn("archiveDir", src)
        self.assertIn("never overwritten", src)
        readme = (REPO / "input" / "README.md").read_text(encoding="utf-8")
        self.assertIn("applyos/packages/core/src/archive.ts", readme)
        self.assertIn("copied, never moved", readme)

    def test_all_four_consumers_reference_the_rule(self):
        for name in ("apply", "outcome", "interview", "gmail-sync"):
            text = (COMMANDS / f"{name}.md").read_text(encoding="utf-8")
            self.assertTrue(
                "Subfolder naming" in text or "archiveDir" in text or "archive.ts" in text,
                f"{name} must reference the one archive rule",
            )


class SharedWriter(unittest.TestCase):
    def test_the_three_writers_go_through_the_shared_command(self):
        for name in ("apply", "outcome", "gmail-sync"):
            text = (COMMANDS / f"{name}.md").read_text(encoding="utf-8")
            self.assertIn("applyos tracker set", text, f"{name} must route its tracker write through the shared writer")

    def test_the_readers_go_through_the_shared_reader(self):
        for name in ("html-report", "notion-sync"):
            text = (COMMANDS / f"{name}.md").read_text(encoding="utf-8")
            self.assertIn("applyos tracker list", text, f"{name} must route its tracker read through the shared reader")


if __name__ == "__main__":
    unittest.main()

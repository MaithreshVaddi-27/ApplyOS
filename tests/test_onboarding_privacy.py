"""Guards for the onboarding privacy warnings (issue #345).

The onboarding flow asks a user to create their own copy of the repo and
then has /setup write personal data into tracked files. Both the README's
and SETUP.md's decision point is the clone step: the warning there must
tell the user to run their own search from a private repository before
populating anything. Either way, /setup checks the origin's visibility
BEFORE writing anything, not in its closing notes.
"""
import re
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
README = REPO / "README.md"
SETUP_GUIDE = REPO / "SETUP.md"
SETUP_COMMAND = REPO / ".claude" / "commands" / "setup.md"


def section(text: str, heading: str) -> str:
    """Body of a markdown section up to the next heading of the same level."""
    level = heading.split(" ")[0]
    pattern = re.compile(
        rf"^{re.escape(heading)}\n(.*?)(?=^{level} |\Z)", re.MULTILINE | re.DOTALL
    )
    match = pattern.search(text)
    return match.group(1) if match else ""


class TestForkWarningsAtTheDecisionPoint(unittest.TestCase):
    def assert_warns_standalone(self, body: str, where: str):
        self.assertRegex(
            body,
            re.compile(r"private\s+repositor", re.IGNORECASE),
            f"{where}'s clone section must tell the user to run their own search from a private repository",
        )
        self.assertIn(
            "personal data",
            body,
            f"{where}'s clone section must say /setup writes personal data into tracked files",
        )
        self.assertIn("tracked", body, f"{where}'s clone section must warn the data lands in tracked files")

    def test_readme_quick_start_warns_next_to_the_clone_command(self):
        body = section(README.read_text(encoding="utf-8"), "### 1. Clone")
        self.assertIn("git clone", body, "sanity: the clone command lives in this section")
        self.assert_warns_standalone(body, "README")

    def test_setup_guide_warns_next_to_the_clone_command(self):
        body = section(SETUP_GUIDE.read_text(encoding="utf-8"), "## 2. Clone")
        self.assertIn("git clone", body, "sanity: the clone command lives in this section")
        self.assert_warns_standalone(body, "SETUP.md")


class TestSetupChecksOriginBeforeWriting(unittest.TestCase):
    def test_preflight_exists_and_precedes_profile_generation(self):
        text = SETUP_COMMAND.read_text(encoding="utf-8")
        self.assertIn(
            "git remote get-url origin",
            text,
            "/setup must check where the working copy would publish to",
        )
        preflight_at = text.index("git remote get-url origin")
        writes_at = text.index("## Step 3: Generate Profile Files")
        self.assertLess(
            preflight_at,
            writes_at,
            "the origin check must run before any profile file is written - the "
            "existing Step 4 note fires after everything is already on disk",
        )
        self.assertIn(
            "public",
            text[max(0, preflight_at - 2000) : preflight_at + 2000].lower(),
            "the preflight must be about public visibility, not just remote presence",
        )


if __name__ == "__main__":
    unittest.main()

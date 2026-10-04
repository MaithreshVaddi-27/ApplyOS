"""Guards for the /setup command spec.

The command is a markdown spec (the spec IS the implementation). These tests pin
one invariant that broke silently: Step 3 must personalise every contact block
that `/apply` later compiles into a document. `cv/main_example.tex` was covered;
the LaTeX block embedded in `05-cv-templates.md`
was not, so a full Path B/C run left `[YOUR_NAME]`, `[YOUR_EMAIL]` and the phone
placeholder in it, and whether they reached a compiled CV depended on the
drafter noticing. Cover letters were removed from the framework entirely, so
`06-cover-letter-templates.md` no longer exists and nothing may reintroduce it. A real user (#420) ran `/setup` and then hand-edited both
files to close the gap.

The phone placeholder is `+91 XXXXX XXXXX`, not `[YOUR_PHONE]`: the guides embed
a LaTeX `\phone{...}` / `\namesection{...}` line, and a bare `_` there is a
subscript that aborts the compile before any PDF exists (F31 in
test_latex_guidance.py). PHONE_PLACEHOLDER keeps the instruction, the templates,
and this file from drifting apart again.
"""
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
COMMAND = REPO / ".claude" / "commands" / "setup.md"
SKILL_DIR = REPO / ".claude" / "skills" / "job-application-assistant"
CV_TEMPLATES = SKILL_DIR / "05-cv-templates.md"

# Must be underscore-free: it is substituted into a live LaTeX argument.
PHONE_PLACEHOLDER = "+91 XXXXX XXXXX"


def _sections(text: str) -> dict[str, str]:
    """Split a command spec into {heading: body} by '## ' headers."""
    parts = text.split("\n## ")
    result = {}
    for part in parts[1:]:
        heading, _, body = part.partition("\n")
        result[heading.strip()] = body
    return result


def _substeps(step_body: str) -> dict[str, str]:
    """Split a step body into {'### N. ...' heading: body}."""
    parts = step_body.split("\n### ")
    result = {}
    for part in parts[1:]:
        heading, _, body = part.partition("\n")
        result[heading.strip()] = body
    return result


class SetupStep3ContactBlocks(unittest.TestCase):
    def setUp(self):
        self.step3 = _sections(COMMAND.read_text(encoding="utf-8"))["Step 3: Generate Profile Files"]
        self.substeps = _substeps(self.step3)

    def _substep_for(self, filename: str) -> str:
        matches = [body for heading, body in self.substeps.items() if filename in heading]
        self.assertEqual(len(matches), 1, f"expected exactly one Step 3 substep for {filename}, got {len(matches)}")
        return matches[0]

    def test_cv_templates_substep_fills_the_contact_block(self):
        body = self._substep_for("05-cv-templates.md")
        self.assertIn("contact", body.lower())
        for token in ("[FIRST_NAME]", "[YOUR_EMAIL]", PHONE_PLACEHOLDER):
            self.assertIn(token, body, f"the 05 substep must name {token} as something to replace")


class TemplatesStillCarryThePlaceholders(unittest.TestCase):
    """The instructions above target real tokens; if a template renames them,
    the instruction and this test must move together."""

    def test_cv_templates_contact_block_tokens(self):
        text = CV_TEMPLATES.read_text(encoding="utf-8")
        for token in ("[FIRST_NAME]", "[LAST_NAME]", "[YOUR_EMAIL]", PHONE_PLACEHOLDER):
            self.assertIn(token, text)


class SetupPreflightStep(unittest.TestCase):
    """Step 3 must provision salary data and verify the toolchain.

    `/apply`'s salary step silently skips without salary_data.json and the
    first `/scrape` fails without bun/lualatex — the pre-flight substep is
    what makes those loud at setup time instead of mid-workflow."""

    def test_step3_has_salary_and_toolchain_preflight(self):
        step3 = _sections(COMMAND.read_text(encoding="utf-8"))["Step 3: Generate Profile Files"]
        for needle in ("salary_data.json", "salary_data.example.json", "--validate", "lualatex", "bun install"):
            self.assertIn(needle, step3, f"Step 3 pre-flight must mention {needle}")



if __name__ == "__main__":
    unittest.main()

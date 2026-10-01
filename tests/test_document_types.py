"""Guards for the two-document contract: resume AND CV, never a cover letter.

`/apply` produces one document per run and the user picks which. The two are
not the same document resized - they have different section sets, different
page budgets, and different stock templates - so the choice has to survive
edits to the specs, or the pipeline silently starts producing the wrong
artifact for a posting that asked for something specific.

Every test here reads a spec file rather than a function, because the spec IS
the implementation. Each asserts a claim an agent will act on, not a
formatting detail.
"""
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
APPLY = REPO / ".claude" / "commands" / "apply.md"
SETUP = REPO / ".claude" / "commands" / "setup.md"
ADD_TEMPLATE = REPO / ".claude" / "commands" / "add-template.md"
CV_TEMPLATES = REPO / ".claude" / "skills" / "job-application-assistant" / "05-cv-templates.md"
CI = REPO / ".github" / "workflows" / "ci.yml"

CV_TEMPLATE = REPO / "cv" / "main_example.tex"
RESUME_TEMPLATE = REPO / "cv" / "resume_example.tex"


class TestBothDocumentsExist(unittest.TestCase):
    """The stock templates are the structural reference /apply falls back to.

    A missing file here is not a test-fixture problem: `/apply` tells the
    drafter to read it, and the drafter would either stop or invent a
    structure.
    """

    def test_cv_template_ships(self):
        self.assertTrue(CV_TEMPLATE.exists(), "cv/main_example.tex is the stock CV")

    def test_resume_template_ships(self):
        self.assertTrue(
            RESUME_TEMPLATE.exists(), "cv/resume_example.tex is the stock resume"
        )

    def test_resume_is_genuinely_shorter_than_the_cv(self):
        """A resume that is not shorter is not a resume.

        The 1-page budget is enforced in CI, but that only catches a template
        that has drifted *past* the limit. This catches the opposite failure -
        someone "fixing" the resume by pasting the CV's sections back in.
        """
        self.assertLess(
            len(RESUME_TEMPLATE.read_text(encoding="utf-8")),
            len(CV_TEMPLATE.read_text(encoding="utf-8")),
            "the resume template has grown to the size of the CV - a resume is "
            "the tighter document, and its 1-page budget depends on that",
        )

    def test_resume_omits_the_cv_only_sections(self):
        text = RESUME_TEMPLATE.read_text(encoding="utf-8")
        for section in ("Publications", "Honors and Awards", "References"):
            self.assertNotIn(
                f"\\section{{{section}}}",
                text,
                f"{section} is CV-only - on a one-page resume it costs a third "
                "of the page and reads as padding",
            )


class TestApplyResolvesTheDocumentType(unittest.TestCase):
    """The resolution order must be stated, or the choice is guesswork.

    Flag beats profile, profile beats the default. If the default ever changes
    without the spec saying so, `/apply` starts answering a resume posting with
    a CV and nobody notices until a recruiter does.
    """

    def setUp(self):
        self.apply = APPLY.read_text(encoding="utf-8")

    def test_both_flags_are_documented(self):
        self.assertIn("--resume", self.apply)
        self.assertIn("--cv", self.apply)

    def test_resolution_order_is_flag_then_profile_then_default(self):
        for fragment in (
            "`--resume` or `--cv`",
            "`Document type:` line",
            "default to `cv`",
        ):
            self.assertIn(
                fragment,
                self.apply,
                f"the document-type resolution lost {fragment!r} - the order is "
                "what makes the choice deterministic",
            )

    def test_output_stems_differ_per_type(self):
        self.assertIn("`resume` → `cv/resume_<company>_<role>`", self.apply)
        self.assertIn("`cv` → `cv/main_<company>_<role>`", self.apply)

    def test_page_budgets_differ_per_type(self):
        self.assertIn(
            "`resume` → exactly 1 page, at every stage",
            self.apply,
            "the resume's 1-page budget is what distinguishes it from the CV; "
            "without it the two documents converge",
        )

    def test_the_ats_step_is_not_cv_only(self):
        """A resume goes through keyword screening just as hard as a CV."""
        self.assertNotIn(
            "### 5d. ATS & keyword verification (CV)",
            self.apply,
            "the ATS step is titled CV-only, which reads as a resume skipping it",
        )


class TestSetupRecordsThePreference(unittest.TestCase):
    def test_setup_asks_for_the_default_document_type(self):
        setup = SETUP.read_text(encoding="utf-8")
        self.assertIn("Document type:", setup)
        self.assertIn("Document type: cv", setup)
        self.assertIn("Document type: resume", setup)

    def test_setup_says_both_remain_available(self):
        """The preference is a default, not a lock - the flags must be named."""
        self.assertIn(
            "/apply --resume",
            SETUP.read_text(encoding="utf-8"),
            "recording a default without naming the override would make the "
            "other document type unreachable",
        )


class TestAddTemplateHandlesBothTypes(unittest.TestCase):
    def test_both_types_are_offered(self):
        text = ADD_TEMPLATE.read_text(encoding="utf-8")
        self.assertIn("**CV**", text)
        self.assertIn("**Resume**", text)

    def test_activation_blocks_are_per_type(self):
        """One ACTIVE-TEMPLATE block per type, keyed by the type name.

        A single unkeyed block means registering a custom CV silently hijacks
        the resume too, and the manifest's page limit then fights the resume's
        1-page rule.
        """
        text = ADD_TEMPLATE.read_text(encoding="utf-8")
        self.assertIn("ACTIVE-TEMPLATE (<CV|Resume>)", text)
        self.assertIn(
            "One** managed block per document type",
            text.replace("Exactly **one**", "One**"),
            "the per-type rule is what keeps a custom CV from hijacking the resume",
        )

    def test_output_file_depends_on_type(self):
        text = ADD_TEMPLATE.read_text(encoding="utf-8")
        self.assertIn("`cv/main_<company>_<role><source-extension>` for a CV", text)
        self.assertIn(
            "`cv/resume_<company>_<role><source-extension>` for a Resume", text
        )


class TestCiCompilesBothTemplates(unittest.TestCase):
    """A template nothing compiles is a template nobody notices is broken.

    The bare `_` in the old phone placeholder shipped for months behind a
    green suite: the CI Debian leg pinned TeX Live 2022, which tolerated it.
    Compiling both templates on both legs is the cheapest guard against that
    recurring.
    """

    def test_ci_compiles_both(self):
        ci = CI.read_text(encoding="utf-8")
        self.assertIn("main_example.tex", ci)
        self.assertIn("resume_example.tex", ci)

    def test_ci_pins_the_resume_page_count(self):
        self.assertIn("--pages 1", CI.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()

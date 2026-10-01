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
import re
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

    def test_resume_is_genuinely_tighter_than_the_cv(self):
        """A resume that is not tighter is not a resume.

        The 1-page budget is enforced in CI, but that only catches a template
        that has drifted *past* the limit. This catches the opposite failure -
        someone "fixing" the resume by pasting the CV's sections back in.

        Measured in sections, not source bytes. Byte count stopped tracking the
        intent: a resume's LaTeX is denser per rendered line than a CV's, so
        filling the one-pager out to a usable ~77% made its source *longer* than
        the CV's while the document was still 5 sections against 7 and 1 page
        against 2. The property worth protecting is the section set.
        """
        def sections(path):
            return re.findall(r"^\\section\{([^}]*)\}", path.read_text(encoding="utf-8"), re.M)

        resume, cv = sections(RESUME_TEMPLATE), sections(CV_TEMPLATE)
        self.assertLess(
            len(resume), len(cv),
            f"the resume now carries as many sections as the CV ({len(resume)}) - "
            "a resume is the tighter document, and its 1-page budget depends "
            "on that",
        )

    def test_resume_keeps_a_readable_text_block(self):
        """`geometry`'s `scale` sets the text-block WIDTH, not the type size.

        The resume was shipped at `scale=0.62` on the belief that a lower scale
        shrinks the type. It does not - the size comes from the documentclass
        font. A lower scale narrows the column, which saves vertical space only
        by making the measure cramped and hard to scan, the opposite of what a
        one-pager wants. Measured: scale 0.62 gives a 379pt text block, scale
        0.80 gives 486pt, and the document is 1 page either way - so the tighter
        setting bought nothing and cost readability.
        """
        text = RESUME_TEMPLATE.read_text(encoding="utf-8")
        self.assertRegex(
            text,
            r"\\usepackage\[scale=([\d.]+)\]\{geometry\}",
            "the resume must declare a geometry scale explicitly",
        )
        scale = float(
            re.search(r"\\usepackage\[scale=([\d.]+)\]\{geometry\}", text).group(1)
        )
        self.assertGreaterEqual(
            scale,
            0.80,
            f"resume text block is {scale} - below the CV's 0.80 the column "
            "narrows and the resume reads worse for no page-count gain",
        )

    def test_resume_carries_a_full_one_pager_section_set(self):
        """A 1-pager template that teaches an incomplete section set is a bug.

        The resume shipped with 2 roles, 2 projects and 1 education entry, which
        is 61% of the page and omits the slot students are actually screened on
        (an internship) plus Certifications entirely. Filling it out teaches the
        full structure while staying inside the hard 1-page budget.
        """
        text = RESUME_TEMPLATE.read_text(encoding="utf-8")
        for section in ("Experience", "Skills", "Projects", "Certifications", "Education"):
            self.assertIn(
                f"\\section{{{section}}}", text, f"resume lost its {section} section"
            )
        # Three experience slots, one of them shaped as an internship: for
        # students and freshers that is the strongest signal on the page.
        # Count the field that distinguishes an entry from a project, which is
        # {Company} for experience and {Stack or domain} for projects.
        self.assertEqual(
            text.count("{[Company]}"), 3,
            "resume should ship 3 experience slots (2 roles + 1 internship)",
        )
        self.assertIn("[Internship Role]", text)
        self.assertEqual(
            text.count("{[Stack or domain]}"), 3, "resume should ship 3 project slots"
        )
        self.assertEqual(text.count("{[Degree] in [Field]}"), 1, "one education entry")

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

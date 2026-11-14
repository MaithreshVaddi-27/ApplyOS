"""Tests for tools/check_links.py.

The checker is a CI gate, so it must be proven to FAIL on the bug classes it
exists to catch. Every check below injects a deliberate violation into a
fixture tree and asserts the checker finds it.

The last test runs the checker against the REAL repository: a checker that
fails on the shipped tree would be a gate nobody can keep green.
"""

import shutil
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

import check_links as cl  # noqa: E402


class FixtureTree:
    """A minimal repository-shaped tree the checker can be pointed at."""

    def __init__(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="check_links_fixture_"))
        (self.tmp / ".claude" / "commands").mkdir(parents=True)
        (self.tmp / ".claude" / "skills" / "demo").mkdir(parents=True)
        (self.tmp / ".agents" / "skills" / "demo-search" / "cli" / "src").mkdir(parents=True)
        (self.tmp / "tools").mkdir(parents=True)
        (self.tmp / "templates").mkdir(parents=True)
        (self.tmp / "docs").mkdir(parents=True)
        (self.tmp / "workspace").mkdir(parents=True)
        (self.tmp / "output" / "cv").mkdir(parents=True)
        (self.tmp / "tools" / "verify_pdf.py").write_text("# tool\n", encoding="utf-8")
        (self.tmp / "templates" / "cv-stock").mkdir(parents=True)
        (self.tmp / ".agents" / "skills" / "demo-search" / "cli" / "src" / "cli.ts").write_text("//\n", encoding="utf-8")

    def spec(self, name, body):
        path = self.tmp / ".claude" / "commands" / name
        path.write_text(body, encoding="utf-8")
        return path

    def doc(self, name, body):
        path = self.tmp / "docs" / name
        path.write_text(body, encoding="utf-8")
        return path

    def cleanup(self):
        shutil.rmtree(self.tmp, ignore_errors=True)


class CheckLinksTests(unittest.TestCase):
    def setUp(self):
        self.tree = FixtureTree()
        self.addCleanup(self.tree.cleanup)

    def findings(self):
        specs = cl.repo_files(cl.SPEC_GLOBS, self.tree.tmp)
        docs = cl.repo_files(cl.DOC_GLOBS, self.tree.tmp)
        root = self.tree.tmp
        return (
            cl.check_markdown_links(docs, root)
            + cl.check_spec_paths(specs, root)
            + cl.check_cd_paths(specs, root)
            + cl.check_commands(specs, root)
            + cl.check_mermaid(docs, root)
        )

    def kinds(self):
        return {f.kind for f in self.findings()}

    # --- the clean case -------------------------------------------------

    def test_a_clean_tree_produces_no_findings(self):
        self.tree.spec("demo.md", "## Step 0\n\nRead `templates/cv-stock`.\n\n"
                                   "```bash\ncd output/cv\npython tools/verify_pdf.py out.pdf\n```\n")
        self.tree.doc("page.md", "See [the spec](../.claude/commands/demo.md).\n")
        self.assertEqual(self.findings(), [])

    # --- broken links ---------------------------------------------------

    def test_a_broken_markdown_link_is_found(self):
        self.tree.doc("page.md", "See [the spec](../.claude/commands/nope.md).\n")
        self.assertIn("broken-link", self.kinds())

    def test_an_external_link_is_not_found(self):
        self.tree.doc("page.md", "See [the site](https://example.com/x.md).\n")
        self.assertNotIn("broken-link", self.kinds())

    # --- the D-B1 class: a path a spec names that does not exist --------

    def test_a_missing_spec_path_is_found(self):
        self.tree.spec("demo.md", "Read the file templates/cv-stock/missing.tex for details.\n")
        self.assertIn("missing-path", self.kinds())

    def test_a_missing_cd_target_is_found(self):
        # The exact audit finding D-B1: the spec still said `cd cv` after the
        # templates moved to `templates/cv-stock/`.
        self.tree.spec("demo.md", "```bash\ncd cv\nlualatex main_example.tex\n```\n")
        self.assertIn("missing-cd-path", self.kinds())

    def test_an_existing_cd_target_is_not_found(self):
        self.tree.spec("demo.md", "```bash\ncd output/cv\n```\n")
        self.assertNotIn("missing-cd-path", self.kinds())

    def test_a_relative_parent_cd_target_is_not_found(self):
        self.tree.spec("demo.md", "```bash\ncd ../../../..\n```\n")
        self.assertNotIn("missing-cd-path", self.kinds())

    def test_a_variable_cd_target_is_not_found(self):
        self.tree.spec("demo.md", '```bash\ncd "$SCRATCHPAD"\n```\n')
        self.assertNotIn("missing-cd-path", self.kinds())

    def test_a_placeholder_cd_target_is_not_found(self):
        self.tree.spec("demo.md", "```bash\ncd templates/<type>/<name>\n```\n")
        self.assertNotIn("missing-cd-path", self.kinds())

    def test_a_placeholder_path_is_not_found(self):
        # output/cv/main_<company>_<role>.tex is a template, not a literal.
        self.tree.spec("demo.md", "```bash\npython tools/verify_pdf.py output/cv/main_<company>_<role>.pdf\n```\n")
        self.assertNotIn("missing-path", self.kinds())

    def test_a_runtime_file_is_not_found(self):
        # The tracker is created by /apply at run time and is gitignored, so a
        # fresh clone legitimately does not have it.
        self.tree.spec("demo.md", "Read workspace/job_search_tracker.csv first.\n")
        self.assertNotIn("missing-path", self.kinds())

    def test_prose_that_looks_like_a_path_is_not_found(self):
        self.tree.spec("demo.md", "- Nice-to-have tools/skills you can learn\n")
        self.assertNotIn("missing-path", self.kinds())

    def test_a_glob_path_checks_its_static_prefix(self):
        self.tree.spec("demo.md", "Read every file under templates/*/ for the layout.\n")
        self.assertNotIn("missing-path", self.kinds())

    # --- referenced commands ---------------------------------------------

    def test_a_missing_skill_reference_is_found(self):
        self.tree.spec("demo.md", "```bash\nbun run .agents/skills/ghost-search/cli/src/cli.ts search\n```\n")
        self.assertIn("missing-skill", self.kinds())

    def test_an_existing_skill_reference_is_not_found(self):
        self.tree.spec("demo.md", "```bash\nbun run .agents/skills/demo-search/cli/src/cli.ts search\n```\n")
        self.assertNotIn("missing-skill", self.kinds())

    def test_a_glob_skill_reference_is_not_found(self):
        self.tree.spec("demo.md", "Bash(bun run .agents/skills/*/cli/src/cli.ts *)\n")
        self.assertNotIn("missing-skill", self.kinds())

    def test_a_missing_tool_reference_is_found(self):
        self.tree.spec("demo.md", "```bash\npython tools/ghost_tool.py\n```\n")
        self.assertIn("missing-tool", self.kinds())

    def test_an_existing_tool_reference_is_not_found(self):
        self.tree.spec("demo.md", "```bash\npython tools/verify_pdf.py out.pdf\n```\n")
        self.assertNotIn("missing-tool", self.kinds())

    # --- mermaid ----------------------------------------------------------

    def test_an_unknown_mermaid_diagram_type_is_found(self):
        self.tree.doc("page.md", "```mermaid\nnotADiagramType\n  a --> b\n```\n")
        self.assertIn("mermaid", self.kinds())

    def test_unbalanced_mermaid_brackets_are_found(self):
        self.tree.doc("page.md", "```mermaid\nflowchart TD\n  A[Label --> B\n```\n")
        self.assertIn("mermaid", self.kinds())

    def test_a_valid_mermaid_diagram_is_not_found(self):
        self.tree.doc("page.md", "```mermaid\nflowchart TD\n  A[Label] --> B[Other]\n```\n")
        self.assertNotIn("mermaid", self.kinds())


class RealRepositoryTests(unittest.TestCase):
    """The checker must be green on the repository it ships with."""

    def test_the_real_repository_is_clean(self):
        findings = (
            cl.check_markdown_links(cl.repo_files(cl.DOC_GLOBS), cl.ROOT)
            + cl.check_spec_paths(cl.repo_files(cl.SPEC_GLOBS), cl.ROOT)
            + cl.check_cd_paths(cl.repo_files(cl.SPEC_GLOBS), cl.ROOT)
            + cl.check_commands(cl.repo_files(cl.SPEC_GLOBS), cl.ROOT)
            + cl.check_mermaid(cl.repo_files(cl.DOC_GLOBS), cl.ROOT)
        )
        self.assertEqual([str(f) for f in findings], [])

    def test_the_cli_exits_zero_on_the_real_repository(self):
        self.assertEqual(cl.main(["--quiet"]), 0)


if __name__ == "__main__":
    unittest.main()

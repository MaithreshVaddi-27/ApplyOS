"""Every local image referenced by README.md must exist in the repo.

A broken header image on the repo landing page is a silent, high-visibility
failure; this guard turns it into a red CI run instead.
"""
import re
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
README = REPO / "README.md"

IMG_SRC = re.compile(r'<img[^>]+src="([^"]+)"')
MD_IMG = re.compile(r"!\[[^\]]*\]\(([^)\s]+)")


class ReadmeImageReferences(unittest.TestCase):
    def _local_refs(self):
        text = README.read_text(encoding="utf-8")
        refs = IMG_SRC.findall(text) + MD_IMG.findall(text)
        return [r for r in refs if not r.startswith(("http://", "https://"))]

    def test_readme_exists_and_references_at_least_one_local_image(self):
        refs = self._local_refs()
        self.assertGreaterEqual(len(refs), 1, "README lost its mascot header image")

    def test_all_local_image_references_resolve(self):
        for ref in self._local_refs():
            with self.subTest(ref=ref):
                self.assertTrue((REPO / ref).is_file(), f"README references missing file: {ref}")


class DistributionDocs(unittest.TestCase):
    """Phase 12: the clone-only distribution and the contribution funnel are discoverable."""

    def test_the_one_command_check_is_documented_and_exists(self):
        text = README.read_text(encoding="utf-8")
        self.assertIn("check_contribution.py", text)
        self.assertTrue((REPO / "tools" / "check_contribution.py").is_file())
        for wrapper in ("scripts/check.sh", "scripts/check.ps1"):
            self.assertTrue((REPO / wrapper).is_file(), f"missing cross-platform wrapper: {wrapper}")

    def test_the_worked_example_is_complete(self):
        base = REPO / "examples" / "example-search" / "cli"
        for path in ("package.json", "tsconfig.json", "src/cli.ts", "src/helpers.ts", "tests/contract.test.ts"):
            self.assertTrue((base / path).is_file(), f"worked example missing: {path}")
        manifest = __import__("json").loads((base / "package.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest.get("dependencies", {}), {}, "the example must be zero-dependency")

    def test_the_release_and_ecosystem_docs_exist(self):
        for rel in ("docs/RELEASING.md", "docs/research/ecosystem-map.md"):
            self.assertTrue((REPO / rel).is_file(), f"missing distribution doc: {rel}")


if __name__ == "__main__":
    unittest.main()

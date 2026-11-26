"""Phase 6.5: /apply writes the Document Manifest beside the final PDF."""

import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
APPLY_SPEC = REPO_ROOT / ".claude" / "commands" / "apply.md"


class ApplyManifestStep(unittest.TestCase):
    def setUp(self):
        self.text = APPLY_SPEC.read_text(encoding="utf-8")

    def test_the_manifest_is_written_after_the_document_is_final(self):
        self.assertIn("<DOC_STEM>.manifest.json", self.text)
        self.assertIn("after Step 4 and the compile above, never before", self.text)

    def test_the_grounding_audit_populates_the_claims(self):
        self.assertIn("ungrounded", self.text)
        self.assertIn("removed from the document before compilation", self.text)

    def test_the_manifest_is_cross_checked_against_the_compiled_pdf(self):
        self.assertIn("verify_pdf.py <DOC_STEM>.pdf --manifest <DOC_STEM>.manifest.json", self.text)
        for needle in ("extracted text", "page budget", "[YOUR_PHONE]"):
            self.assertIn(needle, self.text, f"the cross-check must cover {needle}")


if __name__ == "__main__":
    unittest.main()

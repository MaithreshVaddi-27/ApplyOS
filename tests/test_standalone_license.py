"""Guards the standalone-license invariant.

ApplyOS is a contributor-owned MIT project: no individual or upstream
party holds a copyright claim in the license text, and the original owner
cannot reassert one anywhere the project's licensing lives. Attribution of
lineage (who we derived from, by name and URL) stays — that is factual
credit, not a copyright claim — but a copyright *assertion* by the original
owner does not. A regression (e.g. re-adding an upstream copyright line to
LICENSE or NOTICE) turns into a red CI run.
"""
import re
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
LICENSE = REPO / "LICENSE"
NOTICE = REPO / "NOTICE"
README = REPO / "README.md"

CONTRIBUTORS_LINE = "Copyright (c) 2026 ApplyOS contributors"


class LicenseStandalone(unittest.TestCase):
    def test_license_has_exactly_the_contributors_grant(self):
        text = LICENSE.read_text(encoding="utf-8")
        lines = [ln.strip() for ln in text.splitlines() if "Copyright (c)" in ln]
        self.assertEqual(
            lines, [CONTRIBUTORS_LINE],
            "LICENSE must carry exactly one copyright line, the contributors' grant",
        )

    def test_license_names_no_original_owner(self):
        text = LICENSE.read_text(encoding="utf-8")
        self.assertNotIn("Mads", text, "LICENSE must not carry the original owner's name")

    def test_no_file_asserts_upstream_copyright(self):
        # Text sources only: binary font files legitimately embed their
        # foundry's license metadata and are not project copyright.
        for path in (NOTICE, README, *(REPO / "docs").glob("*.md")):
            with self.subTest(file=path.name):
                text = path.read_text(encoding="utf-8")
                for line in text.splitlines():
                    stripped = line.strip()
                    if stripped.startswith("Copyright (c)") or stripped.startswith("Copyright ©"):
                        self.assertIn(
                            "ApplyOS contributors", stripped,
                            f"{path.name} asserts a copyright outside the contributors' grant: {stripped!r}",
                        )

    def test_notice_still_records_the_lineage(self):
        text = NOTICE.read_text(encoding="utf-8")
        self.assertIn("github.com/MadsLorentzen/ai-job-search", text,
                      "NOTICE must keep the factual derivation credit")


if __name__ == "__main__":
    unittest.main()

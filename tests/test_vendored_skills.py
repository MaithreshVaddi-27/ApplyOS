"""Pins the vendored ResumeSkills set (MIT, Paramchoudhary/ResumeSkills).

Seven skills were adopted with ApplyOS adaptation headers (provenance +
grounding override + wiring). These tests pin that contract:
- every vendored skill carries provenance and a grounding rule
- .agents mirrors stay byte-identical to canonical .claude originals
- the excluded content (cover letters, invented metrics) stays excluded
- the four wired commands actually reference their skills
"""
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

VENDORED = [
    "application-form-filler",
    "job-description-analyzer",
    "interview-prep-generator",
    "offer-comparison-analyzer",
    "salary-negotiation-prep",
    "resume-tailor",
    "tech-resume-optimizer",
]

WIRED = {
    ".claude/commands/rank.md": ["job-description-analyzer/SKILL.md"],
    ".claude/commands/apply.md": [
        "resume-tailor/SKILL.md",
        "job-description-analyzer/SKILL.md",
        "tech-resume-optimizer/SKILL.md",
        "application-form-filler/SKILL.md",
    ],
    ".claude/commands/interview.md": ["interview-prep-generator/SKILL.md"],
    ".claude/commands/outcome.md": [
        "offer-comparison-analyzer/SKILL.md",
        "salary-negotiation-prep/SKILL.md",
    ],
}


class VendoredSkills(unittest.TestCase):
    def test_headers_present(self):
        for name in VENDORED:
            with self.subTest(skill=name):
                text = (REPO / ".claude" / "skills" / name / "SKILL.md").read_text(encoding="utf-8")
                self.assertIn("Paramchoudhary/ResumeSkills", text, f"{name}: provenance missing")
                self.assertIn("Wiring:", text, f"{name}: wiring line missing")

    def test_grounding_rule_present(self):
        for name in VENDORED:
            with self.subTest(skill=name):
                text = (REPO / ".claude" / "skills" / name / "SKILL.md").read_text(encoding="utf-8")
                self.assertTrue(
                    "grounding" in text.lower(),
                    f"{name}: no grounding rule — invented metrics can slip back in",
                )

    def test_mirrors_byte_identical(self):
        for name in VENDORED:
            with self.subTest(skill=name):
                canon = (REPO / ".claude" / "skills" / name / "SKILL.md").read_bytes()
                mirror = (REPO / ".agents" / "skills" / name / "SKILL.md").read_bytes()
                self.assertEqual(canon, mirror, f"{name}: mirror drifted from canonical")

    def test_excluded_content_stays_excluded(self):
        jd = (REPO / ".claude" / "skills" / "job-description-analyzer" / "SKILL.md").read_text(
            encoding="utf-8"
        )
        self.assertIn("EXCLUDED", jd)
        self.assertNotIn("8. ✅ Generate cover letter talking points", jd)
        self.assertNotIn("50+ customer interviews and usage data from 100K+ users", jd)

    def test_commands_wire_their_skills(self):
        for command, skills in WIRED.items():
            text = (REPO / command).read_text(encoding="utf-8")
            for skill in skills:
                with self.subTest(command=command, skill=skill):
                    self.assertIn(skill, text)


if __name__ == "__main__":
    unittest.main()

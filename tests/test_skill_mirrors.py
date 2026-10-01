"""Guards the .claude/skills <-> .agents/skills mirror invariant.

AGENTS.md declares `.claude/` the single source of truth, but the three core
skills are ALSO shipped under `.agents/skills/` so non-Claude runtimes
(Antigravity, Codex, ...) can discover them in the portable Agent Skills
layout. Until a build step replaces the mirrors, they must be byte-identical
on every commit - the mirrors are synchronized by hand, and hand-syncing
without a guard is exactly how the earlier Codex-side copies drifted (broken
paths, stale rebrands). This test makes drift a red CI run instead.
"""
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CLAUDE_SKILLS = REPO / ".claude" / "skills"
AGENTS_SKILLS = REPO / ".agents" / "skills"

# Every skill under .claude/skills must appear here; add a name only together
# with its mirror in the same change.
MIRRORED_SKILLS = {"job-application-assistant", "job-scraper", "upskill"}


class SkillMirrorParity(unittest.TestCase):
    def test_mirrored_trees_are_byte_identical(self):
        for name in sorted(MIRRORED_SKILLS):
            canonical = CLAUDE_SKILLS / name
            mirror = AGENTS_SKILLS / name
            self.assertTrue(canonical.is_dir(), f"{canonical} is missing")
            self.assertTrue(mirror.is_dir(), f"{mirror} is missing")
            canonical_files = sorted(p.relative_to(canonical) for p in canonical.rglob("*") if p.is_file())
            mirror_files = sorted(p.relative_to(mirror) for p in mirror.rglob("*") if p.is_file())
            self.assertEqual(
                canonical_files, mirror_files,
                f"{name}: the two mirrors contain different files - copy the missing "
                "files across or drop the stale ones in the same change",
            )
            for rel in canonical_files:
                with self.subTest(skill=name, file=str(rel)):
                    self.assertEqual(
                        (canonical / rel).read_bytes(), (mirror / rel).read_bytes(),
                        f"{name}/{rel} differs between .claude/skills and .agents/skills - "
                        "edit the .claude copy (source of truth) and mirror it exactly",
                    )

    def test_no_core_skill_ships_without_a_mirror(self):
        actual = {p.name for p in CLAUDE_SKILLS.iterdir() if p.is_dir()}
        for name in actual:
            self.assertIn(
                name, MIRRORED_SKILLS,
                f".claude/skills/{name} has no mirror under .agents/skills - "
                "non-Claude runtimes could not discover it. Mirror it and add it "
                "to MIRRORED_SKILLS, or keep it Claude-only deliberately (and "
                "document why in AGENTS.md).",
            )
        self.assertLessEqual(
            len(MIRRORED_SKILLS), len(actual),
            "MIRRORED_SKILLS lists a skill that no longer exists under .claude/skills",
        )


if __name__ == "__main__":
    unittest.main()

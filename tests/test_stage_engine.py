"""Spec guards for the stage-aware search engine (REFACTOR_PLAN U3 + D5).

The stage model is the plan's Section 2: four stages (student, fresher,
experienced, remote-global), each mapped to a portal set in
search-queries.md's Stage Profile; /scrape Step 0.5 reads the stage, asks
once when unset, honors --stage overrides, and reports non-stage portals as
`skipped (stage)`; /rank shifts its weights per stage; 04-job-evaluation.md
adds the stage-conditional gates. These tests derive the contract from the
spec files so the specs cannot silently lose the behavior.
"""
import re
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
WAYUP_SKILL = REPO / ".agents" / "skills" / "wayup-search" / "SKILL.md"
SEARCH_QUERIES = REPO / ".claude" / "skills" / "job-scraper" / "search-queries.md"
SCRAPE_SKILL = REPO / ".claude" / "skills" / "job-scraper" / "SKILL.md"
RANK_COMMAND = REPO / ".claude" / "commands" / "rank.md"
EVAL_FRAMEWORK = REPO / ".claude" / "skills" / "job-application-assistant" / "04-job-evaluation.md"
SETUP_COMMAND = REPO / ".claude" / "commands" / "setup.md"

STAGES = ("student", "fresher", "experienced", "remote-global")


class WayUpDisabledByDefault(unittest.TestCase):
    """D5: WayUp is a US-only board — near-zero yield for an India+remote
    search. It ships disabled (config state; flip one line to re-enable)."""

    def test_wayup_frontmatter_ships_enabled_false(self):
        text = WAYUP_SKILL.read_text(encoding="utf-8")
        self.assertRegex(text, r"(?m)^enabled:\s*false\b",
                         "wayup-search must ship enabled: false (D5 — US-only board)")


class StageProfile(unittest.TestCase):
    """search-queries.md's Stage Profile block names all four stages and maps
    each to its portal set (plan Section 2.1)."""

    def setUp(self):
        self.text = SEARCH_QUERIES.read_text(encoding="utf-8")

    def test_stage_profile_block_exists(self):
        self.assertIn("Stage Profile", self.text, "search-queries.md must carry a Stage Profile block")

    def test_all_four_stages_declared(self):
        for stage in STAGES:
            with self.subTest(stage=stage):
                self.assertRegex(self.text, rf"(?im)^\s*(?:#+\s*)?`?{stage}`?\s*[:：]?\s*$|{stage}",
                                 f"stage {stage} must appear in the Stage Profile")

    def test_stage_portal_mapping_covers_core_portals(self):
        # Each stage's row in the Stage → portal sets table must name its
        # primary portals from plan 2.1.
        required = {
            "student": ["internshala", "unstop"],
            "fresher": ["internshala", "naukri"],
            "experienced": ["naukri", "linkedin"],
            "remote-global": ["remoteok", "remotive"],
        }
        table = self._portal_table()
        for stage, portals in required.items():
            with self.subTest(stage=stage):
                row = self._stage_row(table, stage)
                for portal in portals:
                    self.assertIn(portal, row, f"{stage} stage must name {portal}")

    def test_planned_portal_list_matches_reality(self):
        """The inventory must not contradict itself: a portal that ships (or was
        declined) must not sit in the 'planned' line the same file carries."""
        installed_section = self._section("## Installed portal CLIs", "## Query Categories")
        planned_line = next(
            (ln for ln in installed_section.splitlines() if "planned" in ln.lower()), ""
        )
        self.assertIn("cutshort-search", installed_section,
                      "shipped portals must be listed as installed")
        for gone in ("cutshort", "cuvette", "instahyre"):
            self.assertNotIn(gone, planned_line.lower(),
                             f"{gone} must not be listed as planned (shipped or declined)")

    def _section(self, start_heading: str, end_heading: str) -> str:
        text = self.text
        start = text.index(start_heading)
        end = text.index(end_heading, start)
        return text[start:end]

    def _portal_table(self) -> str:
        start = self.text.index("Stage → portal sets")
        end = self.text.index("## Installed portal CLIs", start)
        return self.text[start:end]

    def _stage_row(self, table: str, stage: str) -> str:
        match = re.search(rf"(?m)^\|\s*`?{stage}`?\s*\|(.*)", table)
        return match.group(1) if match else ""


class ScrapeStepZeroPointFive(unittest.TestCase):
    """/scrape Step 0.5: stage selection with ask-once and --stage override."""

    def setUp(self):
        self.text = SCRAPE_SKILL.read_text(encoding="utf-8")

    def test_step_05_exists(self):
        self.assertIn("Step 0.5", self.text, "/scrape must gain the stage-selection step")

    def test_ask_once_when_unset(self):
        block = self._step_block()
        self.assertIn("ask", block.lower(), "Step 0.5 must ask the user once when the stage is unset")
        self.assertIn("save", block.lower(), "the asked-and-answered stage must be saved back to the Stage Profile")

    def test_stage_flag_override(self):
        block = self._step_block()
        self.assertIn("--stage", block, "Step 0.5 must support the --stage CLI override")

    def test_non_stage_portals_report_skipped_stage(self):
        block = self._step_block()
        self.assertIn("skipped (stage)", block,
                      "portals outside the active stage must be reported as 'skipped (stage)'")

    def test_stage_portals_must_be_installed_to_run(self):
        block = self._step_block()
        self.assertIn("not installed", block,
                      "stage portals that are planned but not yet installed must be reported, not silently dropped")

    def _step_block(self) -> str:
        start = self.text.index("Step 0.5")
        nxt = re.search(r"(?m)^### Step 1:|^## Step 1:", self.text[start:])
        end = start + nxt.start() if nxt else len(self.text)
        return self.text[start:end]


class RankStageWeights(unittest.TestCase):
    """/rank shifts its scoring weights per stage (plan Section 2.2.3)."""

    def setUp(self):
        self.text = RANK_COMMAND.read_text(encoding="utf-8")

    def test_per_stage_weight_table_present(self):
        for stage in ("student", "fresher", "remote-global"):
            with self.subTest(stage=stage):
                self.assertIn(stage, self.text, f"/rank must define {stage} weights")

    def test_exact_weight_rows(self):
        self.assertIn("30 / 15 / 15 / 40", self.text.replace("**", ""),
                      "student weights must be Technical 30 / Experience 15 / Behavioral 15 / Career 40")
        self.assertIn("35 / 20 / 15 / 30", self.text.replace("**", ""),
                      "fresher weights must be Technical 35 / Experience 20 / Behavioral 15 / Career 30")
        self.assertIn("30 / 25 / 15 / 30", self.text.replace("**", ""),
                      "experienced weights stay at the upstream default")

    def test_student_experience_dimension_scores_projects(self):
        self.assertIn("projects and coursework", self.text,
                      "student stage must instruct the scorer to read projects/coursework as experience")


class StageGates(unittest.TestCase):
    """04-job-evaluation.md gains the stage-conditional gates (plan 2.2.4)."""

    def setUp(self):
        self.text = EVAL_FRAMEWORK.read_text(encoding="utf-8")

    def test_stipend_gate(self):
        self.assertIn("Stipend Gate", self.text)

    def test_batch_gate(self):
        self.assertIn("Batch Gate", self.text)

    def test_bond_gate(self):
        self.assertIn("Bond Gate", self.text)

    def test_ctc_gate(self):
        self.assertIn("CTC Gate", self.text)

    def test_notice_period_gate_scoped_to_experienced(self):
        self.assertIn("Notice-Period Gate", self.text)
        self.assertIn("experienced", self.text)

    def test_timezone_gate_for_remote_global(self):
        self.assertIn("Timezone", self.text, "remote-global stage needs a Timezone-Overlap gate")


class SetupStageStep(unittest.TestCase):
    """/setup gains a Stage step and --section search re-asks it."""

    def setUp(self):
        self.text = SETUP_COMMAND.read_text(encoding="utf-8")

    def test_setup_asks_the_stage_question(self):
        self.assertIn("stage", self.text.lower(), "/setup must capture the candidate stage")
        for stage in STAGES:
            with self.subTest(stage=stage):
                self.assertIn(stage, self.text, f"/setup must offer the {stage} stage")

    def test_setup_writes_stage_profile_into_search_queries(self):
        self.assertIn("Stage Profile", self.text, "/setup must write the answer into the Stage Profile block")

    def test_section_search_re_asks_stage(self):
        self.assertIn("--section search", self.text, "/setup --section search must re-ask the stage")


if __name__ == "__main__":
    unittest.main()

"""Guards for the runtime adapter layer (thin-pointer parity).

The framework is runtime-agnostic: canonical workflow specs live under
`.claude/`, and per-runtime adapters (`.opencode/command/`, `.gemini/commands/`,
`.clinerules/workflows/`, `.agents/skills/source-command-*/`) are thin pointers
that reference them. The earlier Codex-side command wrappers in
`.agents/skills/source-command-*` embedded full copies and drifted within weeks
(broken paths, stale rebrands) — they are thin pointers now, and these tests
pin that invariant: every canonical spec has its adapters, every adapter
references an existing canonical path, no mirror embeds a second copy of a
workflow, and the AGENTS.md routing table covers everything — so a new command
without adapters (or an adapter pointing at a moved spec) turns into a red CI
run instead of silent drift.
"""
import re
import tomllib
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CLAUDE_COMMANDS = REPO / ".claude" / "commands"
OPENCODE_COMMANDS = REPO / ".opencode" / "command"
GEMINI_COMMANDS = REPO / ".gemini" / "commands"
CLINE_WORKFLOWS = REPO / ".clinerules" / "workflows"
AGENTS_MD = REPO / "AGENTS.md"
GEMINI_MD = REPO / "GEMINI.md"

# Skills that are first-class slash workflows but live in SKILL.md, not commands/.
SKILL_COMMANDS = {"scrape": ".claude/skills/job-scraper/SKILL.md",
                  "upskill": ".claude/skills/upskill/SKILL.md"}


def canonical_specs() -> dict[str, Path]:
    """Every user-invokable workflow: its name -> canonical spec path."""
    specs = {p.stem: p for p in CLAUDE_COMMANDS.glob("*.md")}
    for name, rel in SKILL_COMMANDS.items():
        specs[name] = REPO / rel
    return specs


def referenced_path(text: str) -> str | None:
    """The canonical spec path an adapter delegates to."""
    match = re.search(r"\.claude/(?:commands/[\w-]+\.md|skills/[\w-]+/SKILL\.md)", text)
    return match.group(0) if match else None


class AdapterParity(unittest.TestCase):
    def test_every_canonical_spec_has_adapters_for_every_runtime(self):
        for name, spec in canonical_specs().items():
            with self.subTest(command=name):
                self.assertTrue(
                    (OPENCODE_COMMANDS / f"{name}.md").is_file(),
                    f"/{name} has no .opencode/command adapter",
                )
                self.assertTrue(
                    (GEMINI_COMMANDS / f"{name}.toml").is_file(),
                    f"/{name} has no .gemini/commands adapter",
                )
                self.assertTrue(
                    (CLINE_WORKFLOWS / f"{name}.md").is_file(),
                    f"/{name} has no .clinerules/workflows adapter",
                )

    def test_no_adapter_points_at_a_missing_spec(self):
        adapters = (
            list(OPENCODE_COMMANDS.glob("*.md"))
            + list(GEMINI_COMMANDS.glob("*.toml"))
            + list(CLINE_WORKFLOWS.glob("*.md"))
        )
        self.assertGreater(len(adapters), 0, "adapter layer went missing entirely")
        for adapter in adapters:
            with self.subTest(adapter=adapter.name):
                text = adapter.read_text(encoding="utf-8")
                ref = referenced_path(text)
                self.assertIsNotNone(ref, f"{adapter} does not reference any canonical spec")
                self.assertTrue(
                    (REPO / ref).is_file(),
                    f"{adapter} references missing spec {ref} - update the adapter",
                )

    def test_markdown_adapters_are_thin_pointers(self):
        for adapter in list(OPENCODE_COMMANDS.glob("*.md")) + list(CLINE_WORKFLOWS.glob("*.md")):
            text = adapter.read_text(encoding="utf-8")
            with self.subTest(adapter=adapter.name):
                self.assertIn("$ARGUMENTS", text, f"{adapter} dropped argument passthrough")
                self.assertLess(
                    len(text),
                    1200,
                    f"{adapter} has grown beyond a thin pointer - keep workflow "
                    "content in the canonical spec, not the adapter",
                )

    def test_gemini_adapters_parse_and_pass_arguments_through(self):
        for adapter in GEMINI_COMMANDS.glob("*.toml"):
            with self.subTest(adapter=adapter.name):
                data = tomllib.loads(adapter.read_text(encoding="utf-8"))
                self.assertIn("description", data)
                self.assertIn("prompt", data)
                self.assertIn("{{args}}", data["prompt"])

    def test_agents_md_routing_table_covers_every_canonical_spec(self):
        agents_text = AGENTS_MD.read_text(encoding="utf-8")
        for name, spec in canonical_specs().items():
            with self.subTest(command=name):
                self.assertIn(
                    f"/{name}", agents_text,
                    f"AGENTS.md routing table is missing /{name}",
                )
                self.assertIn(
                    spec.relative_to(REPO).as_posix(), agents_text,
                    f"AGENTS.md routing table does not point at {spec.name} for /{name}",
                )

    def test_gemini_md_exists_and_points_at_agents_md(self):
        text = GEMINI_MD.read_text(encoding="utf-8")
        self.assertIn("AGENTS.md", text)

    def test_source_command_mirrors_are_thin_pointers(self):
        mirrors = sorted((REPO / ".agents" / "skills").glob("source-command-*/SKILL.md"))
        self.assertGreater(len(mirrors), 0, "source-command mirrors went missing entirely")
        for mirror in mirrors:
            with self.subTest(mirror=mirror.parent.name):
                text = mirror.read_text(encoding="utf-8")
                ref = referenced_path(text)
                self.assertIsNotNone(ref, f"{mirror} does not reference any canonical spec")
                self.assertTrue(
                    (REPO / ref).is_file(),
                    f"{mirror} references missing spec {ref} - update the mirror",
                )
                self.assertNotIn(
                    "## Command Template",
                    text,
                    f"{mirror} embeds a full workflow copy - keep workflow "
                    "content in the canonical spec, not the mirror",
                )
                self.assertLess(
                    len(text),
                    1200,
                    f"{mirror} has grown beyond a thin pointer - keep workflow "
                    "content in the canonical spec, not the mirror",
                )


if __name__ == "__main__":
    unittest.main()

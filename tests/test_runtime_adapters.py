"""Guards for the runtime adapter layer (thin-pointer parity).

The framework is runtime-agnostic: canonical workflow specs live under
`.claude/`, and per-runtime adapters (`.opencode/command/`,
`.agents/skills/source-command-*/`) are thin pointers that reference them.
Codex CLI, Antigravity, ZCode, and FreeBuff run through the AGENTS.md
routing table; OpenCode uses native commands; Claude Code is native.

Supported runtimes (2026-10-07): OpenCode (reference), Claude Code, Codex CLI,
Google Antigravity, ZCode, FreeBuff. The Cline (.clinerules), Cursor
(.cursor), and Gemini CLI (.gemini, GEMINI.md) adapters were removed — any
reference to them below is a regression.

These tests pin the invariant: every canonical spec has its OpenCode
adapter, every adapter references an existing canonical path, no mirror
embeds a second copy of a workflow, and the AGENTS.md routing table covers
everything — so a new command without adapters (or an adapter pointing at
a moved spec) turns into a red CI run instead of silent drift.
"""
import re
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CLAUDE_COMMANDS = REPO / ".claude" / "commands"
COMMANDS = CLAUDE_COMMANDS
OPENCODE_COMMANDS = REPO / ".opencode" / "command"
AGENTS_MD = REPO / "AGENTS.md"

# Removed adapter sets — fail loudly if any of them reappear.
REMOVED_PATHS = [
    REPO / ".clinerules",
    REPO / ".cursor",
    REPO / ".gemini",
    REPO / "GEMINI.md",
]

# Skills that are first-class slash workflows but live in SKILL.md, not commands/.
SKILL_COMMANDS = {"scrape": ".claude/skills/job-scraper/SKILL.md",
                  "upskill": ".claude/skills/upskill/SKILL.md"}

# Phase 8.3 resolved the deprecated mirrors by deleting all three (option a).
# The `gemini -p` binary they shelled out to was removed on 2026-10-07, and
# .claude/agents/ auto-loads them, so a runtime kept advertising an agent that
# failed on every invocation. The specs already have 09-web-research.md, so a
# subagent that merely runs it adds nothing. Git history is the record.
REMOVED_AGENT_MIRRORS = [
    REPO / ".claude" / "agents" / "gemini-research-expert.md",
    REPO / ".opencode" / "agent" / "gemini-research-expert.md",
    REPO / ".codex" / "agents" / "gemini-research-expert.toml",
]


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


class InvocationContract(unittest.TestCase):
    """Phase 8.1/8.7: one invocation shape, reachable from every runtime."""

    def test_public_api_documents_the_invocation_contract(self):
        text = (REPO / "docs" / "design" / "public-api.md").read_text(encoding="utf-8")
        self.assertIn("applyos <command> [flags] --format json", text)
        self.assertIn("One command, one flag vocabulary", text)
        self.assertIn("The JSON output is the contract", text)
        self.assertIn("No runtime-specific behaviour", text)

    def test_agents_md_points_at_the_contract(self):
        text = AGENTS_MD.read_text(encoding="utf-8")
        self.assertIn("applyos <command> [flags] --format json", text)
        self.assertIn("docs/design/public-api.md", text)

    def test_every_engine_command_in_the_contract_exists(self):
        # The six deterministic commands named in AGENTS.md must be dispatch
        # branches in cli.ts, not just prose in a doc.
        cli = (REPO / "applyos" / "apps" / "cli" / "src" / "cli.ts").read_text(encoding="utf-8")
        for command in ("scrape", "rank", "apply", "tracker", "doctor", "contract"):
            self.assertIn(f'cmd === "{command}"', cli, f"{command} is not dispatchable")

    def test_mcp_dependencies_are_capabilities_with_a_degraded_mode(self):
        gmail = (COMMANDS / "gmail-sync.md").read_text(encoding="utf-8")
        notion = (COMMANDS / "notion-sync.md").read_text(encoding="utf-8")
        for capability in ("gmail.search", "gmail.thread"):
            self.assertIn(capability, gmail, f"gmail-sync must declare {capability}")
        for capability in ("notion.database", "notion.page"):
            self.assertIn(capability, notion, f"notion-sync must declare {capability}")
        self.assertIn("degraded mode", gmail)
        self.assertIn("applyos tracker set", gmail)
        self.assertIn("another runtime", notion)
        self.assertNotIn(
            "connect the Gmail integration (claude.ai Settings",
            gmail,
            "gmail-sync must not hard-require one vendor's connector",
        )

    def test_agent_facing_surface_is_documented(self):
        doc = REPO / "docs" / "developer" / "agent-facing.md"
        self.assertTrue(doc.is_file())
        text = doc.read_text(encoding="utf-8")
        lowered = text.lower()
        for token in ("invocation contract", "approval", "untrusted content", "capability bindings"):
            self.assertIn(token, lowered)


class AdapterParity(unittest.TestCase):
    def test_deprecated_agent_mirrors_stay_removed(self):
        # Phase 8.3 chose option (a): delete all three. A marked-but-present
        # mirror is auto-loaded by Claude Code and shown in the agent picker
        # even though every invocation fails. Git history is the record.
        for path in REMOVED_AGENT_MIRRORS:
            with self.subTest(mirror=path.relative_to(REPO).as_posix()):
                self.assertFalse(
                    path.exists(),
                    f"{path.relative_to(REPO).as_posix()} was removed — do not re-add a broken agent",
                )

    def test_removed_adapters_stay_removed(self):
        for path in REMOVED_PATHS:
            with self.subTest(path=path.name):
                self.assertFalse(
                    path.exists(),
                    f"{path} was removed (Cline/Cursor/Gemini CLI unsupported) - do not re-add",
                )

    def test_every_canonical_spec_has_an_opencode_adapter(self):
        for name, spec in canonical_specs().items():
            with self.subTest(command=name):
                self.assertTrue(
                    (OPENCODE_COMMANDS / f"{name}.md").is_file(),
                    f"/{name} has no .opencode/command adapter",
                )

    def test_no_adapter_points_at_a_missing_spec(self):
        adapters = list(OPENCODE_COMMANDS.glob("*.md"))
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
        for adapter in OPENCODE_COMMANDS.glob("*.md"):
            text = adapter.read_text(encoding="utf-8")
            with self.subTest(adapter=adapter.name):
                self.assertIn("$ARGUMENTS", text, f"{adapter} dropped argument passthrough")
                self.assertLess(
                    len(text),
                    1200,
                    f"{adapter} has grown beyond a thin pointer - keep workflow "
                    "content in the canonical spec, not the adapter",
                )

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

    def test_agents_md_lists_no_removed_runtime(self):
        agents_text = AGENTS_MD.read_text(encoding="utf-8")
        for dead in ("Gemini CLI", ".gemini", ".clinerules", "Cline", "Cursor", "GEMINI.md"):
            with self.subTest(token=dead):
                self.assertNotIn(
                    dead, agents_text,
                    f"AGENTS.md still references removed runtime/adapter {dead}",
                )

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

# Gemini CLI Context

This repository is an agent-driven job-search framework whose universal entry point is
[AGENTS.md](AGENTS.md) — read it first. It contains the runtime loading map, the slash-command
routing table (which canonical spec file each command maps to), and the safety rules that apply
to every runtime.

Project-specific slash commands are provided as TOML adapters in `.gemini/commands/*.toml`;
each one delegates to the canonical workflow spec under `.claude/commands/` or
`.claude/skills/`. The portal search CLIs under `.agents/skills/` run directly with
`bun run <skill>/cli/src/cli.ts search|detail` — see AGENTS.md for the contract.

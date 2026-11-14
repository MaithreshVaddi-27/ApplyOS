# ADR-0002: Runtime adapters are thin pointers, never copies

**Date**: 2026-07
**Status**: accepted
**Deciders**: ApplyOS maintainers

## Context

ADR-0001 puts the implementation in `.claude/`. Every other runtime still needs to reach it.
OpenCode has native slash commands (`.opencode/command/*.md`); Claude Code loads
`.claude/` natively; Codex CLI, Antigravity, ZCode, and FreeBuff have no native command system
and use the routing table in `AGENTS.md`.

The failure mode is obvious once you have seen it: an adapter that *copies* the workflow text
instead of pointing at it. The copy drifts the moment either side changes, and from then on two
runtimes quietly do different things.

This repo has lived that failure: earlier Codex wrappers embedded their own workflow content.

## Decision

Adapters contain **routing only**. Every adapter either (a) points at a canonical spec by path,
or (b) is a command index. No adapter contains workflow steps, gate definitions, weight tables,
file lists, or contract text.

## Alternatives Considered

### Alternative 1: Embedded copies per runtime
- **Pros**: Each runtime reads only what it needs; no file-path indirection.
- **Cons**: Drift is guaranteed and invisible. Already tried and rejected once.
- **Why not**: The drift cost is unbounded and the maintenance cost is O(runtimes × features).

### Alternative 2: A build step that generates adapters from the specs
- **Pros**: No hand-written adapters; generation is mechanical.
- **Cons**: Adds a build artifact and a dependency to a project whose selling point is that it
  needs none. Also does not solve the Codex-class runtimes, which still need prose.
- **Why not**: It trades a solved problem (pointers work fine) for a new one (a build step).

### Alternative 3: One spec dialect with per-runtime extensions
- **Pros**: A single file could carry runtime-specific blocks.
- **Cons**: Runtime-specific syntax inside a shared file makes the canonical file harder to read
  and couples it to every runtime.
- **Why not**: Pointers are simpler and the indirection cost is one file read.

## Consequences

### Positive
- One place to change a workflow. The routing table and the adapter are the only other files
  touched, and both are covered by tests.
- The canonical spec is runtime-agnostic by construction.
- Adding a runtime is a small, mechanical change.

### Negative
- A runtime that cannot read arbitrary paths (none today) would need a different adapter.
- An adapter is one indirection away from the spec, so a broken pointer is a broken command.
  Mitigation: `tests/test_runtime_adapters.py` asserts that every adapter references an
  existing spec.

### Risks
- **A new adapter is added that copies content.** Mitigation: the parity test asserts adapters
  are thin, and the review rule in `CHANGE_IMPACT_MATRIX.md` §7.2 requires the routing row and
  the adapter in the same change.

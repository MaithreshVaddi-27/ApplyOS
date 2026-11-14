# ADR-0001: Markdown specs under `.claude/` are the implementation

**Date**: 2026-07
**Status**: accepted
**Deciders**: ApplyOS maintainers

## Context

ApplyOS must run under any AI coding agent. That agent needs to know, precisely, what a
workflow does: which files are read, which are written, which external tools run, in what order,
and which invariants hold. That knowledge has to live somewhere, and it has to be readable by
runtimes with no shared runtime, no shared dependency tree, and no shared build step.

The obvious alternatives were a conventional application (a CLI, a service, a Python package
with a command API) or a plugin protocol requiring each runtime to implement an SDK.

## Decision

We use **markdown specifications as the implementation**. `.claude/commands/*.md` and
`.claude/skills/*/SKILL.md` define every workflow step. Any runtime that can read a file can
execute ApplyOS.

## Alternatives Considered

### Alternative 1: A conventional CLI application
- **Pros**: Testable in isolation, no agent needed, one implementation.
- **Cons**: The judgment steps — assessing fit, drafting a CV, reviewing a draft, researching a
  company — cannot be expressed as code without becoming a mediocre model. A CLI would have to
  call an LLM itself, reimplementing every provider's agent loop, and would then need an API key,
  a network dependency, and a cost model — all of which break the local-first property.
- **Why not**: It trades the strongest capability (a real agent reasoning over a real CV) for a
  weaker one (a model we call through an API).

### Alternative 2: A plugin/SDK protocol per runtime
- **Pros**: Programmatic, strongly typed.
- **Cons**: Every runtime would need a different SDK. The work is O(runtimes) per feature and
  the result is a family of half-implementations.
- **Why not**: Markdown is already readable by every runtime. The cost of a spec is one file; the
  cost of an SDK is a package per runtime.

## Consequences

### Positive
- Any runtime works with zero install beyond `bun` and `lualatex`.
- Behaviour is reviewable as prose by a human who does not read TypeScript.
- The workflow can evolve during a job search without a release.

### Negative
- The specs are not machine-executable, so a spec's correctness is not directly testable.
  Mitigated today by `tools/lint_skills.py` and the structural tests; Phase 8 proposes
  conformance tests.
- Prose drifts more easily than code. The CI mirror and parity tests exist because this has
  already happened once (the Codex wrapper drift cited in `CONTRIBUTING.md`).

### Risks
- **A spec silently diverges from what the code does.** Realised twice: the `cd cv` path bug
  (D-B1 in the 2026-10-09 audit) and the phantom-command list that `CLAUDE.md:47-52` now
  explicitly corrects. Mitigation: Phase 1 adds a link and path check; Phase 8 adds
  conformance tests.

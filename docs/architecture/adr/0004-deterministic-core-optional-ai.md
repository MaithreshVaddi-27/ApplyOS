# ADR-0004: Deterministic core, optional AI orchestration

**Date**: 2026-10-07
**Status**: accepted
**Deciders**: ApplyOS maintainers
**Origin**: clean-room engine rebuild recorded in `applyos/PROVENANCE.md`

## Context

The spec layer (ADR-0001) asks an agent to perform every step. Some of those steps are
arithmetic — is this posting older than the window, does this skill appear in the text, does
this URL match a posting we already saw. Others are judgment — is this a good fit, what should
the CV lead with, is this draft honest.

When an agent does arithmetic, the result depends on the model, the prompt, and the run. Two
runs over the same posting can disagree, and neither is auditable. The 2026-10-09 audit found
a whole class of these: *"wrong data reported as correct"* — a gate that could never fire, a
"no stipend stated" note fabricated on every posting, an amount parsed out of "3 p.m.".

## Decision

**Split the work by determinism, not by convenience.**

- **Deterministic work is code.** Fetching, robots gating, parsing, dedupe, the seven gates,
  score arithmetic, band assignment, page counts, text-layer extraction, tracker schema.
- **Judgment work is the agent.** Fit assessment, drafting, review, company research, deciding
  what to emphasise.

The deterministic core must run with **zero third-party runtime dependencies** and must be
usable from any runtime that can execute a process.

## Alternatives Considered

### Alternative 1: Everything in the spec layer
- **Pros**: One implementation; no engine to maintain.
- **Cons**: Non-reproducible. The audit findings above are all consequences of this choice.
- **Why not**: It is what the project already did, and it produced a documented class of wrong
  answers.

### Alternative 2: Everything in code, with the model as an API dependency
- **Pros**: Fully reproducible end to end.
- **Cons**: Breaks local-first (an API key, a network dependency, a cost per call), and the
  quality of fit assessment and drafting would be materially worse than a real agent with the
  candidate's full profile in context.
- **Why not**: It buys reproducibility by giving up the product's actual value.

### Alternative 3: A shared library invoked from both layers
- **Pros**: One implementation of the deterministic parts.
- **Cons**: A shared library needs a language runtime the agent can call, which is exactly what
  the core already is.
- **Why not**: Equivalent to the chosen option, with an extra indirection.

## Consequences

### Positive
- Gate results are testable and reproducible. The engine's 168 tests are the evidence.
- A gate that "can never fire" is now impossible: the gates are pure functions over
  `(posting, description, candidate)`.
- The agent's context stays small. `rank_state.py` exists for exactly this reason — the seen
  store is append-only and most entries are `skipped`, so reading it wholesale would cost
  tokens that scale with history rather than with work.

### Negative
- Two places to express a rule if the core and the spec both state it. The weight table is
  currently duplicated: `tools/rank_state.py:54-60` mirrors `04-job-evaluation.md`. Phase 5
  makes one authoritative.
- A spec step that "feels like judgment" may still contain arithmetic. The split is a judgement
  call and will need revisiting.

### Risks
- **The core and the spec diverge** — precisely the situation today, because the engine is
  unreachable from any spec. ADR-0007 proposes resolving this by promotion rather than
  parallel maintenance.

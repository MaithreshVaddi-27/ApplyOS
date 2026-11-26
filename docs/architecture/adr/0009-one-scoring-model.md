# ADR-0009: One scoring model, with a versioned judgment input

**Date**: 2026-11-26
**Status**: accepted — Phase 5 implements it
**Deciders**: ApplyOS maintainers, on the evidence recorded in Q2

## Context

Two scoring models existed. The spec layer (`/rank`, `04-job-evaluation.md`) scored four
dimensions — technical, experience, behavioral, career — with stage-specific weights and five
verdict bands. The engine scored three factors — skill overlap, title match, freshness — with its
own weights and three bands. A candidate running `/rank` and a developer running `applyos rank`
got different answers for the same posting, and neither could explain why.

`tools/spec_parity.py` settled which model is canonical with evidence rather than preference: the
spec and the Python tooling already agreed value for value, and the engine diverged on every
stage. The engine was the outlier.

## Decision

The spec's four dimensions and five bands are canonical, in `framework/scoring.json`. The engine
reads that one table at runtime; no copy of the weights or bands lives in code. The engine computes
technical (skill overlap) and experience (title echo) deterministically and combines a **versioned
judgment input** for behavioral and career. The core never re-derives judgment. A dimension with no
quoted evidence is reported as `not evaluated` and its weight leaves the denominator, never scored
as zero. Every score carries a `ScoreExplanation` whose contributions sum to the score and a
`modelVersion` identifying the table in force.

The engine's nine gates are the canonical gates in the same file. Eligibility is a hard stop;
notice-period and timezone-overlap join the set; compensation replaces the old `ctc` name.
Staleness is an advisory note, not a gate, because the spec never vetoes a posting on age alone.
`duplicate-requisition` stays proposed: it needs the Phase 9 corpus to size a false-reject rate.

## Alternatives Considered

### The spec's 4-dimension model alone
- **Pros**: one model, no new machinery.
- **Cons**: the engine becomes dependent on model judgment for every score, losing the deterministic
  layer that makes a triage run reproducible.
- **Why not**: determinism is the whole point of the engine (ADR-0004).

### The engine's 3-factor model alone
- **Pros**: determinism end to end.
- **Cons**: exact token equality misses most real matches; it regresses the user-visible score.
- **Why not**: the parity harness showed it is the outlier, not the reference.

### A hybrid, explicitly layered (chosen)
- **Pros**: deterministic factors stay deterministic; judgment stays visible; the core combines and
  explains rather than judging; `modelVersion` keeps stored scores interpretable.
- **Cons**: more machinery — a judgment input and an explanation contract.
- **Why**: it is the only option that preserves both halves without silently picking one.

## Consequences

### Positive
- One weight table, one band set, one gate list; the parity manifest is empty.
- Every score carries its derivation, and unevaluated dimensions are visible as such.
- Stored scores remain interpretable after the table changes.

### Negative
- A callers' verdict strings change from `strong fit` / `good fit` / `weak fit` to the five
  canonical band names; `ScoredPosting` gains `explanation` and `modelVersion`.
- Without a judgment input only two dimensions are scored, so a score is explicitly partial.

### Risks
- The explanation could grow bulky in a table view. The CLI keeps the short band line and the full
  explanation in `--format json`.
- A new gate could false-reject. The added gates follow the spec's own verdict-on-fail values, and
  `duplicate-requisition` is deliberately deferred until Phase 9 can measure it.

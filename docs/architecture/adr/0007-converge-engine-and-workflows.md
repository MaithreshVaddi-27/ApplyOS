# ADR-0007: Converge the engine and the spec layer onto one core

**Date**: 2026-11-13
**Status**: **accepted** (2026-11-13, Phase 2) — the engine is promoted to be the deterministic
half of the spec layer
**Deciders**: ApplyOS maintainers (ADR proposed by the 2026-11-13 blueprint)

## Context

ApplyOS has two independent implementations of overlapping workflows.

**The spec layer** (`.claude/`) drives twelve commands through an agent reading prose. It owns
the tracker, the application archive, the drafter-reviewer loop, and the LaTeX pipeline.

**The engine** (`applyos/`) implements scrape, rank, and apply deterministically in Bun. It owns
the seven gates, the scoring model, dedupe, the robots gate, and the provider adapters. It has
168 passing tests and a working `applyos` CLI.

**They do not touch.** No `.claude/commands/*.md` invokes the `applyos` binary. The engine writes
nothing to the tracker and produces no PDF. `PROJECT_MAP.md:37-40` draws the engine as a dashed,
aspirational edge.

**Why this is a problem.** Two implementations of a gate, a dedupe rule, or a scoring weight
means two places to change — and only one of them affects what the user experiences. The
2026-10-09 audit found this exact class of bug: *"silent coercion class — recurs in any rewrite
unless the contract pins strict parsing."* Meanwhile, the engine's 168 tests protect code that
no workflow reaches.

**What it costs today.** Every engineer must decide which implementation is authoritative, or
maintain both. The engine's tests give a false sense of coverage. A contributor who improves
`gates.ts` improves a code path no candidate ever runs.

## Decision

**Promote the engine to be the deterministic half of the spec layer.** The specs stop
re-implementing deterministic operations and delegate them to the core. The core becomes reachable
from every runtime through one invocation shape: `applyos <command> --format json`.

Concretely:

1. The spec layer keeps every step, every invariant, and every judgment call.
2. Steps that are arithmetic move behind a core call.
3. The core gains the capabilities the spec layer currently owns exclusively: tracker
   schema and writes, application archive management, and document-manifest emission.
4. The engine is no longer "an engine beside the framework" — it **is** the framework's
   deterministic core.

### Migration principle: additive before subtractive

Phase 2 runs the engine in **shadow mode**: it performs the same operation as the spec step and
its output is compared, not consumed. Only after the comparison passes does a step switch from
"the agent does it" to "the agent calls the core". Every switch has a stated rollback.

## Alternatives Considered

### Alternative A (chosen): Promote the engine
- **Pros**: One implementation. Determinism becomes available to every runtime, not just the
  `applyos` CLI user. The existing 168 tests start protecting real behaviour. The CLI becomes a
  genuine product surface. The engine's `PROVENANCE.md` clean-room record already satisfies the
  project's documentation standards.
- **Cons**: The largest change in the project's history, touching the highest-traffic files
  (`rank.md`, `apply.md`, `scrape` SKILL.md). Requires rewriting spec steps that currently read
  well as prose. Risk of the prose losing clarity.
- **Why not rejected**: Nothing. This is the recommendation.

### Alternative B: Keep the engine as an experimental parallel path
- **Pros**: Zero risk to the working workflow. No spec rewrites.
- **Cons**: Two implementations persist indefinitely. The engine's tests keep protecting unreachable
  code. Contributors face an unanswered ownership question. The drift between the scoring models
  and the duplicate board adapters compounds.
- **Why not**: The repo's own history treats "two copies that drift" as the failure mode to avoid
  (ADR-0002 exists for exactly this reason). Applying the rule asymmetrically — to workflow
  adapters but not to the engine — is inconsistent.

### Alternative C: Retire the engine
- **Pros**: Immediately one implementation.
- **Cons**: Throws away 168 passing tests, a working CLI, a documented clean-room provenance
  record, and a robots-gated fan-in design. Replaces them with... the prose workflow, which is
  what caused the audit findings.
- **Why not**: It solves the duplication by deleting the better-tested half.

### Alternative D: Rewrite the whole framework as a conventional CLI
- **Pros**: Uniform; fully testable.
- **Cons**: Requires an LLM API dependency, breaking ADR-0003. Loses the agent's judgment, which
  is the product's actual value.
- **Why not**: Breaks a non-negotiable property.

## Consequences

### Positive
- The engine's tests protect behaviour that matters.
- The permission allowlist can be tightened: fewer agent-authored shell invocations.
- `applyos` becomes a real CLI, and the existing `applyos apply --batch` is a genuine
  user-facing feature rather than a demo.
- The two scoring models must be reconciled — a forcing function that is currently missing.

### Negative
- Spec prose gets shorter and more mechanical. Some readability is lost; this must be watched
  for, since readable specs are the project's main contribution.
- The rewrite is large and touches the files with the most implicit behaviour.
- Contributors who learned the prose workflow will need to learn the core.

### Risks
- **A rewrite breaks a working workflow.** Mitigation: shadow mode, per-step rollback, and a
  parity test suite that compares core output against the pre-change spec behaviour.
- **The prose becomes a thin call wrapper with no value.** Mitigation: the specs keep every
  invariant, every judgment instruction, and every contract. Only arithmetic moves.
- **Phase 2 stalls.** Mitigation: the phase is scoped so that a decision to stop still leaves a
  working repository (see [../../phases/phase-02-architecture-convergence.md](../../phases/phase-02-architecture-convergence.md)).

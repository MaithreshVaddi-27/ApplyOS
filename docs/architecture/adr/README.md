# Architecture Decision Records

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-markdown-specs-are-the-implementation.md) | Markdown specs under `.claude/` are the implementation | accepted | 2026-07 |
| [0002](0002-thin-pointer-adapters.md) | Runtime adapters are thin pointers, never copies | accepted | 2026-07 |
| [0003](0003-local-first-privacy.md) | Local-first privacy is a hard constraint, not a default | accepted | 2026-07 |
| [0004](0004-deterministic-core-optional-ai.md) | Deterministic core, optional AI orchestration | accepted | 2026-10-07 |
| [0005](0005-latex-document-pipeline.md) | LaTeX + `lualatex` is the document pipeline | accepted | 2026-07 |
| [0006](0006-portal-skill-contract.md) | Every provider ships to one contract | accepted | 2026-10-07 |
| [0007](0007-converge-engine-and-workflows.md) | Converge the engine and the spec layer onto one core | **proposed** | 2026-11-13 |
| [0008](0008-single-provider-implementation.md) | One implementation per board, behind the SDK | **proposed** | 2026-11-13 |

## Lifecycle

```
proposed → accepted → [deprecated | superseded by ADR-NNNN]
```

- **proposed** — under discussion; not committed.
- **accepted** — in force; code must follow it.
- **deprecated** — no longer relevant; the replacement is named.
- **superseded** — replaced by a newer ADR; always linked.

## Writing a new ADR

1. Take the next number. Do not edit an accepted ADR in place — supersede it.
2. Follow the format below. Keep it readable in two minutes.
3. Set `Status: proposed` and link it from this index.
4. On acceptance, update the index row and the superseding ADR's status.
5. Update [../../IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md) if a capability
   moves between status markers, and
   [../../CHANGE_IMPACT_MATRIX.md](../../CHANGE_IMPACT_MATRIX.md) if a module boundary moves.

## Format

```markdown
# ADR-NNNN: [Decision title]

**Date**: YYYY-MM-DD
**Status**: proposed | accepted | deprecated | superseded by ADR-NNNN
**Deciders**: [who]

## Context
[2–5 sentences: the situation, the constraints, the forces]

## Decision
[1–3 sentences, present tense]

## Alternatives Considered
### Alternative 1: [Name]
- **Pros**:
- **Cons**:
- **Why not**:

## Consequences
### Positive
### Negative
### Risks
```

## What does not warrant an ADR

Naming conventions, file layout inside a package, test-file naming, the form of a particular
regular expression, and the current contents of `registry.yaml` (which changes monthly). These
are ordinary engineering choices; recording them dilutes the record.

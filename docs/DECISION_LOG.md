# Decision Log

> **Purpose:** the one-line index of every architectural decision, with a pointer to the full record.
> **Full records:** [architecture/adr/](./architecture/adr/README.md)
> **Convention:** a decision is only "made" when it has an accepted ADR. Anything under discussion
> lives in [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md), not here.

## Index

| ADR | Title | Status | Date | Record |
|---|---|---|---|---|
| 0001 | Markdown specs under `.claude/` are the implementation | accepted | 2026-07 | [record](architecture/adr/0001-markdown-specs-are-the-implementation.md) |
| 0002 | Runtime adapters are thin pointers, never copies | accepted | 2026-07 | [record](architecture/adr/0002-thin-pointer-adapters.md) |
| 0003 | Local-first privacy is a hard constraint | accepted | 2026-07 | [record](architecture/adr/0003-local-first-privacy.md) |
| 0004 | Deterministic core, optional AI orchestration | accepted | 2026-10-07 | [record](architecture/adr/0004-deterministic-core-optional-ai.md) |
| 0005 | LaTeX + `lualatex` is the document pipeline | accepted | 2026-07 | [record](architecture/adr/0005-latex-document-pipeline.md) |
| 0006 | Every provider ships to one contract | accepted | 2026-10-07 | [record](architecture/adr/0006-portal-skill-contract.md) |
| 0007 | Converge the engine and the spec layer onto one core | **accepted** | 2026-11-13 | [record](architecture/adr/0007-converge-engine-and-workflows.md) |
| 0008 | One implementation per board, behind the SDK | **proposed** | 2026-11-13 | [record](architecture/adr/0008-single-provider-implementation.md) |

## One-line summaries

**ADR-0001 — Markdown specs are the implementation.**
The workflow lives in `.claude/commands/*.md` and `.claude/skills/*/SKILL.md`; other runtimes read
those files rather than reimplementing them.

**ADR-0002 — Adapters are thin pointers.**
`.opencode/`, `.codex/`, and `.agents/skills/source-command-*` contain routing only. A second copy
of a workflow is a defect, and CI fails the PR that introduces one.

**ADR-0003 — Privacy is a constraint, not a default.**
Profile, tracker, salary data, and archives never leave the machine. This is enforced by gitignore
rules plus `tools/security_guards.py` in CI, not by convention.

**ADR-0004 — Deterministic core, optional AI.**
Gates, dedupe, parsing, and document verification are code. Judgment (fit assessment, drafting,
review) is the agent's. The engine may not add dependencies to a runtime that lacks them.

**ADR-0005 — LaTeX is the document pipeline.**
`lualatex` + `moderncv` templates produce the documents; `tools/verify_pdf.py` proves the text
layer is extractable. The pipeline is version-pinned and smoke-tested on two TeX Live ranges.

**ADR-0006 — One contract per provider.**
Every provider CLI exposes `search` / `detail`, `--format json|table|plain`, a
`{meta, results}` envelope, stderr JSON errors with exit 1, and zero runtime dependencies.

**ADR-0007 — Converge engine and workflows (accepted 2026-11-13).**
One core serves both the markdown workflows and the `applyos` CLI. The engine is promoted from
"parallel experiment" to "the deterministic half of the spec layer", and the specs are rewritten
to delegate to it wherever determinism is possible. The convergence starts additively:
`applyos contract` publishes the shared contract, `tools/spec_parity.py` makes the divergence
machine-visible with a ratchet, and the Stage Profile's `engine:` line controls how much of the
search the engine runs.

**ADR-0008 — One implementation per board (ACCEPTED, Phase 4).**
Five boards had two implementations with different contracts. A shared provider SDK replaced both;
all 14 boards now have one implementation and two thin surfaces. See
[architecture/adr/0008-single-provider-implementation.md](architecture/adr/0008-single-provider-implementation.md).

## Decisions deliberately *not* recorded as ADRs

Per the ADR discipline, these are ordinary engineering choices and do not warrant a record:
naming conventions, file layout inside a package, test-file naming, the choice of specific
regular-expression forms, and the current `registry.yaml` seed list (which changes monthly).

## How to change a decision

1. Open a new ADR in `architecture/adr/` with the next number. Do not edit an accepted ADR in
   place — supersede it.
2. Set `Status: proposed` and link it from this index.
3. Once accepted, set the old ADR to `Status: superseded by ADR-NNNN` and update its index row.
4. Update [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) if the change moves any
   capability between markers.
5. Update [CHANGE_IMPACT_MATRIX.md](./CHANGE_IMPACT_MATRIX.md) if the change touches a module
   boundary.

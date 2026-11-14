# Implementation Phases

Twelve sequential, independently shippable phases. Each ends with a **green-CI repository** and
its own mergeable state.

---

## The phase template

Every phase in this directory follows the same structure, so a reader always knows where to look.

| Section | Contents |
|---|---|
| **Outcome** | One sentence: what is true when this phase is done |
| **Why now** | The ordering constraint — why this cannot happen earlier or later |
| **Dependencies** | Phases, decisions, and modules that must exist first |
| **Affected modules** | The files and packages this phase touches |
| **Tasks** | Numbered, each with a concrete deliverable |
| **Tests** | The specific suites to add or extend |
| **Acceptance criteria** | Checkable statements. This is the definition of done. |
| **Risks** | What could go wrong and the rollback |
| **Rollback** | How to return to a working state if the phase goes wrong |
| **Definition of done** | The full checklist, including the documentation updates |

---

## Index

| Phase | Name | Outcome | Gate |
|---|---|---|---|
| [1](phase-01-repository-baseline.md) | Repository baseline and developer setup | A clone installs and verifies in one command; the docs tell the truth | — |
| [2](phase-02-architecture-convergence.md) | Architecture convergence | One core, two consumers | **ADR-0007** |
| [3](phase-03-deterministic-core.md) | Deterministic core and shared contracts | One `JobPosting`, one provider contract, one state contract | Phase 2 |
| [4](phase-04-provider-sdk.md) | Provider SDK and integrations | One implementation per board | **ADR-0008** |
| [5](phase-05-job-intelligence.md) | Job intelligence and matching | One explainable scoring model | Phase 4, **Q2** |
| [6](phase-06-profiles-and-documents.md) | Candidate profiles and the document engine | A machine-readable profile; machine-checkable claims | Phase 3 |
| [7](phase-07-application-workflows.md) | Application workflows and tracking | A versioned tracker contract | Phase 6 |
| [8](phase-08-ai-agents-and-runtimes.md) | AI agents and runtime adapters | One invocation shape for every runtime | Phase 2 |
| [9](phase-09-evaluation.md) | Evaluation and benchmarking | The first measured numbers | Phases 3–6 |
| [10](phase-10-cli-tui-dashboard.md) | CLI, TUI and dashboard | An optional local UI over the same core | Phases 3, 7, 9 |
| [11](phase-11-security-hardening.md) | Security and production hardening | A documented threat model; the known gaps closed | Phase 8 |
| [12](phase-12-packaging-distribution.md) | Packaging, distribution and ecosystem | An installable provider SDK; a contribution funnel | Phases 4, 9, 11 |

---

## How to work a phase

1. **Read the phase document in full.** It names the affected modules, and
   [../CHANGE_IMPACT_MATRIX.md](../CHANGE_IMPACT_MATRIX.md) tells you what else consumes them.
2. **Check the gate.** If the phase has a decision gate, the decision must be recorded in
   [../DECISION_LOG.md](../DECISION_LOG.md) before work starts.
3. **Work in order.** The tasks are sequenced so that each one leaves the repository green.
4. **Verify with the phase's own commands.** Do not rely on "CI will tell me".
5. **Update the ledger.** [../IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md) moves the
   relevant rows from `PROPOSED` to `IMPLEMENTED`, with the PR link.
6. **Update the rest.** The decision log, the impact matrix, and the open questions.

**One concern per PR.** `CONTRIBUTING.md` asks for bundles to be split. A phase is a sequence of
PRs, not one PR.

---

## What "independently shippable" means

A phase may be **stopped** after any task without leaving the repository broken. This is why
Phase 2 is specified as shadow-mode-first: the comparison harness lands and does nothing
visible, the first delegation is behind a flag, and the rollback is to flip the flag back.

If a phase cannot be stopped cleanly, it is scoped too large.

---

## The gates

Three phases have a decision gate. A gate is not a formality — it is a point where the plan
changes shape.

| Gate | Phase | Decision | Consequence of declining |
|---|---|---|---|
| **ADR-0007** | 2 | Engine as core, parallel, or retired | Phases 4, 5, 9, 10 lose their foundation |
| **ADR-0008** | 4 | One implementation per board | The SDK becomes an adapter layer, not a foundation |
| **Q2** | 5 | Which scoring model is canonical | Two products with two answers to the same question |

Plus one soft gate: **Q6** (npm publication) at Phase 12, where declining simply means
distribution stays "clone the repo".

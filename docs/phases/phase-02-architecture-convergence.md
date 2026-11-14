# Phase 2 — Architecture convergence

> **Status:** `IMPLEMENTED` (2026-11-13) · **Gate:** **ADR-0007 accepted 2026-11-13** ·
> **Risks:** [R-01, R-02, R-05](../roadmap/risks.md) ·
> **Decision:** [ADR-0007](../architecture/adr/0007-converge-engine-and-workflows.md) — accepted

## What shipped

| Task | Deliverable | State |
|---|---|---|
| 2.1 | ADR-0007 accepted | Done |
| 2.2 | The parity harness — `tools/spec_parity.py`, `docs/parity-known-differences.json`, `tests/test_spec_parity.py` | Done — 14 tests, wired into CI |
| 2.3 | The shared contract — `applyos/packages/core/src/contract.ts`, the `applyos contract` command, `tests/test_contract_shapes.py`, `tests/fixtures/seen_jobs.json` | Done — 8 tests |
| 2.4 | The Stage Profile's `engine:` line (`off` · `shadow` · `on`) and the `/scrape` wiring | Done — defaults to `off` |
| 2.5 | `rank_state.py`'s fate | Decided: **it stays.** It is the spec's own state engine and it already matches the spec exactly — the engine is the outlier. See Q2 |
| 2.6 | The decision and the findings recorded | Done — ADR-0007, Q1, Q2, the status ledger |

### What the parity harness found

The divergence was **not** where it was assumed. The harness proved that:

- the **Python tooling matches the spec exactly** — `rank_state.py`'s `STAGE_WEIGHTS` and
  `BANDS` equal `rank.md`'s stage table value for value;
- the **engine is the outlier** — 3 factors against the spec's 4 dimensions, 3 bands against
  the spec's 5, and no eligibility, notice-period, or timezone-overlap gate.

That answered **Q2 by evidence**, and it reversed the assumption in the blueprint's Phase 5
plan (which had assumed the engine's model might win). The spec's model is canonical; the
engine adopts it in Phase 5.

### The ratchet

`docs/parity-known-differences.json` lists six known differences. The harness fails when:

- a **new** difference appears (a regression), and
- a **listed** difference stops occurring (the manifest must only ever get shorter).

The second rule is what makes the manifest trustworthy: it cannot silently become stale.

---

## Outcome

The engine is **reachable** from the workflow specs, verified by a parity harness that compares
its output against the current spec behaviour — with no change to what a candidate experiences.

---

## Why now

The repository has two independent implementations of scrape, rank, and apply. The engine's 168
tests protect code no workflow reaches; the spec's rules are the ones a candidate experiences.
Until they are reconciled, every deterministic rule is maintained twice, and the two copies
already disagree (see [R-02](../roadmap/risks.md#r-02--two-incompatible-scoring-models--likelihood-certain--impact-high)).

Doing this before the provider SDK (Phase 4) avoids building the SDK over an unsettled contract.

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Phase 1 | hard | Complete |
| **ADR-0007** | **decision gate** | **Open — must be accepted** |
| Q1 | resolved by ADR-0007 | Open |

---

## Affected modules

| Path | Change |
|---|---|
| `applyos/apps/cli/src/scrape.ts` | Expose a state-writing mode |
| `applyos/apps/cli/src/rank.ts` | Expose the state subcommands |
| `applyos/packages/core/src/` | Add the shared contract's new home |
| `.claude/skills/job-scraper/SKILL.md` | Step 1b and Step 4 delegate to the core |
| `.claude/commands/rank.md` | Steps 1 and 4 delegate to the core |
| `.claude/commands/apply.md` | Steps 1 and 2 delegate to the core |
| `tools/rank_state.py` | Becomes a wrapper or is retired (decision in Task 2.5) |
| `applyos/apps/cli/tests/parity.test.ts` | **New** — the parity harness |

---

## Tasks

### 2.1 — Accept ADR-0007

**Deliverable.** ADR-0007 moves from `proposed` to `accepted`, with the deciders recorded. The
alternative chosen and why is captured in the ADR.

**Requirement.** If ADR-0007 is declined in favour of "the engine stays experimental", this phase
ends here and the roadmap is re-planned. Phases 4, 5, 9, and 10 all change shape.

### 2.2 — Build the parity harness

**Deliverable.** `applyos/apps/cli/tests/parity.test.ts` plus a committed fixture set.

**What it compares.** For the same fixture postings and the same candidate inputs:

| Behaviour | Spec layer today | Engine today | Parity assertion |
|---|---|---|---|
| Dedupe | The agent's own dedupe at `/scrape` Step 4 | `mergePools` + `interleave` + `collapseReqSpread` | Same set of surviving rows |
| Stage filters | `search-queries.md` market×stage table | `applyStageFilters` | Same rows retained |
| Gate verdicts | `04-job-evaluation.md` rules | `runGates` | Same gate names, same verdicts, same notes |
| Score bands | 5 bands from 75 down | 3 bands from 70 down | **Known to differ** — record it, do not assert parity |
| The seen-store shape | `seen_jobs.json` as written by the agent | The engine's state writer | Same keys, same types |

**Requirement.** The harness is **offline** and uses committed fixtures. It is not a live
comparison.

**The honest expectation.** The score bands will not match. The harness's job in this phase is to
*record* the difference, precisely, so Phase 5 has a specification. It should fail loudly on the
rows that differ, and the expected differences should be listed in the test file with a pointer to
Q2.

### 2.3 — Introduce the shared contract's home

**Deliverable.** `JobPosting`, `SearchMeta`, `SourceNote`, `CandidateStage`, and `GateResult`
move to one location that both layers can import.

**Options.**
- (a) `packages/core` owns them; the spec layer references the paths.
- (b) A new top-level `contracts/` package.

**Recommendation.** (a). `packages/core` already owns `types.ts` and is the natural home; a new
package adds a workspace member for no benefit. The spec layer references the file path — the
thin-pointer principle applies to code too.

**Requirement.** The old location becomes a re-export, not a deletion, until every consumer has
moved.

### 2.4 — Wire the core into `/scrape` behind a flag

**Deliverable.** `/scrape` Step 1b gains a delegation path, controlled by a setting in the Stage
Profile block (a new `engine: on|off` line, defaulting to `off` until Phase 2's acceptance
criteria pass).

**Rollback.** Flip `engine: off`. One line, no code change.

**Shadow mode.** With `engine: shadow`, the core runs and its output is written to a scratch file
next to the run summary for comparison, but the agent uses the spec's own result. This is how
parity is measured in the wild, not just in fixtures.

### 2.5 — Decide `rank_state.py`'s fate

**Deliverable.** One of:
- (a) The Python tool becomes a thin wrapper that shells out to the core, preserving the
  `python tools/rank_state.py candidates` invocation the spec already uses; or
- (b) The tool is retired and the spec calls `applyos rank state …` directly.

**Recommendation.** (a) for now, (b) once Phase 3 has stabilised the state contract. (a) keeps
the spec's existing invocations valid during the migration and keeps the Python suite meaningful.

**Requirement.** Either way, the seen-store shape must not change, or every stored entry in
every candidate's workspace becomes unreadable. This is the single highest-risk change in the
phase.

### 2.6 — Record the decision and the findings

**Deliverable.** ADR-0007 accepted; `docs/IMPLEMENTATION_STATUS.md` updated;
`docs/OPEN_QUESTIONS.md` Q1 closed; `docs/CHANGE_IMPACT_MATRIX.md` §3 updated with the new
contract ownership.

---

## Tests

| Suite | Change |
|---|---|
| `applyos/apps/cli/tests/parity.test.ts` | **New** — the parity harness |
| `applyos/packages/core/tests/contract.test.ts` | Extended for the new contract home |
| `tests/test_rank_state.py` | Unchanged in behaviour; extended if (a) is chosen |
| `tests/test_scrape_contract.py` | Extended for the `engine:` setting |
| `tests/test_runtime_adapters.py` | Extended if the spec's invocation changes |

---

## Acceptance criteria

- [ ] ADR-0007 is `accepted` with the decision and rationale recorded.
- [ ] The shared contract has one home, and both layers import it.
- [ ] The parity harness runs offline and reports its results.
- [ ] The known score-band difference is documented in the harness, not silently tolerated.
- [ ] `/scrape` can run the core's fan-in, and the setting controls it.
- [ ] The seen-store shape is **byte-compatible** with the current format — proven by a test
      that reads a fixture store written by the old writer.
- [ ] `python -m unittest discover -s tests -t .` is green.
- [ ] `cd applyos && bun run test` is green.
- [ ] The full CI matrix is green on three operating systems.
- [ ] `docs/IMPLEMENTATION_STATUS.md`, `DECISION_LOG.md`, `OPEN_QUESTIONS.md`, and
      `CHANGE_IMPACT_MATRIX.md` are updated.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The rewrite breaks a working workflow | medium | critical | Shadow mode, per-step rollback, parity harness |
| The seen-store shape changes and every candidate's workspace breaks | medium | critical | Byte-compatibility test against a fixture written by the old writer; the change is behind the `engine:` flag |
| The spec's prose becomes a thin call wrapper with no value | medium | medium | The specs keep every invariant, judgment instruction, and contract; only arithmetic moves. Review for this specifically |
| Phase 2 stalls | medium | medium | The phase is scoped so that stopping after any task leaves a working repository |
| The parity harness is written to pass rather than to reveal | low | critical | Expected differences are listed explicitly; the harness must fail on an *unexpected* difference |

---

## Rollback

| Change | Rollback |
|---|---|
| The shared contract's home | The old location becomes a re-export again. Consumers are unchanged. |
| The `engine:` setting | Set to `off`. One line. |
| `rank_state.py`'s fate | Task 2.5 is a single decision; either wrapper form reverts to the current tool |
| Spec delegation | Flip the setting. No spec edit is required to roll back |

**The phase is designed so that every task can be reverted independently.** If the phase is
abandoned after Task 2.3, the repository is in a better state than it started — the contract has
one home.

---

## Definition of done

- [ ] All acceptance criteria pass in CI on three operating systems.
- [ ] ADR-0007 is `accepted`.
- [ ] Q1 is closed in `docs/OPEN_QUESTIONS.md`.
- [ ] The engine's reachability is reflected in
      `docs/architecture/target-architecture.md`'s status.
- [ ] `docs/IMPLEMENTATION_STATUS.md` records the engine as reachable from the spec layer.
- [ ] `CHANGELOG.md` has an `[Unreleased]` entry.

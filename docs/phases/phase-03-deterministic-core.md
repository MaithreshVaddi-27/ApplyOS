# Phase 3 — Deterministic core and shared contracts

> **Status:** `PROPOSED` · **Depends on:** Phase 2 ·
> **Risks:** [R-03, R-06, R-08](../roadmap/risks.md) ·
> **Resolves:** [Q9](../OPEN_QUESTIONS.md#q9--should-the-seen_jobsjson-store-grow-without-bound--non-blocking)

---

## Outcome

One `JobPosting` type, one provider contract, one state contract, one error vocabulary — each
defined exactly once and consumed by both layers.

---

## Why now

Phase 2 established *where* the shared contract lives. This phase makes it **complete**: today
the type, the provider contract, the error codes, the stage weights, and the state format each
exist in more than one place, and the drift between them is what the audit keeps finding.

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Phase 2 | hard | Complete |
| ADR-0007 | implied | Accepted in Phase 2 |

---

## Affected modules

| Path | Change |
|---|---|
| `applyos/packages/core/src/types.ts` | The canonical contract |
| `applyos/packages/core/src/errors.ts` | **New** — the typed error vocabulary |
| `applyos/packages/core/src/stages.ts` | Single stage/filter implementation |
| `applyos/packages/core/src/weights.ts` | **New** — the one weight table (Phase 5 consumes it) |
| `applyos/packages/core/src/state.ts` | **New** — the seen-store read/write contract |
| `tools/rank_state.py` | Reads the shared weights; keeps the Python interface |
| `.claude/skills/job-scraper/SKILL.md` | References the canonical contract |
| `.claude/commands/rank.md` | References the canonical weights |

---

## Tasks

### 3.1 — Complete the type contract

**Deliverable.** `JobPosting`, `SearchMeta`, `SourceNote`, `SearchOptions`, `CandidateStage`
finalised in `packages/core/src/types.ts`.

**Decisions to make explicit.**

| Field | Decision | Notes |
|---|---|---|
| `location` | `string \| null` | `null` = the source did not state it. Never `""`, never a placeholder |
| `postedDate` | `string \| null` | ISO `YYYY-MM-DD`. `null` = unknown |
| `source` | `"adapter" \| "fallback"` | A row obtained from a search index rather than a live adapter |
| `description` | Not on `JobPosting` | It belongs on `PostingDetail`. A search row has no description, and pretending otherwise caused the "no stipend stated" bug |

**Requirement.** A `JobPosting` must be constructible from a portal result with no invention. The
type must make "I don't know" representable.

### 3.2 — Define the error vocabulary

**Deliverable.** `packages/core/src/errors.ts`.

```ts
export type ErrorCode =
  | "network" | "timeout" | "http" | "rate-limited" | "robots-disallowed"
  | "parse" | "not-found" | "credentials" | "unsupported"
  | "invalid-arg" | "invalid-format" | "invalid-salary" | "missing-arg"
  | "unknown-command" | "batch-file" | "profile-not-found" | "profile-invalid"
  | "apply-failed" | "missing-credentials";

export interface ApplyOSError { code: ErrorCode; message: string; retryable?: boolean; }
```

**Requirements.**
- The CLI codes (`INVALID_FORMAT`, `INVALID_SALARY`, `MISSING_CREDENTIALS`, `batch-file`,
  `profile-not-found`, `profile-invalid`, `missing-arg`, `unknown-command`, `apply-failed`) are
  **preserved exactly**. They are already in use; changing them breaks consumers.
- The provider codes are new and mirror the SDK design
  ([../design/provider-sdk.md](../design/provider-sdk.md#3-errors)).
- **Codes are stable; messages are not.** A message may be reworded; a code may not.

**Tests.** A test that every CLI's emitted code is in the vocabulary. This is a cross-layer
contract test and it belongs in `tests/`.

### 3.3 — One stage and filter implementation

**Deliverable.** `packages/core/src/stages.ts` becomes the single implementation of stage
filters, consumed by both the engine and any spec-side use.

**Requirement.** The `market:` dimension is currently a spec-side concept with no code
representation. Decide whether it stays spec-only (recommended — it selects *which boards run*,
not how rows are filtered) or gains a code representation. Record the decision.

### 3.4 — One weight table

**Deliverable.** `packages/core/src/weights.ts` exports the stage weights and the band
boundaries as data.

**Requirement.** `tools/rank_state.py:54-60` currently duplicates the spec's weights in Python.
It must read the same source. Because `rank_state.py` is stdlib-only Python and the table is
TypeScript, the shared home must be **data, not code** — a JSON file that both read.

**Layout.** `applyos/packages/core/weights.json`, read by the TypeScript and by the Python tool.

**Tests.** A test asserting the Python tool and the TypeScript module produce identical weights
and bands. If they ever diverge, that test fails.

### 3.5 — The state contract

**Deliverable.** `packages/core/src/state.ts` defines the seen-store read/write shape and a
`schemaVersion`.

**Requirements.**
- **Byte-compatible with the existing format.** Existing candidates' workspaces must keep
  working.
- `schemaVersion` is **additive** — a missing version means "version 1".
- A migration function exists for any future change.

**Tests.** A test that reads a fixture store written by the current writer and writes it back
with no field loss and no key reordering.

### 3.6 — Resolve Q9: the seen store grows without bound

**Deliverable.** A decision recorded in `docs/OPEN_QUESTIONS.md`.

**Options.**
- (a) Leave it. `sweep` retires expired entries; the file grows slowly.
- (b) Add a `compact` subcommand that rewrites the store keeping only live and recent entries.
- (c) Add automatic compaction after a threshold.

**Recommendation.** (b), invoked manually, with a `--dry-run` by default. (c) is dangerous — an
automatic rewrite of personal state without an explicit action is the wrong default in a project
whose entire posture is "nothing happens to your data that you did not ask for".

### 3.7 — Extend the cross-layer contract tests

**Deliverable.** New tests in `tests/` that check the seams:

- every error code emitted by any CLI is in the vocabulary;
- the weights read by Python and by TypeScript are identical;
- the state schema is read-compatible across versions;
- every path a spec mentions exists (Phase 1's checker extended to assert against the contract).

---

## Tests

| Suite | Change |
|---|---|
| `applyos/packages/core/tests/contract.test.ts` | Extended for the finalised types |
| `applyos/packages/core/tests/errors.test.ts` | **New** |
| `applyos/packages/core/tests/weights.test.ts` | **New** — the JSON weight table |
| `applyos/packages/core/tests/state.test.ts` | **New** — the state contract and migration |
| `tests/test_error_vocabulary.py` | **New** — cross-layer code check |
| `tests/test_rank_state.py` | Extended for the shared weights |

---

## Acceptance criteria

- [ ] `JobPosting` is defined once and imported by every consumer.
- [ ] Every error code emitted anywhere in the repository is in the documented vocabulary.
- [ ] The existing CLI error codes are unchanged.
- [ ] The stage weights have exactly one source, read by both the TypeScript and the Python code.
- [ ] The seen store is byte-compatible with the current format, proven by a test.
- [ ] `schemaVersion` is present and additive.
- [ ] Q9 is closed.
- [ ] The whole suite is green on three operating systems.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The seen-store format changes and existing workspaces break | medium | critical | Byte-compatibility test; the change is additive-only in this phase |
| The Python tool cannot read a JSON weight file (it can — it is stdlib) | low | low | `json` is in the standard library |
| Unifying the vocabulary breaks a consumer that depends on a message string | low | medium | Codes are stable; messages are explicitly not. A test asserts no consumer matches on a message |
| The stage-weight unification forces the Q2 decision early | medium | medium | Task 3.4 unifies the *location* of the table, not its contents. The contents decision is Q2, in Phase 5 |

---

## Rollback

| Change | Rollback |
|---|---|
| The type contract | Keep the old exports as re-exports; consumers are unchanged |
| The error vocabulary | Additive. Nothing is removed. |
| The weight table | The Python constants stay as a fallback for one release |
| The state contract | `schemaVersion` is additive; omitting it means version 1 |

---

## Definition of done

- [ ] All acceptance criteria pass in CI on three operating systems.
- [ ] `docs/IMPLEMENTATION_STATUS.md` reflects the unified contracts.
- [ ] `docs/CHANGE_IMPACT_MATRIX.md` §3 and §6 reflect the new ownership.
- [ ] `docs/OPEN_QUESTIONS.md` Q9 is closed.
- [ ] `CHANGELOG.md` has an `[Unreleased]` entry.

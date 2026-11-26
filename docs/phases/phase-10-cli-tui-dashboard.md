# Phase 10 — CLI, TUI and dashboard

> **Status:** `IMPLEMENTED` · **Depends on:** Phases 3, 7, 9 ·
> **Risks:** [R-22, R-23](../roadmap/risks.md) ·
> **Resolves:** [Q8](../OPEN_QUESTIONS.md#q8--is-there-a-performance-budget-and-where-is-it-enforced--non-blocking),
> [Q10](../OPEN_QUESTIONS.md#q10--is-there-a-consumer-of-the-applyos-cli-other-than-a-person--non-blocking)

---

## Outcome

A local, optional interface over the same core — a richer CLI, a terminal UI, and a dashboard that
reads the core rather than re-deriving from the CSV.

---

## Why now

The comparison project ships a Go TUI with 10 filter tabs and 8 sort modes, and an experimental
web UI. ApplyOS ships an HTML report generated from the tracker CSV — useful, but it reads the
CSV directly and cannot answer "what is the best fit in my pipeline right now?"

Phase 10 comes **after** the evaluation, because a nicer interface over an unstable shortlist is
cosmetic. The ranking-stability measurement from Phase 9 tells us how much the interface needs
to communicate uncertainty.

**Scope discipline.** This phase is `IMPLEMENTED` and its scope was deliberately narrow. A TUI was
the highest-value increment; a web UI is explicitly out of scope (see the non-goals in
[../architecture/target-architecture.md](../architecture/target-architecture.md#7-explicit-non-goals)).

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Phase 3 (the shared contract) | hard | Complete |
| Phase 7 (the versioned tracker contract) | hard | Complete |
| Phase 9 (the stability measurement) | hard | Complete |
| **Q10** — who consumes the CLI JSON | **decision gate** | **Open** |

---

## Affected modules

| Path | Change |
|---|---|
| `applyos/apps/cli/src/` | The command surface; `doctor` (Phase 1); `eval` (Phase 9) |
| `applyos/apps/tui/` | **New** — the terminal UI |
| `.claude/commands/html-report.md` | The dashboard reads the core |
| `output/reports/` | The generated dashboard |
| `docs/design/cli-design.md` | The final command surface |

---

## Tasks

### 10.1 — Settle the CLI's public surface

**Deliverable.** The final command list and flag vocabulary, written down and stable.

**Requirements.**
- `applyos doctor` (Phase 1), `applyos scrape|rank|apply` (existing),
  `applyos tracker list|set|migrate` (Phase 7), `applyos eval` (Phase 9),
  `applyos profile validate` (Phase 6).
- Every command supports `--format json|table|plain` and exits 0/1 per
  [../design/public-api.md](../design/public-api.md#2-the-cli-surface).
- `--version` prints the core version.

**Requirement.** The surface is **stable** from here. Additive changes only within a major
version.

### 10.2 — Answer Q10

**Deliverable.** A decision.

**The question.** What consumes the CLI's JSON?

| Option | Consequence |
|---|---|
| (a) The TUI reads `applyos rank --format json` | One process boundary per interaction; the TUI shells out |
| (b) The TUI links the core as a library | Faster, but the TUI is then a Bun package and inherits the engine's build |
| (c) A new `applyos snapshot` command emits a JSON snapshot; the TUI reads it | A stable data contract; the TUI can be any language |

**Recommendation.** (c) with (b) as the implementation. The snapshot command is the stable
interface; the TUI happens to be a Bun package today and could be anything tomorrow.

### 10.3 — Build the TUI

**Deliverable.** `applyos/apps/tui/`.

**Scope — deliberately minimal.**

| Feature | Requirement |
|---|---|
| Pipeline view | The tracker, grouped by status, with the counts from the tracker schema |
| Shortlist view | The ranked postings with their scores, bands, and **gaps** |
| Posting detail | The score's explanation (Phase 5), the gates, the quoted evidence |
| Fit filter | Filter by band and by gap |
| No editing | **Read-only.** All writes go through `applyos tracker set` or the specs. A TUI that mutates the tracker is a second writer, and the tracker already has five |
| Local only | No network beyond the core's own provider calls |

**Requirements.**
- **Read-only by default.** This is the single most important constraint. The tracker already
  has five writers; a sixth would break the "never restructure the file" invariant.
- **No new runtime dependencies** beyond what the core already uses. A TUI framework would break
  the zero-dependency promise; ANSI escapes and a readline library in the standard library will
  do.
- **Degrades gracefully.** Without a tracker, it shows an empty state with the setup hint.

### 10.4 — Make the dashboard read the core

**Deliverable.** `/html-report` reads through the shared tracker reader rather than parsing the
CSV itself.

**Requirements.**
- The dashboard stays **self-contained**: inline CSS, inline JS, inline SVG charts, no external
  requests of any kind.
- It stays **data-only**: it never writes to the tracker or the archive.
- It stays **idempotent**: re-running overwrites the same path.
- The **funnel** is computed from the current status plus the merged `outcome.md` checkboxes — the
  existing behaviour, unchanged.
- `drafted` rows are still excluded from every statistic.

**Why this matters.** Today the dashboard re-implements the tracker parsing. When the schema
changes, the dashboard is a second thing to update — and it is the kind of second thing that gets
forgotten.

### 10.5 — Define the performance budgets, now that they can be measured

**Deliverable (done).** Replace the `PROPOSED` budgets in
[../engineering/performance.md](../engineering/performance.md#6-measured-budgets-phase-10) with
measured values — five runs each for the four offline commands, with ceilings in that section.

**Requirements.**
- Every budget cites the measurement that justifies it.
- The budgets are for the **local** operations (`doctor`, `eval`, `rank`, `apply`). A scrape
  budget is still deliberately **not** proposed — see the reasoning in the performance document.
- The budgets are enforced by the Phase 9 CI gate.

### 10.6 — Publish a screenshot-free walkthrough

**Deliverable.** A short document in `docs/developer/` showing the TUI and the dashboard, with
transcribed output rather than images (the repository has no image dependency, and images would
rot).

---

## Tests

| Suite | Change |
|---|---|
| `applyos/apps/tui/tests/` | **New** — rendering, filters, the empty state |
| `applyos/apps/cli/tests/` | Extended for the final command surface |
| `tests/test_html_report_command.py` | Extended: the dashboard reads through the core |

---

## Acceptance criteria

- [x] Q10 is answered and recorded. — Option (c): `applyos snapshot` is the stable consumer
      contract; the TUI links the core for rendering but codes against the snapshot.
- [x] The CLI surface is documented and stable. — `public-api.md` §2 lists every command;
      `--version` added; additive-only from here.
- [x] The TUI exists, is read-only, and has no new dependencies. — `apps/tui`, ANSI-free pure
      rendering; a test asserts no write path in its source.
- [x] The TUI shows the score's explanation and the gaps. — `renderDetail` prints dimensions,
      quoted evidence, gates and gaps.
- [x] The dashboard reads through the shared tracker reader. — `/html-report` Step 1 calls
      `applyos tracker list`; its existing field-enumeration test still passes unmodified.
- [x] The dashboard is still self-contained and idempotent. — Unchanged: inline CSS/JS/SVG, no
      network, overwrites the same path.
- [x] The performance budgets are measured and enforced. — Four offline commands measured (5 runs
      each); ceilings in `performance.md` §6; Q8 resolved.
- [ ] The whole suite is green on three operating systems.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Scope creep into a full application | high | high | The explicit non-goals list. The TUI is read-only. A web UI is out of scope |
| The TUI becomes a second writer of the tracker | medium | critical | Read-only is a hard constraint, asserted by a test |
| The TUI's dependency needs break the zero-dependency promise | medium | high | No framework. ANSI escapes and the standard library |
| The dashboard's self-contained property is lost | low | medium | A test asserts the output contains no external URL |
| A local UI weakens the privacy property | low | high | Everything stays local; there is no server, no port, no telemetry |

---

## Rollback

| Change | Rollback |
|---|---|
| The CLI surface | Additive commands; each can be removed independently |
| The TUI | A separate package; removing it changes nothing else |
| The dashboard reading through the core | Revert to the inline CSV parsing. The output is identical either way |
| The performance budgets | Loosen them with a recorded reason |

---

## Definition of done

- [ ] All acceptance criteria pass in CI on three operating systems.
- [ ] Q8 and Q10 are closed in `docs/OPEN_QUESTIONS.md`.
- [ ] `docs/engineering/performance.md` has measured budgets.
- [x] `docs/IMPLEMENTATION_STATUS.md` records the CLI surface and the TUI.
- [x] `docs/design/cli-design.md` is the final version. — The surface is published in
      `docs/design/public-api.md` §2, which cli-design.md references; additive-only from Phase 10.
- [x] `CHANGELOG.md` has an `[Unreleased]` entry.

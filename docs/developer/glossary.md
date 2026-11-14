# Glossary

> The shared vocabulary of the ApplyOS blueprint. Every document uses these terms in these senses.

---

## Layers

**Spec layer** — the markdown workflow specifications under `.claude/commands/` and
`.claude/skills/`. Canonical. The implementation.

**Adapter layer** — `.opencode/`, `.codex/`, `.agents/skills/source-command-*`. Thin pointers that
route to the spec layer. Never contains workflow content.

**Engine** — the Bun/TypeScript monorepo at `applyos/`. Implements the deterministic half:
fetching, robots gating, parsing, dedupe, gates, scoring, pack assembly.

**Tooling** — the Python scripts under `tools/`. The executable logic the spec layer delegates
to: state management, PDF verification, repository guards, linting.

**Provider CLI** — one Bun program under `.agents/skills/<board>-search/cli/` that reaches one
job board and satisfies the portal-skill contract.

**Provider SDK** — the versioned TypeScript interface for implementing a board once and exposing
it through both a CLI surface and the engine. `PROPOSED` — Phase 4.

**Thin pointer** — an adapter that references a canonical spec instead of copying it.

---

## The pipeline

**Pipeline** — the whole sequence: `/setup` → `/scrape` → `/rank` → `/apply` → `/interview` →
`/outcome`, with calibration back into `/setup`.

**Stage** — the candidate's career stage: `student`, `fresher`, `experienced`, `remote-global`.
Selects the ranking weights, the stage-conditional gates, and the portal set.

**Market** — `india`, `global`, `us`, `uk`, `eu`, `other`. Selects the portal set and scopes
the market-conditional gates.

**Stage Profile** — the fenced block in `search-queries.md` holding `stage:`, `market:`,
`graduation_year:`, `preferred_cities:`, `remote_preference:`, `stipend_floor:`,
`expected_ctc_floor:`, `notice_period:`. Read by `/scrape` Step 0.5.

**Portal set** — the provider skills that run for a given market × stage pair. Unlisted portals
report `skipped (stage)` rather than failing.

**Gate** — a deterministic check on a posting: `stale`, `location`, `language`, `batch`,
`stipend`, `ctc`, `bond`. Each returns `PASS`, `FAIL`, or `FLAG`. A `FAIL` vetoes the posting
regardless of score.

**Verdict** — the band a score falls into. The spec layer uses five (Strong ≥75, Good 60–74,
Moderate 45–59, Weak 30–44, Poor <30). The engine currently uses three. **One set is the goal**
— Q2.

**Score** — a weighted fit number. The spec layer uses four dimensions (technical, experience,
behavioural, career). The engine uses three factors (skill, title, freshness). **One model is the
goal** — Q2.

**Explanation** — the breakdown attached to a score: each dimension, its weight, its raw value,
its contribution, and the quoted evidence. `PROPOSED` — Phase 5.

**Pack** — the tailored application artefact: the resume in Markdown, a portal pitch, a follow-up
draft, the explicit gaps, and the claim traces.

**Claim trace** — a document claim plus the profile source it came from.

**Grounding Audit** — the check that every claim in a draft exists in the union of three
sources: `01-candidate-profile.md`, the master CV, and `CLAUDE.md`. A claim in none of them is
removed.

**Document Manifest** — the JSON sidecar listing every claim, its source, the gaps, the page
budget, and the ATS result. `PROPOSED` — Phase 6.

---

## Data

**Seen store** — `workspace/seen_jobs.json`. Every posting ever seen, with scores, verdicts, and
deadlines. Append-only by design. Written by `/scrape` and by `/rank` **through
`tools/rank_state.py` only**.

**Tracker** — `workspace/job_search_tracker.csv`. One row per application. The highest-fanout
contract in the repository.

**Status vocabulary** — the nine canonical tracker statuses: `drafted`, `applied`, `interview`,
`offer`, `hired`, `rejected`, `no_response`, `offer_declined`, `withdrawn`. Legacy space
spellings are read but never written. `interview_only` is archive-only.

**Archive** — `output/applications/<company>_<role>/`. The posting, the submitted document, the
outcome, the prep pack, and the follow-up drafts.

**Personal data** — anything under `input/**`, `output/**` (except tracked notes), `workspace/**`,
and `salary_data.json`. Never leaves the machine.

---

## Contracts

**Portal-skill contract** — the shape every provider CLI satisfies: `search` and `detail`,
`--format json|table|plain`, the `{meta, results}` envelope, stderr JSON errors with exit 1, zero
runtime dependencies, environment-variable credentials only.

**Provider envelope** — the CLI's JSON shape: `{meta:{count,page}, results:[{id,title,company,
location,date,url}]}`. `meta.count === results.length`. Missing values are `null`.

**JobPosting** — the engine's row type: `id`, `title`, `company`, `location`, `postedDate`,
`url`, `portal`, `source`. `null` means "the source did not state it".

**Invocation contract** — `applyos <command> [flags] --format json`. The single shape every
runtime uses. `PROPOSED` — Phase 8.

**Null discipline** — a field the source did not state is `null`. Never `""`, never a placeholder
string, never omitted, never inferred.

**Not evaluated** — the explicit state of a gate or dimension that could not be checked because
there was no text to read. Reported as `PASS` with a note, never as a fabricated finding.

---

## Process

**Thin-pointer invariant** — every runtime reaches the canonical specs through a pointer. A
second copy of a workflow is a defect.

**Shadow mode** — running the engine alongside the spec layer, comparing outputs, and not yet
consuming the engine's result. Phase 2's mechanism.

**Parity harness** — the test that compares the engine's output against the spec layer's
behaviour on identical fixtures.

**Evaluation** — a measurement on a labelled corpus, reproducible offline, with a committed
baseline. Not a unit test.

**Baseline** — the committed JSON of a metric's last accepted value, with a tolerance.

**Corpus** — the committed, labelled fixture set an evaluation runs against.

**Status marker** — `IMPLEMENTED`, `PARTIAL`, `PROPOSED`, `EXPERIMENTAL`, `DEPRECATED`,
`UNKNOWN`. Every capability claim carries one.

**ADR** — an Architecture Decision Record: context, decision, alternatives, consequences.

**Gate (decision)** — a point in the roadmap where a decision changes the plan's shape. Distinct
from a *gate* on a posting.

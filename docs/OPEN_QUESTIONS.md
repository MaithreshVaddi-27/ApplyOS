# Open Questions

> **Purpose:** the honest list of what is not known. Every item says how it would be resolved,
> what it blocks, and who can resolve it.
> **Rule:** if a question cannot be answered from the repository, it goes here rather than being
> quietly assumed in a design document.

Legend: **Blocking** = a phase cannot start until it is answered. **Non-blocking** = a phase can
proceed with a documented default.

---

## Q1 — Does the engine become the core, or does it stay a parallel experiment? · **RESOLVED 2026-11-13**

**Why it matters.** The spec layer and the engine implement overlapping workflows independently.
No spec invokes the engine; the engine writes nothing to the tracker or the archive. Until this
is settled, every duplicate behaviour must be maintained twice.

**Resolution.** **ADR-0007 is accepted**: the engine is promoted to be the deterministic half of
the spec layer. The specs keep every step, invariant, and judgment call; the deterministic
operations move behind core calls.

**How the convergence starts.** Additively, in Phase 2:
- `applyos contract` publishes the shared contract so the spec layer can read the field names
  rather than guess them.
- `tools/spec_parity.py` makes the divergence between the three implementations **machine
  visible**, with a ratchet: a new difference fails, and a listed difference that disappears
  also fails.
- The Stage Profile's `engine:` line (`off` | `shadow` | `on`) controls how much of the search
  the engine runs, defaulting to `off`.

---

## Q2 — Which scoring model is canonical? · **RESOLVED 2026-11-26 (Phase 5)**

**Why it matters.** Two incompatible models exist:

| | Spec layer | Engine |
|---|---|---|
| Dimensions | 4: technical, experience, behavioral, career | 3: skill, title, freshness |
| Stage weights | student 30/15/15/40, fresher 35/20/15/30, experienced 30/25/15/30, remote-global 30/25/15/30 | student 40/35/25, fresher 45/35/20, other 50/30/20 |
| Bands | Strong 75+, Good 60–74, Moderate 45–59, Weak 30–44, Poor <30 | strong ≥70, good ≥45, weak below |
| Judgment | Model reads the posting and reasons | Pure substring overlap + token match |

**Resolution — the spec's model is canonical.** The parity harness
(`tools/spec_parity.py`) settled this with evidence rather than preference:

| Implementation | Weights | Bands | Agrees with the spec? |
|---|---|---|---|
| **The spec layer** (`.claude/commands/rank.md`, `04-job-evaluation.md`) | 4 dimensions | 5 bands | — it is the reference |
| **The Python tooling** (`tools/rank_state.py`) | 4 dimensions | 5 bands | ✅ **exactly** |
| **The engine** (`packages/matching/src/score.ts`) | 3 factors | 3 bands | ❌ diverges on every stage |

**The tooling already implements the spec's model, value for value** — `STAGE_WEIGHTS` and
`BANDS` in `rank_state.py` match `rank.md`'s stage table exactly. The **engine is the
outlier**, not the spec.

**What Phase 5 does.** The engine adopts the spec's four dimensions and five bands. Its
deterministic factors (skill overlap, title match, freshness) become the engine's
*contribution* to the technical and experience dimensions, and the behavioural and career
dimensions arrive as a **versioned judgment input** from the agent. The engine never re-derives
judgment; the core combines and explains.

**The remaining differences, all recorded in `docs/parity-known-differences.json`:**

| Id | Difference | Closed by |
|---|---|---|
| `engine-dimensions` | 3 factors vs 4 dimensions | Phase 5 |
| `engine-band-names` / `engine-band-strong` / `engine-band-good` | 3 bands (70/45) vs 5 bands (75/60/45/30) | Phase 5 |
| `engine-missing-gates` | No eligibility, notice-period, or timezone-overlap gate | Phase 5 |
| `engine-stale-gate` | Staleness is a FAIL gate; the spec makes it a flag | Phase 5 |

**The eligibility gate is the highest priority of those.** The spec treats a citizenship or
residency requirement as a **hard stop** — do not score, do not draft — and the engine has no
such gate.

**Phase 5 closed every row of that table (2026-11-26).** The engine reads `framework/scoring.json`
through `packages/matching/src/weights.ts`, scores the four dimensions with a versioned judgment
input, uses the five canonical bands and the nine canonical gates, and flags staleness instead of
vetoing on it. `docs/parity-known-differences.json` is empty and the parity gate fails on any new
divergence. The decision and its trade-offs are recorded in
[ADR-0009](architecture/adr/0009-one-scoring-model.md).

---

## Q3 — Why is there no `06-*.md` in `job-application-assistant/`? · **non-blocking**

**Evidence.** The directory contains `01,02,03,04,05,07,08,09`. `/setup` Step 3 enumerates
files 1–5 and 7–9 and writes 1, 2, 4, 5, 7. `/reset` Step 3 restores 1, 2, 4, 5, 7. No file
references a `06`.

**Two plausible readings.** (a) The file was deliberately removed and the numbering left as a
scar. (b) It was never written. `CHANGELOG.md` mentions *"b1ad136 refactor: finish
standalone-to-engine naming sweep"* but does not cover this.

**Resolution.** Check `git log --diff-filter=D -- '.claude/skills/job-application-assistant/06*'`.
Non-blocking — but if `06` was deleted, its content may still be referenced by another spec.

---

## Q4 — Is `PROJECT_MAP.md:82` correct about a `.zcode/` directory? · **non-blocking — RESOLVED 2026-11-13**

**Evidence.** `PROJECT_MAP.md:82` listed `.zcode/` as "Plans + native skill discovery" for ZCode.
`Test-Path .zcode` → **False**. `AGENTS.md` lists ZCode as a supported runtime with the
"routing table below" as its adapter — which is consistent with there being no `.zcode/`.

**Resolution.** The row was **removed**. ZCode reaches ApplyOS through the `AGENTS.md` routing
table, exactly as `AGENTS.md` states. No adapter directory was created: the evidence says one
was never there.

---

## Q5 — Which boards should have exactly one implementation? · **RESOLVED**

**The overlap.**

| Board | Provider CLI | Engine adapter | Notes |
|---|---|---|---|
| remoteok | `.agents/skills/remoteok-search/` | `packages/portals/src/remoteok.ts` | **MIGRATED (2026-11-14)** — one implementation in `applyos/packages/provider/src/remoteok.ts`; both surfaces are over it |
| remotive | `remotive-search/` | `portals/src/remotive.ts` | **MIGRATED (2026-11-14)** — one implementation in `applyos/packages/provider/src/remotive.ts` |
| weworkremotely | `weworkremotely-search/` | `portals/src/weworkremotely.ts` | **MIGRATED (2026-11-21)** — the engine read a `<location>` tag the feed does not carry, and one of its three feeds does not exist |
| unstop | `unstop-search/` | `portals/src/unstop.ts` | **MIGRATED (2026-11-16)** — the two surfaces used different Unstop endpoints; the engine's was the thin listing that does not filter |
| freehire | `freehire-search/` | `portals/src/freehire.ts` | **MIGRATED (2026-11-16)** — the engine's endpoint answered 404 on every scrape; the SDK uses the board's working `/api/v1/agent/jobs/search` |
| arbeitnow | `arbeitnow-search/` | `portals/src/arbeitnow.ts` | **MIGRATED (2026-11-22)** — Phase 4.6 gave the EU board a provider CLI; both surfaces are over `applyos/packages/provider/src/arbeitnow.ts` |
| linkedin, naukri, internshala, wayup, wellfound, cutshort | ✅ | — | CLI-only |
| careers (8 ATS boards) | ✅ | `packages/company-scraper/` (5 boards) | **MIGRATED (2026-11-24)** — all five shared boards and the three CLI-only ones (ashby, salesforce, eightfold) now have one implementation each in the SDK; both surfaces are thin adapters over it |

**Resolution (per ADR-0008).** Each board gets **exactly one implementation**, in the provider SDK,
with two thin surfaces over it — the CLI and the engine. The SDK owns the board's facts (fetch,
parse, filter, url); each surface owns only its own output shape. The two interfaces can differ:
the CLI exposes `search`/`detail` with a text contract, the engine exposes `JobPosting` rows —
that is a surface difference, not a second implementation.

All fourteen boards are migrated: the six aggregators plus the eight ATS boards. The unified
registry (`applyos/packages/provider/registry.yaml`) is the single inventory, with one
`implementation` per board and one `companies:` section holding the seven seeded employers. The
count is enforced by both the SDK and the Python suite, so this question cannot reopen silently.

**What the six migrations settled, for the boards that follow:**

- The SDK has **zero runtime dependencies** and is imported by relative path from the CLIs,
  exactly as `cli-shared` is. The contribution path (ADR-0006) is preserved.
- The SDK's fetch policy follows the engine's: 20 s timeout, one retry, honest User-Agent. A
  board whose own politeness differs may say so — freehire retries a 429 seven times and fails
  fast on a connection failure, and unstop gives a hung portal 15 s and three attempts — and
  `providerFetch` carries the options those need.
- **Each surface translates its own conventions, per board.** `--limit 0` means "default page
  size" on RemoteOK, **nothing** on Unstop, and "no cap" in the engine and the SDK. A row the
  board did not title is `"Untitled"` to the CLI and dropped by the engine. The SDK carries the
  board's own value; the surface applies its rule.
- **A board may expose more than one endpoint, and the two surfaces may have picked different
  ones.** Unstop's two listings are not equivalent: one is scoped to a listing type and filters,
  the other covers every type at once and does not. Check which one each surface uses, and check
  that the one you pick is the one that does the job.
- **Inject the clock for anything the answer depends on.** The age filter is the one part of a
  search whose result moves with today, and a fixture that moves stops proving anything. The
  provider takes `now`; the production provider uses `new Date()`; a test pins the window.
- The provider names the CLI error code (`ProviderError.cliCode`); the surface forwards it —
  unless the board has always used a different code, in which case the surface translates to
  keep it. `tests/test_error_vocabulary.py` scans the SDK, so a code the SDK names cannot slip
  through unregistered.
- A parity test captures the **pre-migration** implementation's output as a fixture. The
  fixture records what the code did, not what it should do. Capture the whole envelope, not
  just the rows: remotive's filters and paging are client-side, and a row-level fixture would
  not have caught a filter that drifted. Capture the feed and the oracles in one run.
- **Trim the fixture to what the implementation reads.** Unstop's live listing carries
  registration requirements, work functions and prize tables; a fixture of all of it is a
  megabyte of noise.
- **Check how the board actually behaves before porting it.** Remotive ignores its query
  parameters, so the engine's adapter had never filtered anything. Freehire's endpoint was
  wrong, and its adapter read fields the board does not send. Both were invisible until the
  board was read live.
- A board's own quirks stay. Remotive keeps its own HTML-to-text rule, because a description is
  read by the gates and its text must not change shape in a migration.

---

## Q6 — Should `applyos` be published to npm? · **non-blocking for Phases 1–9, relevant to Phase 12**

**Arguments for.** The provider SDK becomes installable by external contributors; the
`applyos` CLI becomes discoverable; career-ops uses `npx @santifer/career-ops init` as its
primary distribution (see [research/competitive-analysis.md](./research/competitive-analysis.md)).

**Arguments against.** The repository is explicit that it is "one specific edition of a general
framework" and that market-specific work belongs in a private fork
([CONTRIBUTING.md](../CONTRIBUTING.md)). Publishing creates a versioning obligation, an npm
maintainer identity, and a support surface.

**Unknown.** Whether external demand exists. No metric in this repository measures it.

---

## Q7 — What is the actual install experience on a fresh machine? · **non-blocking — RESOLVED 2026-11-13**

**Evidence.** Today, installation is: clone, then run a shell loop over
`.agents/skills/*-search/cli` to `bun install` each of 12 CLIs (README "Install the portal CLI
tools"). The engine needs its **own** `bun install` in `applyos/`, which the README does not
mention — so `bun test` in `applyos/` fails on a fresh clone with
`Cannot find module '@applyos/core'`.

**Also unknown.** The LaTeX install path is documented in `SETUP.md`, but the local machine has no
`lualatex`, no Poppler, and no `pypdf` — so the `/apply` verification loop could not be exercised
here.

**Resolution.** Phase 1 shipped `scripts/bootstrap.sh` and `scripts/bootstrap.ps1`. They check the
toolchain, install the engine **and** every portal CLI, and verify the repository with the same
commands CI runs. `applyos doctor` reports the same state on demand. Both README and SETUP.md
now point at the bootstrap script, and `tests/test_bootstrap_scripts.py` keeps them honest.

**Remaining.** The LaTeX leg is still unexercised on this machine — it needs a TeX Live install,
and CI's two `latex-smoke` legs cover it there.

---

## Q8 — Is there a performance budget, and where is it enforced? · **non-blocking**

**Evidence.** The engine records `elapsedMs` in `SearchMeta` (`types.ts:33`) and prints it in
the CLI table output (`cli.ts:48`). The comment says it "Feeds the speed SLO", but **no SLO is
defined anywhere** and no test asserts a latency ceiling.

**Known per-call constants** (facts, not budgets): 20 s default timeout, 1 retry, 300 ms
inter-host pacing, 3-page default cap (`cli.ts:39`), 1000-row maximum limit.

**Resolution.** Phase 9 (evaluation) should define offline latency measurements. A *budget* is a
product decision, not a measurement, and belongs in [OPEN_QUESTIONS](./OPEN_QUESTIONS.md) →
resolved in Phase 9 or 10.

---

## Q9 - Should the `seen_jobs.json` store grow without bound? · **RESOLVED 2026-11-13**

**Evidence.** `tools/rank_state.py` exists precisely because the store "grows for the life of the
workspace, since `seen_jobs.json` is append-only by design and most stored entries are
`skipped`". `sweep` retires expired entries; `candidates` projects only what a scoring agent
needs. But the file itself was never compacted.

**Resolution.** A `compact` subcommand on `tools/rank_state.py`, dry-run by default.

**The rule is conservative, because a dropped posting is one the candidate may see again.**
An entry is dropped only when *all* of these hold:

- its status is `skipped` or `expired` — nothing was scored, so there is no decision to keep;
- it has no deadline, or its deadline has passed;
- it has a `posted_date` older than the cutoff (default 90 days); and
- it is not in `--exclude`.

**An entry with no `posted_date` is never dropped.** Without a date there is no way to know
whether the posting is still live, and guessing is the failure class this project exists to
prevent.

**Nothing is removed without `--write`.** The store is the candidate's own search history.

The state format itself is now versioned (`schemaVersion`, defaulting to version 1 — the format
that has always existed), so a future change has a declared home rather than an implicit one.
See [design/document-formats.md](./design/document-formats.md).

---

## Q10 — Is there a consumer of the `applyos` CLI other than a person? · **BLOCKING for Phase 10**

**Evidence.** The CLI's `--format json` output is machine-readable, which implies a consumer.
Today there is none: no TUI, no dashboard, no script in the repo consumes it. `/html-report`
generates its own HTML from the tracker CSV directly.

**Resolution.** Phase 10 needs a concrete consumer to design against. Options: (a) the TUI reads
`applyos rank --format json`; (b) the dashboard reads it; (c) both read a shared JSON snapshot
that a new engine command emits.

---

## Q11 — Do the `gmail-sync` and `notion-sync` MCP dependencies have a portable fallback? · **RESOLVED 2026-11-26 (Phase 8)**

**Evidence.** Both commands hard-required a specific MCP server
(`mcp__claude_ai_Gmail__*`, `mcp__notion__*`), which broke the runtime-agnostic claim for Codex,
Antigravity and other agents. The commands were `PARTIAL`.

**Resolution — capabilities, not vendor tools, with a manual degraded mode.** Phase 8 defines the
capabilities each command needs (`gmail.search`, `gmail.thread`, `notion.database`, `notion.page`)
and specifies the binding as runtime-provided. A runtime with a differently-named binding maps it;
a runtime with none gets one clear message and a clean exit — never a stack trace. The degraded mode
is manual: the tracker is the source of truth and `applyos tracker set` lets a human update a row,
so these commands accelerate a workflow rather than gate it. Neither command initiates an OAuth
flow or guesses content it could not read. Documented in
[developer/agent-facing.md](developer/agent-facing.md) and in each command spec.

---

## Q12 — What is the review and merge policy for the repo? · **non-blocking**

**Evidence.** `CONTRIBUTING.md` states the review bar in detail ("Claims get verified", reproduce
on the real path, run what CI runs) but no branch-protection or required-check configuration is
visible in the repository. The CI workflow header itself notes: *"a PR can edit this workflow
itself, so these guards catch accidents and casual attempts, not a determined author — branch
protection with required checks and human review of workflow/settings diffs remain the real
backstop."*

**Resolution.** Repository settings, not repository content — cannot be resolved in-repo.
Phase 11 records it as an operational requirement.

---

## Resolution tracker

| # | Blocking for | Status | Resolved by |
|---|---|---|---|
| Q1 | Phase 2 | **resolved 2026-11-13** | ADR-0007 accepted — the engine becomes the core |
| Q2 | Phase 5 | **resolved 2026-11-26** | Phase 5: the engine reads the canonical table, scores four dimensions with a versioned judgment input, and the parity manifest is empty. ADR-0009 |
| Q3 | — | open | git history check |
| Q4 | — | **resolved 2026-11-13** | Phase 1: the `.zcode/` row was removed |
| Q5 | Phase 4 | **resolved 2026-11-24** | Phase 4: one SDK implementation per board, two thin surfaces, one unified registry |
| Q6 | Phase 12 | open | Phase 12 design |
| Q7 | Phase 1 | **resolved 2026-11-13** | Phase 1: bootstrap scripts + `applyos doctor` |
| Q8 | Phase 9/10 | open | Phase 9 measurements |
| Q9 | — | **resolved 2026-11-13** | Phase 3: a `compact` subcommand, dry-run by default |
| Q10 | Phase 10 | open | Phase 10 design |
| Q11 | — | **resolved 2026-11-26** | Phase 8: capability bindings with a manual degraded mode; see ADR-equivalent record above |
| Q12 | — | open | Phase 11 (operational) |

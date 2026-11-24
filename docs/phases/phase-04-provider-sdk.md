# Phase 4 — Provider SDK and integrations

> **Status:** `PARTIAL` — 4.1–4.3 implemented; 4.4–4.9 remain ·
> **Gate:** ADR-0008 **accepted** · **Depends on:** Phase 3 (Complete) ·
> **Risks:** [R-03, R-04, R-05, R-14, R-19, R-24](../roadmap/risks.md) ·
> **Resolves:** [Q5](../OPEN_QUESTIONS.md#q5--which-boards-should-have-exactly-one-implementation--blocking-for-phase-4)

---

## Outcome

Each board has **exactly one implementation**, behind a versioned provider SDK, exposed through
both a CLI surface and the engine.

---

## What is done (2026-11-16)

| Task | State | Evidence |
|---|---|---|
| 4.1 Accept ADR-0008 | **DONE** | `docs/architecture/adr/0008-single-provider-implementation.md` is `accepted` |
| 4.2 Build the SDK package | **DONE** | `applyos/packages/provider/` — zero runtime dependencies, `ProviderError`, a reusable contract harness in `src/contract.ts` |
| 4.3 Migrate `remoteok` | **DONE** | The SDK owns RemoteOK. The CLI and the engine are surfaces over it. A parity test runs the SDK against a fixture captured from the pre-migration CLI |
| 4.4 Migrate the rest | **DONE** | `remotive`, `freehire`, `unstop` and `weworkremotely` are all surfaces over the SDK. The five aggregators now have one implementation each |
| 4.5 Remove the unverified `freehire` engine adapter | **DONE** | The SDK implementation exists and is verified live. The engine's adapter now uses the board's working endpoint, so the 404 is gone |
| 4.6 Decide `arbeitnow` | **DONE** | Given a provider CLI. The SDK implementation, the engine surface and the new `arbeitnow-search` skill are all in place; the board is now visible to `/scrape` |
| 4.7 Reconcile `careers-search` and `company-scraper` | Open | |
| 4.7 Reconcile `careers-search` and `company-scraper` | **IN PROGRESS** | Greenhouse is on the SDK with the engine as a surface; four engine connectors and the CLI set remain |
| 4.8 Write the unified provider registry | Open | |
| 4.9 Update `/add-portal` | Open | |

### The migration, board by board

`remoteok` is the pattern. What the migration produced:

- **One implementation.** `applyos/packages/provider/src/remoteok.ts` is the only code that knows
  how RemoteOK works.
- **Two surfaces.** The CLI (`.agents/skills/remoteok-search/cli/src/`) and the engine
  (`applyos/packages/portals/src/remoteok.ts`) each keep only their own shape.
- **A parity oracle.** `applyos/packages/provider/tests/fixtures/remoteok-expected.json` was
  captured from the pre-migration CLI's own implementation, so the parity test compares the new
  code against what the old code actually did.
- **One deliberate change.** The CLI's `location: ""` became `location: null`, as ADR-0006
  requires. Everything else is byte-identical.
- **One engine-side change.** The retired adapter's `?tag=<query>` is a server-side tag filter,
  not a text search — it matched nothing for a multi-word query. The engine now matches the way
  the CLI does.

**The remaining four boards follow the same steps**: implement in the SDK, capture the current
CLI's output as a fixture, migrate the CLI to a surface, migrate the engine to a surface, assert
parity, then delete the old implementation.

---

## Why now

Five boards are implemented twice today, with different contracts and different parsers. The
2026-10-09 audit found contract violations in one copy that the other copy did not have, and
vice versa. The SDK is also the extension point that makes [Phase 12](../phases/phase-12-packaging-distribution.md)
possible.

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Phase 3 | hard | Complete |
| **ADR-0008** | **decision gate** | **Accepted** (2026-11-13) |
| Q5 | resolved by the Phase 4 design | Partially — the decision is made; the remaining boards are not yet migrated |

---

## Affected modules

| Path | Change |
|---|---|
| `applyos/packages/provider/` | **New** — the SDK package. `remoteok` is implemented; the other boards are not yet |
| `applyos/packages/portals/src/*.ts` | Retired as duplicated implementations. `remoteok.ts` is now a thin surface; the rest still carry their own parsers |
| `applyos/packages/company-scraper/` | Reconciled with `careers-search` |
| `.agents/skills/*/cli/src/` | Migrated to the SDK, one board at a time. `remoteok-search` is done |
| `.agents/skills/cli-shared/` | Gained the SDK's relative-path entry point |
| `.claude/commands/add-portal.md` | Updated to scaffold against the SDK |
| `applyos/packages/company-scraper/registry.yaml` | Replaced by the unified registry |

---

## Tasks

### 4.1 — Accept ADR-0008 — **DONE**

**Deliverable.** ADR-0008 moves to `accepted`. The per-board decisions from Q5 are recorded.

**What was decided.** The board order is `remoteok` → `remotive` → `weworkremotely` → `unstop` →
`freehire`, then `arbeitnow`, then the ATS connectors. `remoteok` is done; the rest follow.

### 4.2 — Build the SDK package — **DONE**

**Deliverable.** `applyos/packages/provider/` implementing the interface in
[../design/provider-sdk.md](../design/provider-sdk.md#2-the-provider-interface).

**Requirements.**
- **Zero runtime dependencies.** Done — `package.json` declares `dependencies: {}`, and the
  candidate stage type is defined locally rather than imported from `@applyos/core`.
- **Zero new build tooling.** The package is imported by relative path, exactly as
  `cli-shared` is today. This preserves ADR-0006's contribution path. The provider CLIs reach
  it at `../../../../../applyos/packages/provider/src/…`; the engine reaches it as the
  `@applyos/provider` workspace package.
- `ProviderError` with the codes from Phase 3. Done — `src/errors.ts` maps each provider error
  to the CLI code it becomes, so a surface forwards `err.cliCode` rather than re-deriving it.
- A `ProviderTestHarness` — a reusable suite that asserts the contract (the five assertions in
  [../engineering/testing.md](../engineering/testing.md#3-layer-1--contract-tests)) so every
  provider's own suite is a thin case file. Done — `src/contract.ts`, exported as
  `contractSuite(provider, fixture)`.

### 4.3 — Migrate `remoteok` first — **DONE**

**Deliverable.** The SDK implementation of remoteok; the CLI becomes a thin surface; the engine's
`portals/src/remoteok.ts` is retired.

**Verification.** A parity test runs the old and new implementations against identical fixtures
and asserts identical rows. The existing 36 CLI tests pass **unmodified**.

**Requirement.** If the parity test does not pass, the migration stops here and the design is
revisited. One board proves the pattern before ten more follow it.

**What was done.** The SDK's RemoteOK implementation lives at
`applyos/packages/provider/src/remoteok.ts`. The CLI's `helpers.ts`, `commands/search.ts` and
`commands/detail.ts` are surfaces over it; the engine's `portals/src/remoteok.ts` is a third
surface that applies the engine's row shape (`remoteok:` id prefix, ISO `postedDate`, portal
label).

The parity fixture (`applyos/packages/provider/tests/fixtures/remoteok-expected.json`) was
captured from the pre-migration CLI's own implementation against a live-captured feed, so the
test compares the new code against what the old code actually did.

**Three changes, all deliberate and all recorded in ADR-0008:**

1. The CLI's `location: ""` became `location: null`. ADR-0006 requires it; the old CLI was
   violating its own contract.
2. The CLI gave a row with no usable URL a URL built from its id; the SDK drops the row
   instead, because a URL guessed from an id is a broken link.
3. The engine's query semantics changed from the board's `?tag=` filter to the CLI's keyword
   match. `?tag=` is a tag filter, not a text search, and matched nothing for a multi-word
   query (verified live: 0 postings for `?tag=software%20engineer`, against 24 for the keyword
   match).

Every field other than `location` is byte-identical, and the parity test asserts it.

The CLI's User-Agent also changed, from a Chrome UA to `applyos/0.1 (personal use)`. The audit
recorded the Chrome-UA convention as a regression; the honest UA is answered with HTTP 200.

**What the SDK gained.** `ProviderError` with the shared vocabulary and a CLI-code mapping, a
shared fetch policy, the `contractSuite` every provider must pass, and the SDK's own tests (39).
`tools/spec_parity.py` and the error-vocabulary test were extended to cover the SDK, so a code
the SDK names cannot slip through unregistered.

### 4.4 — Migrate the remaining duplicated boards — **PARTIAL**

In order: `remotive` → `weworkremotely` → `unstop` → `freehire`.

Each migration is a separate PR with the same verification as 4.3.

**Requirement.** The CLI's *observable behaviour* must not change: the same flags, the same
envelope, the same error codes, the same exit codes. A board's quirks — `unstop`'s
`INVALID_SALARY`, `wayup`'s `--page` windowing — are preserved, not normalised away.

#### `remotive` — DONE

The SDK implementation is `applyos/packages/provider/src/remotive.ts`. The CLI and the engine
are surfaces over it.

**Remotive's public endpoint ignores its query parameters.** Verified live on 2026-11-14: the
feed answered the same 16 postings for `?search=python`, for `?search=python&limit=3`, and for
no parameters at all. Every filter is applied client-side.

**The engine's retired adapter never filtered.** It sent `search=` and relied on the board to
narrow the feed, so its results were the whole board whatever the query was. The engine now
filters the way the CLI does.

**Two deliberate changes:** an absent location or company is `null` rather than an empty string
(ADR-0006), and the User-Agent is `applyos/0.1 (personal use)` rather than a Chrome UA.

**Remotive keeps its own HTML-to-text rule.** The SDK's shared `stripHtmlTags` is RemoteOK's,
and the two boards' descriptions flatten differently. A description is read by the gates and
checked by the Grounding Audit, so its text must not change shape in a migration — the parity
test caught this.

**The parity oracle is the old CLI's own output**, across fourteen queries: no filter, a query,
a phrase, a location, a category in two spellings, a tag, three limits, a page, an age, and a
combination. The SDK reproduces every one.

#### `freehire` — DONE

The SDK implementation is `applyos/packages/provider/src/freehire.ts`. The CLI and the engine
are surfaces over it.

**The engine's source was broken.** The retired adapter asked for
`https://freehire.me/api/jobs`, which answers 404 — so every engine scrape paid a
guaranteed-failing request and reported `freehire — error: HTTP 404`. The board's agent search
endpoint is `/api/v1/agent/jobs/search`, and it answers 200 with real postings. Freehire rows
now appear in the engine's pool.

**The adapter also read fields the board does not send.** It took the row's id from `id` and
its date from `date`; the board sends `public_slug` and `posted_at`. Even with a working
endpoint it would have produced `freehire:undefined` rows.

**Freehire is a server-paging board.** It applies the filters and the paging itself, so the
SDK sends the query and returns the board's page as-is. Slicing it again would drop the second
page entirely — the contract suite caught that.

**Freehire's politeness differs from the shared policy, and is preserved.** A 429 or a 5xx is
retried seven times with a capped backoff, because the board is a personal project maintained
best-effort. A connection failure fails fast.

**The parity oracle is the old CLI's own output**, across sixteen queries, and the exact query
string the CLI sent is compared too.

#### `unstop` — DONE

The SDK implementation is `applyos/packages/provider/src/unstop.ts`. The CLI and the engine are
surfaces over it.

**Unstop has two endpoints, and the engine was using the wrong one.** Verified live on 2026-11-16:

| | `/api/public/opportunity/search-result` (the CLI's) | `/api/public/opportunity/search` (the engine's) |
|---|---|---|
| Payload | rich: `organisation`, `locations`, `jobDetail` (salary, employment type, workplace type), `details`, `filters`, `required_skills`, `updated_at` | thin: no `jobDetail`, no `details`, no `updated_at`, no `locations` array |
| Scope | one listing: `opportunity=jobs` or `opportunity=internships` | every type at once — the first page held jobs, workshops and competitions side by side |
| Text search | `searchTerm` filters: `?searchTerm=python` answered 671 matches against 10 000 unfiltered | `search` does not filter: `?search=python` reported the same 323 691 total as no query, and only reordered the results |
| Page size | 10 | 20, whatever `per_page` asked for |

**The engine's pool carried the consequences.** Before the migration, a live scrape showed
`Canva Designer | Other organization not listed here | unspecified | 2024-11-01 | internships/canva-designer-internship-quantum-dot-1195069`:
no location, a **relative** url (`public_url` is a path and the adapter used it raw), and no
relation to the query. After it, every row has a place, an absolute url and a title that matches
the query.

**The board's own politeness is preserved.** The CLI gave a hung portal 15 seconds per attempt and
three attempts; the shared policy's 20 seconds and one retry are more generous than that.

**Two conventions are translated at the surface**, as they are for the other boards:

- `--limit 0` emits **nothing** here (the CLI slices to zero), while the SDK's `0` means "no cap".
  RemoteOK's `--limit 0` means the default page size, so the meaning is per-board, not per-SDK.
- A row the board did not title: the CLI has always called it `"Untitled"`, the engine has always
  dropped it. The SDK carries the board's own title (empty when the board stated none) and each
  surface keeps its own rule.

**The parity oracle is the old CLI's own output**, across fifteen queries — no filter, three
queries, a place, a query and a place, both listings, a salary range, a salary floor, three limits,
two pages — and the exact query string the CLI sent is compared too. The lookup by id is captured
as well: the same posting, the same two-request fallback across the two listings, and the same
not-found.

#### `weworkremotely` — DONE (Phase 4.4 closed)

The SDK implementation is `applyos/packages/provider/src/weworkremotely.ts`. The CLI and the engine
are surfaces over it, and this closes 4.4: every aggregator has one implementation.

**The two parsers read different fields from the same feed.** Verified live on 2026-11-21:

| | the feed carries | the CLI read | the engine read |
|---|---|---|---|
| Employer | folded into the title (`Gusto, Inc.: Software Engineer, …`); no `dc:creator`, no `author`, and all 98 titles have a colon | the title split | `dc:creator` first — dead code — then the title split |
| Place | `<region>`, `<country>`, `<state>` | built from all three | a `<location>` tag **the feed does not carry** → every engine row came out with no place |

A live scrape before the migration showed it: `Proxify AB: Senior Backend Developer | … |
unspecified`.

**The engine's third feed does not exist.** It fetched `categories/remote-data-science-jobs.rss`, which
answers 301 — the board's categories are Full-Stack, Front-End, Back-End, DevOps and Sysadmin, Design,
Product, Management and Finance, Customer Support, Sales and Marketing, and All Other Remote. There is
no data-science category, and the per-feed error handling meant the source lost it silently. It is
replaced by the board's full listing, `remote-jobs.rss`, which is also the feed the CLI reads by
default. The three feeds barely overlap — 15 of the full listing's 97 postings appear in either category
feed — so the engine's union is 151 postings where the full listing alone is 97.

**The engine's own conventions stay.** Its id is still the guid falling back to the link; its query
filter still matches the title and the company, not the tags or the body; and it uses the engine's
outbound budget rather than the CLI's longer one, so a dead feed fails as fast as it does everywhere
else in the engine.

**WWR's politeness is preserved.** The CLI gave a hung portal 15 seconds per attempt and five attempts,
because `/scrape` must never hang on one board; the engine passes its own budget.

**The parity oracle is the old CLI's own output**, across sixteen queries — no filter, three queries, two
places, a tag, two categories, two combinations, four limits, a page — and the feed the CLI fetched is
compared too. The lookup by id and by url is captured, and the not-found.

#### `arbeitnow` — DONE (Phase 4.6)

The SDK implementation is `applyos/packages/provider/src/arbeitnow.ts`, with a provider CLI at
`.agents/skills/arbeitnow-search/` and the engine as a surface over it. The board was previously
engine-only — the one source `/scrape` could not reach.

**The board has no search.** Its single endpoint answers one document of 300 postings and ignores
query parameters, so every filter is client-side. Its `created_at` is a unix-seconds timestamp, not
an ISO string, and its place and remote flag are separate facts: 280 of the 300 rows carry a place,
14 carry `remote: true`, 20 carry neither.

**The parity oracle is the retired engine adapter's own output**, across eight queries and with the
engine's row conventions stated once in the comparison (the id prefix, "Unknown", "Untitled", and
the place the engine has always shown as "Remote").

The CLI adds `search` (keywords, place, remote-only, age, paging, three formats) and `detail`; its
14 offline tests pass, with the live smoke tests opt-in behind `APPLYOS_LIVE_TESTS`.

#### What is left in Phase 4

4.7 the `careers-search` / `company-scraper` reconciliation, 4.8 the unified provider registry, and
4.9 `/add-portal`. All six portals are done.

### 4.5 — Remove the unverified `freehire` engine adapter

**Deliverable.** `applyos/packages/portals/src/freehire.ts` is deleted and removed from
`scrape.ts`'s fan-in.

**Evidence.** `applyos/PROVENANCE.md`: *"freehire endpoint unverified, fails loudly per-source."*
It currently costs a guaranteed-failing request on every engine scrape.

**Requirement.** The SDK implementation of freehire must exist and be verified before the engine
adapter is removed — otherwise freehire simply disappears from the engine.

### 4.6 — Decide `arbeitnow` — DONE

**Decision.** Give it a CLI. It is EU-focused, which suits the `market: eu` option that
`search-queries.md` already anticipates. The alternative — an engine-only adapter invisible to
the main workflow — is the duplication ADR-0008 exists to remove.

**Delivered.** `applyos/packages/provider/src/arbeitnow.ts` is the one implementation; the engine
is a surface over it, and `.agents/skills/arbeitnow-search/` is the provider CLI. It is registered
in both permission allowlists, in `security_guards.py`, in both copies of `search-queries.md`, and
in the README. `lint_skills` reports 35 skills.

### 4.7 — Reconcile `careers-search` and `packages/company-scraper` — **IN PROGRESS**

**Deliverable.** One set of ATS connectors, exposed through two thin surfaces.

**Requirement.** `careers-search` keeps its CLI contract. `packages/company-scraper` keeps its
`JobPosting` surface. Both delegate to one connector implementation. The company registry moves
into the unified provider registry.

**This is the hardest task in the phase.** The two have different lifecycles: the CLI is
search → detail; the engine is detect → fan-out → search → detail. It is deliberately being done
after 4.3–4.6 and in reviewable stages, not in one PR.

**Stage one — DONE.** `applyos/packages/provider/src/greenhouse.ts` is the first ATS connector on
the SDK. An ATS connector is constructed with its tenant (`createGreenhouseProvider({ slug,
company })`), because the endpoint is per-board, not a singleton like the aggregators. The engine's
`company-scraper/src/connectors/greenhouse.ts` is now a surface over it and keeps its own id
prefix, ISO date, portal label, source marker and 4000-character detail cap. `company-scraper`
depends on `@applyos/provider` as a workspace package. The parity oracle was captured from the
pre-migration engine connector: eight live postings, seven queries, and the detail lookup.

**Stage two — DONE.** `applyos/packages/provider/src/lever.ts` is the second connector on the SDK,
with the engine's Lever connector as a surface over it. Lever's list already carries each body and
its additional sections, so the lookup finds the posting in the list — the engine connector's
long-standing behaviour. The parity test caught a fidelity issue: ATS bodies are stripped with the
engine's entity-first, whitespace-collapsing rule, not the aggregators' newline-preserving one, so
the SDK now has `stripAtsHtml` and both ATS connectors use it.

**Stage three — DONE.** `applyos/packages/provider/src/smartrecruiters.ts` is the third connector,
with the engine's SmartRecruiters connector as a surface over it. Two quirks are preserved: the
listing is paged by offset while reporting a separate `totalFound`, and `jobAd.sections` ships as a
keyed object on some tenants and an array on others (the captured Freshworks board uses the object
form). The SDK owns the defensive assembly; the engine keeps its `srDescription` name for callers.

**Stages remaining.** The engine's other two connectors — `workday`, `amazon` — in that order; then the CLI's connector set (`careers-search/src/connectors/`:
`amazon`, `salesforce`, `greenhouse`, `lever`, `ashby`, `smartrecruiters`, `workday`, `eightfold`),
whose three boards the engine does not have; then the company registry into the unified registry
(4.8). Each stage captures its oracle from the pre-migration connector and keeps the surface's
own row contract.

### 4.8 — Write the unified provider registry

**Deliverable.** A single registry that answers "which boards exist, what kind are they, which
markets do they serve, are they enabled".

**Requirements.**
- The `enabled: false` flag keeps its meaning (the health check's only permitted write).
- A provider that is not installed reports `skipped (not installed)` rather than failing.
- `registry.yaml` is replaced; the old path becomes a re-export during the transition.

### 4.9 — Update `/add-portal`

**Deliverable.** The spec scaffolds against the SDK instead of against `linkedin-search` as a
copy-paste reference.

**Requirement.** The portal-skill contract (ADR-0006) is **unchanged** — a contribution is still
a folder with zero runtime dependencies. Only the internal shape changes.

---

## Tests

| Suite | Change |
|---|---|
| `applyos/packages/provider/tests/` | **New** — the SDK's own tests and the shared harness |
| `.agents/skills/<board>/cli/tests/` | Unchanged in expectations; the implementation changes underneath |
| `applyos/packages/portals/tests/` | Retired as the duplicates are removed |
| `applyos/packages/company-scraper/tests/scraper.test.ts` | Extended for the shared connectors |
| `tests/test_scrape_contract.py` | Extended for the unified registry |
| `tests/test_add_portal.py` | **New** — the scaffolder produces an SDK-based provider |

---

## Acceptance criteria

- [x] ADR-0008 is `accepted`.
- [x] The SDK exists, is zero-dependency, and has a reusable contract harness.
- [ ] Every board has exactly **one** implementation, verified by a registry count.
- [x] `remoteok` is migrated with a passing parity test.
- [x] `remotive`, `weworkremotely`, `unstop`, `freehire` are migrated. — All four, plus `remoteok`,
      are surfaces over the SDK, each with a parity oracle captured from its own pre-migration CLI.
- [x] The unverified engine `freehire` adapter is gone. — Its endpoint answered 404 on every
      scrape. The SDK's freehire implementation uses the board's working endpoint, verified
      live, and freehire rows now appear in the engine's pool.
- [ ] `arbeitnow` is either a provider CLI or removed — not engine-only.
- [ ] `careers-search` and `packages/company-scraper` share one connector set.
- [x] No provider's CLI test expectations were changed to accommodate a behaviour change.
      The one changed expectation is `detail.test.ts`'s `location` — `""` → `null`, which is
      ADR-0006's rule, not a concession to the new code. The other changed file moved an
      import to the SDK, where the function now lives.
- [ ] `/add-portal` scaffolds an SDK-based provider that passes the contract harness.
- [ ] The whole suite is green on three operating systems.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A migration breaks a board that works today | medium | high | One board at a time; a parity test against the predecessor; the old implementation stays until parity passes |
| The SDK becomes a second contract that drifts from the CLI contract | medium | high | The CLI is a *surface over* the SDK, not a parallel implementation |
| The four tokenizer modes get flattened | medium | high | The modes encode observed per-CLI behaviour and are pinned by tests. The SDK must preserve them |
| The `careers-search` / `company-scraper` reconciliation is too large to review | high | medium | A separate PR, after the aggregator migrations, with its own design note |
| A third-party provider now has a broader interface to abuse | low | critical | The SDK adds no new trust; the provider already ran with the agent's file access. See [../design/plugin-architecture.md](../design/plugin-architecture.md) |
| The SDK's relative-path import breaks the CLI's zero-dependency promise | low | high | `cli-shared` already proves the pattern; no package.json change is needed |

---

## Rollback

Each board migration is an independent PR and independently revertible.

| Change | Rollback |
|---|---|
| One board's migration | Revert the PR. The old implementation returns. |
| The SDK package | Nothing depends on it except the migrated boards; revert them together |
| `freehire` removal | Re-add the adapter (it fails loudly, so it is safe) |
| `arbeitnow` | Re-add the adapter |
| The registry | The old `registry.yaml` is retained as a re-export during the transition |

---

## Definition of done

- [ ] All acceptance criteria pass in CI on three operating systems.
- [x] ADR-0008 is `accepted`.
- [ ] Q5 is closed in `docs/OPEN_QUESTIONS.md`. — **Partially**: the decision is recorded and
      `remoteok` is migrated; the remaining boards keep it open.
- [ ] `docs/IMPLEMENTATION_STATUS.md` records one implementation per board.
- [ ] `docs/CHANGE_IMPACT_MATRIX.md` §2 and §3 reflect the new ownership.
- [ ] `docs/design/provider-sdk.md` is updated with the final interface.
- [x] `CHANGELOG.md` has an `[Unreleased]` entry.

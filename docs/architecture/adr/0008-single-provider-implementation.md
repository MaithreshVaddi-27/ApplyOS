# ADR-0008: One implementation per board, behind the SDK

**Date**: 2026-11-13
**Status**: **accepted** — Phase 4 opened on this basis
**Deciders**: ApplyOS maintainers

## Context

ApplyOS currently reaches some job boards twice, through two unrelated implementations:

| Board | Provider CLI | Engine adapter |
|---|---|---|
| remoteok | `.agents/skills/remoteok-search/` | `applyos/packages/portals/src/remoteok.ts` |
| remotive | `.agents/skills/remotive-search/` | `applyos/packages/portals/src/remotive.ts` |
| weworkremotely | `.agents/skills/weworkremotely-search/` | `applyos/packages/portals/src/weworkremotely.ts` |
| unstop | `.agents/skills/unstop-search/` | `applyos/packages/portals/src/unstop.ts` |
| freehire | `.agents/skills/freehire-search/` | `applyos/packages/portals/src/freehire.ts` |
| arbeitnow | — | `applyos/packages/portals/src/arbeitnow.ts` |
| linkedin, naukri, internshala, wayup, wellfound, cutshort | ✅ | — |
| careers (8 ATS boards) | ✅ | `packages/company-scraper/` (5 boards) |

The two implementations of the same board have **different contracts**: the CLI returns
`{meta, results}` with `id/title/company/location/date/url`; the engine returns `JobPosting`
rows with `postedDate` and `source`. They have different parsers, different error semantics, and
different test suites. A fix to one does not reach the other.

Two of the duplicates are also known-defective or unverified:

- `applyos/packages/portals/src/freehire.ts` — `applyos/PROVENANCE.md` records the endpoint as
  *"unverified, fails loudly per-source"*. It is still wired into the scrape fan-in
  (`applyos/apps/cli/src/scrape.ts:113`), so every run pays a guaranteed-failing fetch.
- `arbeitnow` is EU-only and has no provider-CLI counterpart, so it is invisible to `/scrape`.

The `careers-search` overlap is partial and different in kind: the CLI exposes `search`/`detail`
over a text contract; `packages/company-scraper` exposes `JobPosting` rows plus board detection.
They share the ATS connector *logic* but not the interface.

## Decision

**Each board has exactly one implementation, behind a versioned provider SDK.**

1. A new package defines the provider contract in TypeScript:
   `search(req) → SearchPage`, `detail(ref) → JobPosting & { description }`.
2. Both consumers — the `applyos` core and the `/scrape` spec — use that SDK.
3. The existing provider CLIs remain available as a **CLI surface** over the same SDK, so
   external contributors keep a zero-dependency, copy-a-folder contribution path (ADR-0006).
4. The engine's duplicate adapters are retired once the SDK implementation is live and
   verified against the same board.
5. `freehire`'s engine adapter is **removed** until its endpoint is verified.
6. `arbeitnow` gains a provider CLI or is removed from the fan-in — one of the two, not both
   states.

## Alternatives Considered

### Alternative A (chosen): Shared SDK, one implementation per board
- **Pros**: A fix reaches every consumer. The board count becomes a single list. A new
  contributor writes one implementation, not two. The SDK becomes a real extension point
  ([../../design/provider-sdk.md](../../design/provider-sdk.md)).
- **Cons**: The SDK must be published or consumed via a relative path. Relative paths work
  in-repo (the `cli-shared` precedent) but complicate extracting the SDK for external use.
- **Why not rejected**: The `cli-shared` precedent already proves relative-path sharing works
  here.

### Alternative B: Keep the provider CLIs as the only implementations; the engine shells out to them
- **Pros**: Zero new abstraction. The CLI contract already exists and is tested.
- **Cons**: The engine would depend on a subprocess per board — slow, awkward to type, and it
  forces the engine's `JobPosting` row to be reconstructed from the CLI's text contract. It also
  makes the engine's zero-dependency promise depend on 12 directories with their own
  `package.json` files.
- **Why not**: It trades a clean type boundary for process management.

### Alternative C: The engine becomes the only implementation; the provider CLIs are retired
- **Pros**: Simplest end state — one codebase, one contract.
- **Cons**: It breaks the zero-dependency CLI contribution path that ADR-0006 deliberately
  established and that `/add-portal` scaffolds. External contributors would have to work in the
  engine monorepo.
- **Why not**: The CLI path is a genuine contributor-acquisition mechanism and the reason 12
  boards exist at all.

### Alternative D: Keep both, accept the duplication
- **Pros**: No work.
- **Cons**: Two contracts, two test suites, two parsers per board. The audit already shows this
  produces silent wrong answers.
- **Why not**: It is the status quo that motivated this ADR.

## Consequences

### Positive
- One place per board. One test suite per board.
- The provider SDK is a genuine, documented extension point — the basis for
  [../../design/plugin-architecture.md](../../design/plugin-architecture.md).
- `freehire` and `arbeitnow` stop being ambiguous: each is either verified or gone.
- The `careers-search` / `company-scraper` overlap resolves into one ATS connector set with two
  thin interfaces (CLI and SDK).

### Negative
- The SDK becomes a compatibility surface. Changing the `Provider` interface breaks twelve
  implementations — the same problem the portal-skill contract has, one level up.
- Migrating the five duplicated boards is real work with no user-visible benefit on its own.
- External contributors now learn one more layer.

### Risks
- **Migration breaks a board that currently works.** Mitigation: migrate one board first
  (remoteok is the smallest at 36 tests), verify it against the existing adapter's output on
  identical queries, and only then migrate the rest.
- **The SDK becomes a second contract that drifts from the CLI contract.** Mitigation: the CLI
  is a *surface over* the SDK, not a parallel implementation — there is one parser, one
  normalisation, one error mapping.

---

## Implementation record

### 4.3 — `remoteok` (Phase 4, 2026-11-14)

`remoteok` is the first board migrated. The shape of the migration:

| Piece | Where | What it is |
|---|---|---|
| The implementation | `applyos/packages/provider/src/remoteok.ts` | The only place that knows how RemoteOK works |
| The CLI surface | `.agents/skills/remoteok-search/cli/src/` | Flags, envelope, formatting — no board knowledge |
| The engine surface | `applyos/packages/portals/src/remoteok.ts` | The engine's row shape — no board knowledge |

**The parity oracle.** `applyos/packages/provider/tests/fixtures/remoteok-expected.json` was
captured from the **pre-migration CLI's own implementation**, running against a live-captured
feed (`remoteok-feed.json`). The parity test asserts the SDK produces the same rows. The fixture
is the record of what the CLI did before, not a description of what it should do.

**Two deliberate behaviour changes.**

1. The CLI emitted `location: ""` for a posting the board gave no place for. The SDK emits
   `null`, which is what ADR-0006 requires of the portal-skill contract ("A source that does
   not state a location yields `null`, not `""` and not `"Unknown"`").
2. The CLI gave a row with no usable URL a URL built from its id. The SDK drops the row
   instead: the board states either a URL or a slug, and a URL guessed from an id is a broken
   link.

Every other field is byte-identical, and the parity test asserts it.

**One deliberate change in the engine.** The retired engine adapter sent the query to the board
as `?tag=<query>`, which is a server-side *tag* filter, not a text search. Verified against
RemoteOK's live API on 2026-11-14: `?tag=software%20engineer` returned **0** postings, while the
keyword match the CLI uses returned **24**. The engine now matches the way the CLI does, so the
two surfaces agree on what a query means. The engine's default stage is `engine: off`, so this
path is not yet user-facing.

**The CLI's User-Agent changed.** The CLI sent a Chrome UA to impersonate a browser; the SDK
sends `applyos/0.1 (personal use)`. The 2026-10-09 audit recorded the Chrome-UA convention as a
REGRESSION, and RemoteOK's public API answers the honest UA with HTTP 200 (verified
2026-11-13, and on every run since).

**The SDK's fetch policy follows the engine's**, as
[../../design/provider-sdk.md](../../design/provider-sdk.md) §5 states: a 20 s timeout, one retry,
and the honest UA. The values are mirrored in `applyos/packages/provider/src/fetch.ts` rather
than imported, because the SDK has zero runtime dependencies and is consumed from outside the
engine workspace by the provider CLIs.

**Not yet done.** The remaining boards (`weworkremotely`, `unstop`, `freehire`),
`arbeitnow`, the `careers-search` / `company-scraper` reconciliation, the unified registry, and
`/add-portal` scaffolding are all still open. See
[../../phases/phase-04-provider-sdk.md](../../phases/phase-04-provider-sdk.md).

### 4.4 — `remotive` (Phase 4, 2026-11-14)

`remotive` is the second board migrated, and it proved two things the first board could not.

**Remotive's public endpoint ignores its query parameters.** Verified live on 2026-11-14: the
feed answered the same 16 postings for `?search=python`, for `?search=python&limit=3`, and for
no parameters at all. Every filter is applied client-side.

**So the engine's retired adapter never filtered.** It sent `search=` and relied on the board to
narrow the feed, so its results were the whole board whatever the query was. The engine now
filters the way the CLI does — a real defect fixed, not a refactor for its own sake.

**Remotive keeps its own HTML-to-text rule.** The SDK's shared `stripHtmlTags` is RemoteOK's,
and the two boards' descriptions flatten differently. A description is read by the gates and
checked by the Grounding Audit, so its text must not change shape in a migration. The parity
test caught this.

**The parity oracle is the old CLI's own output.** Two fixtures: the mapped rows, and the whole
search envelope across fourteen queries — no filter, a query, a phrase, a location, a category in
two spellings, a tag, three limits, a page, an age, and a combination. The SDK reproduces every
one.

**The CLI's error codes do not change.** This board has always reported a failed search as
`API_ERROR` and a failed detail fetch as `FETCH_ERROR`; the SDK's shared mapping says
`FETCH_ERROR` for both. The surface translates.

**The SDK's contract grew what this board needed.** `ProviderRow.company` is nullable — a board
may name no employer, and "Unknown" is not a name. `SearchRequest.extra` carries a board's own
parameters. `PostingDetail.description` is nullable and optional, so a board that states no
description says so rather than being given an empty string.

### 4.5 — `freehire` (Phase 4, 2026-11-16)

`freehire` is the third board, and the one that was actually broken.

**The engine's source never worked.** The retired adapter asked for
`https://freehire.me/api/jobs`, which answers 404, so every engine scrape paid a
guaranteed-failing request and reported `freehire — error: HTTP 404`. The board's agent search
endpoint is `/api/v1/agent/jobs/search`, and it answers 200 with real postings. Freehire rows
now appear in the engine's pool.

**The adapter also read fields the board does not send.** It took the row's id from `id` and
its date from `date`; the board sends `public_slug` and `posted_at`. Even with a working
endpoint it would have produced `freehire:undefined` rows.

**Freehire is a server-paging board.** It applies the filters and the paging itself, so the
SDK sends the query and returns the board's page as-is. Slicing it again would drop the second
page entirely — the contract suite caught that, and it is the kind of bug a row-level parity
fixture would not have found.

**Freehire's politeness differs from the shared policy, and is preserved.** A 429 or a 5xx is
retried seven times with a capped backoff, because the board is a personal project maintained
best-effort and a 429 there is transient. A connection failure fails fast: the connection is
refused now, and waiting to find out that it will be refused again is slower, not safer.
`providerFetch` gained `retryOnNetworkFailure` and `backoffCapMs` for this.

**The parity oracle is the old CLI's own output**, across sixteen queries, and the exact query
string the CLI sent is compared as well as the rows it produced.

### 4.6 — `unstop` (Phase 4, 2026-11-16)

`unstop` is the fourth board, and the first whose two surfaces disagreed about **which board
they were talking to**.

**Unstop has two public endpoints, and they are not equivalent.** Verified live on 2026-11-16:

| | `/api/public/opportunity/search-result` (the CLI's) | `/api/public/opportunity/search` (the engine's) |
|---|---|---|
| Payload | rich: `organisation`, `locations`, `jobDetail` (salary, employment type, workplace type), `details`, `filters`, `required_skills`, `updated_at` | thin: no `jobDetail`, no `details`, no `updated_at`, no `locations` array |
| Scope | one listing: `opportunity=jobs` or `opportunity=internships` | every type at once — the first page held jobs, workshops and competitions side by side |
| Text search | `searchTerm` filters: `?searchTerm=python` answered 671 matches against 10 000 unfiltered | `search` does not filter: `?search=python` reported the same 323 691 total as no query, and only reordered the results |
| Page size | 10 | 20, whatever `per_page` asked for |

**The engine's pool carried the consequences.** Before the migration a live scrape showed
`Canva Designer | Other organization not listed here | unspecified | 2024-11-01 | internships/canva-designer-internship-quantum-dot-1195069`:
no location, a **relative** url (`public_url` is a path and the adapter used it raw), and no
relation to the query. After it, every row has a place, an absolute url and a title that matches
the query.

**The board's politeness is preserved.** The CLI gave a hung portal 15 seconds per attempt and
three attempts; the shared policy's 20 seconds and one retry are more generous than that.

**Two conventions are translated at the surface**, as they are for the other boards:

- `--limit 0` emits **nothing** here (the CLI slices to zero), while the SDK's `0` means "no cap".
  RemoteOK's `--limit 0` means the default page size, so the meaning is per-board.
- A row the board did not title: the CLI has always called it `"Untitled"`, the engine has always
  dropped it. The SDK carries the board's own title (empty when the board stated none) and each
  surface keeps its own rule.

**The parity oracle is the old CLI's own output**, across fifteen queries, plus the exact query
string and the lookup-by-id path (the posting, the two-request fallback across the two listings,
and the not-found).

### 4.7 — `weworkremotely` (Phase 4, 2026-11-21)

`weworkremotely` is the fifth and last aggregator. The CLI and the engine are surfaces over it, and
Phase 4.4 is closed: every aggregator now has exactly one implementation.

**The two parsers read different fields from the same feed.** Verified live on 2026-11-21:

| | the feed carries | the CLI read | the engine read |
|---|---|---|---|
| Employer | folded into the title (`Gusto, Inc.: Software Engineer, …`); no `dc:creator`, no `author`, and all 98 titles have a colon | the title split | `dc:creator` first — dead code — then the title split |
| Place | `<region>`, `<country>`, `<state>` | built from all three | a `<location>` tag **the feed does not carry** → every engine row came out with no place |

A live scrape before the migration showed it: `Proxify AB: Senior Backend Developer | … |
unspecified`.

**The engine's third feed does not exist.** It fetched `categories/remote-data-science-jobs.rss`,
which answers 301 — the board has no data-science category — and the per-feed error handling meant the
source lost it silently. It is replaced by the board's full listing, `remote-jobs.rss`, which is also
the feed the CLI reads by default. The three feeds barely overlap (15 of the full listing's 97 postings
appear in either category feed), so the engine's union is 151 postings where the full listing alone is
97.

**The engine's own conventions stay**: its id is still the guid falling back to the link, its query
filter still matches the title and the company (not the tags or the body), and it uses the engine's
outbound budget rather than the CLI's longer one.

**WWR's politeness is preserved**: the CLI gave a hung portal 15 seconds per attempt and five attempts.

**The parity oracle is the old CLI's own output**, across sixteen queries, plus the feed it fetched and
the lookup by id and by url.

### 4.8 — `arbeitnow` (Phase 4.6, 2026-11-22)

`arbeitnow` was engine-only: its adapter was the only implementation, and it was the one source
`/scrape` could not reach. Phase 4.6 decided to give it a provider CLI rather than drop it from the
fan-in — it is EU-focused, which suits the `market: eu` option `search-queries.md` already
anticipates.

The SDK now owns the board: one JSON document of 300 postings with no search endpoint, a
unix-seconds `created_at`, and separate place and remote facts (280 rows carry a place, 14 carry
`remote: true`, 20 carry neither). The old adapter turned `remote: true` with no location into the
invented place "Remote"; the SDK keeps both facts separately and the engine applies its own rule.

The parity oracle is the retired adapter's own output across eight queries, with the engine's row
conventions stated once in the comparison. `.agents/skills/arbeitnow-search/` is the new CLI, over
the same implementation; it is registered in both permission allowlists, in `security_guards.py`,
in both copies of `search-queries.md`, and in the README. `lint_skills` reports 35 skills.

### 4.9 — ATS connectors (Phase 4.7, 2026-11-24)

All five engine connectors — `greenhouse`, `lever`, `smartrecruiters`, `workday` and `amazon` — now
have one implementation each in `applyos/packages/provider/src/`, with the engine's connectors as
surfaces. An ATS connector is
constructed with its tenant (`createGreenhouseProvider({ slug, company })`), unlike the aggregator
singletons, because its endpoint is per-board. Deliberate deviations from the retired connectors:

- **Null discipline.** A board that states no company, place or date gets `null`, not `""` or
  `"Unknown"`, as ADR-0006 requires. Each surface keeps its own id prefix, portal label, source
  marker and detail cap.
- **ATS bodies use `stripAtsHtml`.** Entities are decoded *before* tags are dropped, because boards
  such as Greenhouse ship escaped markup. The aggregators keep their newline-preserving rules.
- **SmartRecruiters `jobAd.sections` ships as a keyed object on some tenants and an array on
  others** (the captured Freshworks board uses the object form). The SDK assembles both defensively.
- **Workday caps a page at 20.** The board answers 400 to a larger page (verified live 2026-11-24),
  but the retired connector always asked for 50, so every Workday scrape failed. The SDK caps the
  request at 20 and pages by offset in the POST body; the caller's limit is unchanged.
- **Amazon has no detail endpoint.** A detail lookup is a text search for the id followed by an
  exact-id match, and the search always asks for the server's full 100-row page with the caller's
  limit applied client-side. The board's own `truncated` signals are preserved.

The CLI's eight connectors are surfaces over the same SDK. Three boards the engine does not have —
`ashby`, `salesforce` and `eightfold` — became the sixth, seventh and eighth ATS connectors in the
SDK. Their public endpoints could not be verified during capture (Ashby 401s, Salesforce's widgets
answered 503, Eightfold's tenants have no public DNS), so their oracles are the retired
connectors' own output over captured payloads. The CLI keeps its own conventions — 1200-character
descriptions, the newline-preserving text rule, "Remote" for a remote-only Ashby job, `id_icims`
for Amazon, the `tenant/site[/n]` Workday slug, per-board URL fallbacks and its detail strings —
and the SDK keeps the board's facts separate (an absent place stays null even when the job is
remote). Parity captures run with `TZ=UTC`: `bun test` runs in UTC, and Amazon's human-readable
posting dates shift a day when the oracle is captured in local time.

Each connector's parity fixture is captured from the retired connector's own output, never
hand-written.

### Still to do

4.7 the `careers-search` / `company-scraper` reconciliation, the unified registry, and
`/add-portal` scaffolding. All six portals are done. See
[../../phases/phase-04-provider-sdk.md](../../phases/phase-04-provider-sdk.md).

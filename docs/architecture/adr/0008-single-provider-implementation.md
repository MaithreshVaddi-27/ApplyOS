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

### Still to do

`weworkremotely` and `unstop`. Then `arbeitnow`, the `careers-search` /
`company-scraper` reconciliation, the unified registry, and `/add-portal` scaffolding. See
[../../phases/phase-04-provider-sdk.md](../../phases/phase-04-provider-sdk.md).

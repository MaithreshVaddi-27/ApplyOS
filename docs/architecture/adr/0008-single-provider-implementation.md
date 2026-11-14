# ADR-0008: One implementation per board, behind the SDK

**Date**: 2026-11-13
**Status**: **proposed** — requires maintainer approval before Phase 4 opens
**Deciders**: proposed by the 2026-11-13 blueprint; pending

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

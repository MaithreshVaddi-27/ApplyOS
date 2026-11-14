# Phase 4 — Provider SDK and integrations

> **Status:** `PROPOSED` · **Gate:** **ADR-0008 must be accepted** · **Depends on:** Phase 3 ·
> **Risks:** [R-03, R-04, R-05, R-14, R-19, R-24](../roadmap/risks.md) ·
> **Resolves:** [Q5](../OPEN_QUESTIONS.md#q5--which-boards-should-have-exactly-one-implementation--blocking-for-phase-4)

---

## Outcome

Each board has **exactly one implementation**, behind a versioned provider SDK, exposed through
both a CLI surface and the engine.

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
| **ADR-0008** | **decision gate** | **Open** |
| Q5 | resolved by the Phase 4 design | Open |

---

## Affected modules

| Path | Change |
|---|---|
| `applyos/packages/provider/` | **New** — the SDK package |
| `applyos/packages/portals/src/*.ts` | Retired as duplicated implementations |
| `applyos/packages/company-scraper/` | Reconciled with `careers-search` |
| `.agents/skills/*/cli/src/` | Migrated to the SDK, one board at a time |
| `.agents/skills/cli-shared/` | Gained the SDK's relative-path entry point |
| `.claude/commands/add-portal.md` | Updated to scaffold against the SDK |
| `applyos/packages/company-scraper/registry.yaml` | Replaced by the unified registry |

---

## Tasks

### 4.1 — Accept ADR-0008

**Deliverable.** ADR-0008 moves to `accepted`. The per-board decisions from Q5 are recorded.

### 4.2 — Build the SDK package

**Deliverable.** `applyos/packages/provider/` implementing the interface in
[../design/provider-sdk.md](../design/provider-sdk.md#2-the-provider-interface).

**Requirements.**
- **Zero runtime dependencies.**
- **Zero new build tooling.** The package is imported by relative path, exactly as
  `cli-shared` is today. This preserves ADR-0006's contribution path.
- `ProviderError` with the codes from Phase 3.
- A `ProviderTestHarness` — a reusable suite that asserts the contract (the five assertions in
  [../engineering/testing.md](../engineering/testing.md#3-layer-1--contract-tests)) so every
  provider's own suite is a thin case file.

### 4.3 — Migrate `remoteok` first

**Deliverable.** The SDK implementation of remoteok; the CLI becomes a thin surface; the engine's
`portals/src/remoteok.ts` is retired.

**Verification.** A parity test runs the old and new implementations against identical fixtures
and asserts identical rows. The existing 36 CLI tests pass **unmodified**.

**Requirement.** If the parity test does not pass, the migration stops here and the design is
revisited. One board proves the pattern before ten more follow it.

### 4.4 — Migrate the remaining duplicated boards

In order: `remotive` → `weworkremotely` → `unstop` → `freehire`.

Each migration is a separate PR with the same verification as 4.3.

**Requirement.** The CLI's *observable behaviour* must not change: the same flags, the same
envelope, the same error codes, the same exit codes. A board's quirks — `unstop`'s
`INVALID_SALARY`, `wayup`'s `--page` windowing — are preserved, not normalised away.

### 4.5 — Remove the unverified `freehire` engine adapter

**Deliverable.** `applyos/packages/portals/src/freehire.ts` is deleted and removed from
`scrape.ts`'s fan-in.

**Evidence.** `applyos/PROVENANCE.md`: *"freehire endpoint unverified, fails loudly per-source."*
It currently costs a guaranteed-failing request on every engine scrape.

**Requirement.** The SDK implementation of freehire must exist and be verified before the engine
adapter is removed — otherwise freehire simply disappears from the engine.

### 4.6 — Decide `arbeitnow`

**Deliverable.** Either a provider CLI (making it visible to `/scrape`) or removal from the
fan-in.

**Recommendation.** Give it a CLI. It is EU-focused, which suits the `market: eu` option that
`search-queries.md` already anticipates. The alternative — an engine-only adapter invisible to
the main workflow — is the duplication ADR-0008 exists to remove.

### 4.7 — Reconcile `careers-search` and `packages/company-scraper`

**Deliverable.** One set of ATS connectors, exposed through two thin surfaces.

**Requirement.** `careers-search` keeps its CLI contract. `packages/company-scraper` keeps its
`JobPosting` surface. Both delegate to one connector implementation. The company registry moves
into the unified provider registry.

**This is the hardest task in the phase.** The two have different lifecycles: the CLI is
search → detail; the engine is detect → fan-out → search → detail. Do **not** attempt this
migration in the same PR as 4.3–4.6.

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

- [ ] ADR-0008 is `accepted`.
- [ ] The SDK exists, is zero-dependency, and has a reusable contract harness.
- [ ] Every board has exactly **one** implementation, verified by a registry count.
- [ ] `remoteok` is migrated with a passing parity test.
- [ ] `remotive`, `weworkremotely`, `unstop`, `freehire` are migrated.
- [ ] The unverified engine `freehire` adapter is gone.
- [ ] `arbeitnow` is either a provider CLI or removed — not engine-only.
- [ ] `careers-search` and `packages/company-scraper` share one connector set.
- [ ] No provider's CLI test expectations were changed to accommodate a behaviour change.
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
- [ ] ADR-0008 is `accepted`.
- [ ] Q5 is closed in `docs/OPEN_QUESTIONS.md`.
- [ ] `docs/IMPLEMENTATION_STATUS.md` records one implementation per board.
- [ ] `docs/CHANGE_IMPACT_MATRIX.md` §2 and §3 reflect the new ownership.
- [ ] `docs/design/provider-sdk.md` is updated with the final interface.
- [ ] `CHANGELOG.md` has an `[Unreleased]` entry.

# Ecosystem map: what ApplyOS depends on, and what happens if it disappears

> Phase 12 (12.7). This is an honest dependency-inventory, not a stack recommendation. Each row
> names the maintenance surface we rely on and the concrete fallback if it were abandoned. The
> point is to know the blast radius *before* a dependency fails, not to discover it mid-job-hunt.

## Runtime dependencies

| Dependency | Type | How ApplyOS uses it | If abandoned |
|---|---|---|---|
| **Bun** | Runtime + package manager | The engine monorepo and all 12 provider CLIs; `bun test`, `bun run`, workspace linking | Rewrite the engine and CLIs for Node/Deno. The code is TypeScript with few Bun-only APIs (`bun:test`), so this is a port, not a redesign — but it is a real rewrite |
| **Python 3.10+ (stdlib only)** | Runtime for `tools/` | Every guard, checker, PDF verifier, salary tool and the fetch helpers — no pip dependency at runtime | Rewrite `tools/` in another language; the stdlib-only discipline keeps this bounded. `pyyaml` is a CI-only convenience for the lint tool |
| **TypeScript / `tsc`** | Dev-only type checker | Per-package `typecheck` scripts; never shipped at runtime | Drop static typing; the zero-runtime-dependency contract means nothing breaks at runtime, but review quality falls |

## Document toolchain

| Dependency | Type | How ApplyOS uses it | If abandoned |
|---|---|---|---|
| **`lualatex` + TeX Live** | Document compiler | Compiles every CV/resume PDF; exercised by two CI legs (current TeX Live and TeX Live 2022) | The documents need a new pipeline. ADR-0005 records why LaTeX was chosen and what would have to be replaced |
| **`moderncv`** | LaTeX class | The visual layout of both stock templates | Swap the class; templates need rework but the content pipeline survives |
| **Poppler (`pdftotext`) or `pypdf`** | PDF text extraction | `tools/verify_pdf.py` checks that every generated PDF has an extractable, ATS-readable text layer | Add another extractor behind the same verifier; the verifier's contract (min chars, page count, `contains`) is independent of the extractor |

## Distribution and CI

| Dependency | Type | How ApplyOS uses it | If abandoned |
|---|---|---|---|
| **GitHub Actions** | CI | Every gate: lint, spec conformance, security guards, docs, Python tests on three OSes, eval, LaTeX smoke, CLI checks, engine checks, dependency review | Move the checks to another runner; they are shell/Python/Bun commands, so the migration is mechanical. Actions are pinned to commit SHAs, not versions |
| **`oven-sh/setup-bun`** | CI action | Pins Bun from `applyos/.bun-version` | Replace with a direct install step; no code depends on the action itself |
| **npm registry** | Dev dependency source | `bun install` fetches TypeScript types only — no runtime dependency is ever published or consumed | Vendor the dev types or drop strict typechecking. The zero-runtime-dependency contract means the shipped CLIs keep working offline |

## Data sources (not dependencies, but a maintenance surface)

| Surface | How ApplyOS uses it | If it changes |
|---|---|---|
| 12 job boards + employer career portals | Public endpoints, fetched politely with an honest UA and per-board `url-reference.md` parsing anchors | A board's markup change breaks its parser; the `url-reference.md` exists so the fix is local. A board that closes access is replaced or dropped — the framework never bypasses a block |
| Model provider | Reads specs and reasoning steps through the runtime | ApplyOS is runtime-agnostic by design (thin-pointer, ADR-0001/0002); the candidate can switch providers, and the privacy boundary is the provider's policy, not a code dependency |

## What ApplyOS deliberately does not depend on

- **No hosted service, no server, no port, no telemetry, no background process.** Every check is
  local; `applyos doctor --check-remote` is the only opt-in call outside a job board.
- **No runtime package dependency in any provider or the SDK.** Verified by a CI guard
  (`tools/security_guards.py`, `check_zero_dependency_contracts`).
- **No live portal request in CI.** Provider tests use captured fixtures; live testing is a local,
  on-demand step. This keeps CI deterministic and polite.
- **No third-party plugin registry.** The plugin architecture explicitly defers that layer, so a
  marketplace cannot become a silent supply-chain dependency.

## Maintenance signals worth watching

1. **Bun's `bun:test` API** is the only runtime-specific test surface. A change there hits every
   suite at once; pinning the version in `.bun-version` plus SHA-pinned setup actions contains it.
2. **TeX Live version skew** — the two CI legs exist precisely because a CV compiled on current
   TeX Live can fail on TeX Live 2022 (the environment that produced a real issue). Keep both legs.
3. **A board's ToS or bot policy** is a moving maintenance surface, not a code dependency. The
   registration gate (`docs/developer/adding-a-portal.md` §5) is where a board is re-checked.
4. **External demand for a published package** — currently absent (Q6). The SDK is the first
   thing to publish *if* that changes, precisely because it is the smallest, zero-dependency
   surface.

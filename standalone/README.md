# ApplyOS Standalone (clean-room)

Greenfield, local-first job/internship finder. Public repo, zero personal data.

- `apps/cli` — unified `applyos` binary (OpenCode primary interface).
- `packages/core` — fresh contracts: types, polite fetch, robots gate, dedupe, formatters.
- `packages/company-scraper` — standalone company-careers package (Phase 2).
- `packages/portals` — one fresh adapter per board (Phase 3).
- `packages/matching` + `packages/docgen` — two-stage ranker + application factory (Phase 4).

Plan + live status: `docs/STANDALONE_REFACTOR.md` (repo root).
Provenance: `PROVENANCE.md` in this folder. Every module is clean-room,
derived from public API docs and live responses, never copied.

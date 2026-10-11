# ApplyOS CLI Engine (clean-room)

Greenfield, local-first job/internship finder. Public repo, zero personal data.

- `apps/cli` — unified `applyos` binary (OpenCode primary interface):
  `scrape` (unified fan-in), `rank` (gates + weights), `apply`
  (tailored pack, plus `--batch` for multi-posting packs).
- `packages/core` — fresh contracts: types, polite fetch, robots gate, dedupe, formatters.
- `packages/company-scraper` — company-careers package.
- `packages/portals` — one adapter per board (remoteok, remotive,
  weworkremotely, unstop, freehire, arbeitnow).
- `packages/matching` + `packages/docgen` — two-stage ranker + application factory.

Audit + fix order: `docs/AUDIT_2026-10-09.md` (repo root).
Provenance: `PROVENANCE.md` in this folder. Every module is clean-room,
derived from public API docs and live responses, never copied.

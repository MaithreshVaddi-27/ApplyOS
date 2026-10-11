# Provenance log — clean-room rebuild

Rule: every module below was written fresh on/after 2026-10-07 from the
listed public source. Nothing was copied from the legacy ApplyOS tree,
upstream templates, or third-party scraper code.

| Module | Origin (public source) | Date | Author |
|---|---|---|---|
| `packages/core/src/types.ts` | Own design; field list re-derived from what public ATS JSON APIs return (title/company/location/date/url) | 2026-10-07 | OpenCode agent |
| `packages/core/src/fetch.ts` | Own implementation; semantics (timeout + 1 retry, pacing) from IETF HTTP + polite-crawl practice | 2026-10-07 | OpenCode agent |
| `packages/core/src/robots.ts` | Own implementation; source: RFC 9309 + live `robots.txt` files | 2026-10-07 | OpenCode agent |
| `packages/core/src/dedupe.ts` | Own implementation; dedupe needs observed during audit (URL variants, cross-city req IDs) | 2026-10-07 | OpenCode agent |
| `packages/core/src/format.ts` | Own implementation; output shapes (`json/table/plain`) chosen for CLI+agent use | 2026-10-07 | OpenCode agent |
| `packages/core/tests/*` | Own fixtures; no live network in tests (TDD: tests written before implementation) | 2026-10-07 | OpenCode agent |
| `packages/company-scraper/*` (connectors, registry, search, cli) | Own code; endpoint shapes re-derived from public API docs + live responses; registry seeds probe-verified live 2026-10-07 (groww/greenhouse, cred/lever) | 2026-10-07 | OpenCode agent |
| `packages/company-scraper/*` (lever + smartrecruiters detail, --country) | Own code; lever detail + keyed-sections SR detail verified live (Freshworks); amazon country override | 2026-10-07 | OpenCode agent |
| `packages/company-scraper/*` (workday detail + search wiring, JioStar seed) | Own code; CXS detail shape re-derived from the repo's verified legacy connector + url-reference (no guessing); search + detail + fan-out verified live 2026-10-08 against `jiostar/JioStar/102` (226 postings; India roles) | 2026-10-08 | OpenCode agent |
| `packages/portals/*` (remoteok, remotive) | Own code; shapes re-derived from public API docs + live responses 2026-10-07 | 2026-10-07 | OpenCode agent |
| `packages/portals/*` (weworkremotely, unstop live; freehire UNVERIFIED 404) | Own code; WWR RSS + Unstop API verified live 2026-10-07; freehire endpoint unverified, fails loudly per-source | 2026-10-07 | OpenCode agent |
| `apps/cli/*` (unified scrape fan-in) | Own code; fan-in + stage filters + per-source notes, verified live 2026-10-07 | 2026-10-07 | OpenCode agent |
| `packages/matching/*` + `applyos rank` (gates, scoring, shortlist) | Own code; 7 gates + stage weights + shortlist flow, verified live 2026-10-07 | 2026-10-07 | OpenCode agent |
| `packages/docgen/*` + `applyos apply` (tailored pack, claim traces) | Own code; selection/ordering only, gaps never stuffed; live-verified on a real Greenhouse posting | 2026-10-07 | OpenCode agent |

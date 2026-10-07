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

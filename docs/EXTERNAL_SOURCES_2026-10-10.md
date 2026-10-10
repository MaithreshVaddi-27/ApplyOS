# External Sources Research (2026-10-10): free APIs, MCPs, crawler skills, Indian scrapers

Method: web search + live probes (single polite requests, robots-checked). Verdicts below are
evidence-backed; declined options carry reasons so nobody re-investigates without new info.

## Adopted

| Source | Evidence | Integration |
|---|---|---|
| Arbeitnow API (`arbeitnow.com/api/job-board-api`) | Live probe 2026-10-10: 325 rows, no key, robots ALLOWED; fields `slug/company_name/title/description/remote/url/tags/job_types/location/created_at` (unix seconds). Live-verify caught + fixed a real bug (numeric `created_at`). | `standalone/packages/portals/src/arbeitnow.ts` + fan-out wiring + offline tests (`arbeitnow.test.ts`) |

## Declined with evidence

| Source | Reason |
|---|---|
| JobSpy / jobspy-mcp-server (MIT, incl. naukri + linkedin + indeed) | HTML-scraping with bot-management arms race (LinkedIn 429s ~page 10, proxies required past toy volumes); PyPI stale since Jul 2025 (naukri fix only on main); no dedup. Conflicts with public-API-only ethics. Usable as parse-reference for hardening our naukri CLI, not a dependency (Python+pandas+proxies ≠ zero-dep Bun CLIs). |
| Cutshort REST API + MCP (`mcp.cutshort.io`) | Key-gated (eval API key), recruiter-side sourcing product. Can't ship keys; document as user-optional. Our `cutshort-search` CLI keeps scraping public listings. |
| jobhunter agent skill (Reddit, CDP browser scraping) | Browser-emulation scraping of LinkedIn — evasion class, permanently out of scope per scraping-ethics note. |
| Firecrawl / Apify actors (Naukri scraper, JobSpy-as-a-service) | Paid API keys; same ToS-gray scraping underneath. Decline. |
| Adzuna API (2.5k calls/mo free) | Needs personal app_id/app_key; per-job detail thin. User-keyed optional only. |
| JSearch (200 req/mo free) | Needs RapidAPI key; SERP-scrape downstream copy; prototype-sized cap. Decline. |
| Indeed official MCP | Partner-gated employer-side APIs. Decline. |
| startup.jobs / Corvi / ZipRecruiter / JobsPipe MCPs | Runtime-side integrations needing accounts/keys; framework is CLI-contract based with offline tests — external MCPs break that contract. User-optional, not repo code. |
| USAJOBS API | Fully free but US-federal-only scope. No ApplyOS market fit (India + global-remote). Decline. |

## Notes

- Per-company ATS endpoints (Greenhouse/Lever/Ashby/Workday) remain the primary free surface —
  already covered by `careers-search` + standalone `company-scraper`.
- Hirist / Cuvette / Instahyre stay declined (prior evidence in COMPANY_PORTAL_SCRAPER.md).

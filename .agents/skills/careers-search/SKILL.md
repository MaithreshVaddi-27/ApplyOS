---
name: careers-search
version: 1.0.0
description: Search job postings directly on company career portals — Amazon (amazon.jobs public API), Salesforce, and any Greenhouse / Lever / SmartRecruiters / Workday hosted board (Paytm, Meesho, CRED, Freshworks, Okta, Coinbase, MongoDB, Stripe and more seeded; add any company with one line). Covers mega-cap direct portals, Indian product companies, GCCs, and global startups hiring India-remote. Triggers on "company careers", "amazon jobs", "direct portal", "careers page jobs", "careers-search".
context: fork
allowed-tools: Bash(bun run .agents/skills/careers-search/cli/src/cli.ts *)
---

# Careers Search (company career portals)

Search postings **directly on employers' own career sites** — the listings that
never reach aggregators, often days before portals carry them. Zero runtime
dependencies, no authentication, no cookies, no bot-detection evasion.

> ⚠️ **Personal use only**: one fetch pass per company per run, per-board page
> cap (default 3), 300 ms pacing between boards. These are companies' own
> sites — keep volume at human levels.

## How it works

Eight connectors, each mapping one ATS/portal platform to the same normalized
output (`title, company, location, date, url` — the `/scrape` Step 2 contract):

| Board | Endpoint | Status |
|---|---|---|
| `amazon` | amazon.jobs public `search.json` API | **verified live** (2026-09-30) |
| `greenhouse` | boards-api.greenhouse.io boards API | **verified live** |
| `lever` | api.lever.co v0 postings API | **verified live** |
| `smartrecruiters` | api.smartrecruiters.com v1 postings API | **verified live** |
| `workday` | `<tenant>.wdN.myworkdayjobs.com` CXS API | connector ready; seeds need per-tenant slugs |
| `eightfold` | `<tenant>.eightfold.ai` apply v2 API | connector ready, **unseeded** — biggest GCC tenant (Goldman Sachs) has no public DNS (see enterprise.ts); seed a working tenant with one line |
| `salesforce` | Phenom widgets API on salesforce.my.site.com | **unverified** — returned 503 during probe; errors loudly per run |
| `ashby` | api.ashbyhq.com `non-authed` posting API | **unverified** — API answers 401 since ~2025; connector retained for URL detection (`discover`) |

Google and Microsoft careers were **evaluated and declined** — see
`docs/COMPANY_PORTAL_SCRAPER.md` ("Evaluated, not supported") for the reasons.
The shipped board set is exactly the seven rows above.

## Seeded companies (`bun run src/cli.ts companies`)

- **Mega-cap**: Amazon (India + global), Salesforce (unverified)
- **India product**: Paytm, Meesho, Zeta, Nium, Groww, CRED, Freshworks
- **Global with active India hiring**: Okta, Coinbase, Twilio, MongoDB, Coursera
- **Global startups** (many hire India-remote): Stripe, Figma, Airbnb, Databricks

All rows marked above as product/global boards were **probe-verified live**
(2026-09-30 and 2026-10-01 expansion batch — see `docs/COMPANY_PORTAL_SCRAPER.md`
for the per-board India-role counts and the declined candidates, including
Goldman Sachs Eightfold and JPMorgan Oracle ORC).

**Adding a company is one line** in `cli/src/companies.ts`: find its board URL
(`jobs.lever.co/<slug>`, `boards.greenhouse.io/<slug>`,
`jobs.smartrecruiters.com/<slug>`, or a `*.myworkdayjobs.com` tenant), add
`{ company, board, slug, region, category }`, and the next `/scrape` run picks
it up — no registration, no wiring.

## Commands

```bash
# Search every seeded board (India region) for a role
bun run .agents/skills/careers-search/cli/src/cli.ts search --region india -q "software engineer" --format table

# One mega-cap board
bun run .agents/skills/careers-search/cli/src/cli.ts search -b amazon -q "sde intern" --format table

# One company's whole board
bun run .agents/skills/careers-search/cli/src/cli.ts search -c groww --limit 50 --format json

# Internships only (students) — company portals carry SDE/analyst intern reqs
bun run .agents/skills/careers-search/cli/src/cli.ts search --region india -q "sde" --type internships --format table
bun run .agents/skills/careers-search/cli/src/cli.ts search --region india -q "sde" --stage student --format table

# Full-time only, or remote-only for the remote-global stage
bun run .agents/skills/careers-search/cli/src/cli.ts search --region india -q "backend" --type jobs --format table
bun run .agents/skills/careers-search/cli/src/cli.ts search -q "backend" --stage remote-global --format table

# Full detail for one posting (by URL — works for ANY company on a supported board)
bun run .agents/skills/careers-search/cli/src/cli.ts detail https://jobs.lever.co/cred/<uuid> --format plain
bun run .agents/skills/careers-search/cli/src/cli.ts detail 10565511 --board amazon --format plain

# Which board handles this URL?
bun run .agents/skills/careers-search/cli/src/cli.ts discover https://job-boards.greenhouse.io/groww/jobs/12345

# List the registry
bun run .agents/skills/careers-search/cli/src/cli.ts companies --format table
```

Search flags: `-q/--query`, `-l/--location` (client-side), `-b/--board`,
`-c/--company`, `--category` (mega-cap | india-product | gcc | startup),
`--region` (india | global), `--type` (jobs | internships | all),
`--stage` (student | fresher | experienced | remote-global),
`--jobage`, `--page`, `-n/--limit`,
`--max-pages`, `--format json|table|plain`.

Stage presets (same contract, one flag for every candidate type):
- `--stage student` => internships only (SDE intern, trainee, apprentice).
  Pair with `-q "intern"` or a role keyword, e.g. `-q "sde" --stage student`.
- `--stage fresher` / `--stage experienced` => all posting types; combine
  with `-q` keywords for entry-level (`trainee`, `junior`) or senior roles.
- `--stage remote-global` => remote-only rows unless `--location` is given.
- `--type internships` / `--type jobs` overrides the stage default.

**Yield and truncation honesty (read before consuming results):** the default
`--limit 20` is a *display* cap over the merged results — a board can fetch 800
postings and show 20. `meta.total` is the true matched count and `meta.truncated`
is `true` whenever anything was cut short, with a note naming which cap. For
"every possible application" runs pass `--limit 0` (all matched postings) and
`--max-pages 0` (fetch until the board is exhausted — can be slow on mega-boards;
polite 300 ms inter-page pacing applies). A fetch that hit `--max-pages` says so
per board, so a partial board is never silent. `/scrape` Step 1b's ~20-per-portal
cap is deliberate and unaffected; this matters when you invoke the CLI directly.

Errors always go to **stderr** as `{ "error": "...", "code": "..." }` with exit
code 1. A board that fails mid-search never aborts the run: it produces an
error line in the per-board status (and in `meta.boards` for `--format json`)
while the other boards' results flow through — the same behavior `/scrape`
Step 1b and Step 4.75 expect from every portal skill.

## Notes

- Detail URLs work for **any** company on a supported board, seeded or not —
  `/apply` and `/rank` can resolve a posting URL without the company being in
  the registry.
- No `detail` scraping of HTML pages: where a portal serves a JS-only shell
  (Amazon's posting pages), detail comes from the same public JSON API as
  search.
- Honesty rules apply as everywhere in this repo: results come only from real
  API responses; a board that returned nothing reports that, never a guess.

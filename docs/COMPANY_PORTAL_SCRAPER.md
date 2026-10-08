# Company-Portal Job Scraper: research, upgrades, build, and usage

**Version:** 1.1 · **Date:** 2026-09-30 (declined-boards evidence preserved 2026-10-08; retired REFACTOR_PLAN.md items U4/P5 lived here)

This document covers the newest capability of the fork: a scraper that searches **job postings directly on companies' own career portals** — Amazon, Salesforce, and any company hosted on Greenhouse, Lever, SmartRecruiters, or Workday — instead of (or alongside) the aggregator portals. It records the web research behind it, the upgrades it adds, exactly how the scraper was built, and how to start using it today.

---

## 1. Why company portals first

Aggregator portals (Naukri, LinkedIn, Internshala…) index postings hours-to-weeks after the employer publishes them, drop fields (grade, req ID, salary structure), and bury fresh roles under promoted listings. Direct portal search gives you:

1. **First-mover applications** — postings appear on the employer's own site (or its ATS) first; many Indian product companies and GCCs never cross-post to aggregators.
2. **Full-fidelity data** — requisition IDs, complete JD text, qualification sections, and team names straight from the source.
3. **Precision filtering** — one company = one board = zero cross-company noise.

The trade-off: company portals are *dispersed* (each employer, its own site). The fix is what this repo already had: a **connector per ATS platform**, not per company. Nearly every large employer hosts its careers site on one of a handful of platforms, and most of those platforms expose a public, unauthenticated JSON API. Build 7 connectors → search thousands of companies.

## 2. What the research found (2026-09-30)

The key discovery: [career-ops](https://github.com/career-ops-hq/career-ops) (open-source, MIT-style) maintains a production-tested **provider table of 80+ job boards**, including every major ATS, with endpoints verified live. Their findings this repo now builds on:

| ATS / Portal | Public endpoint | Zero-auth | Evidence |
|---|---|---|---|
| **Amazon / AWS** | `amazon.jobs/en/search.json` (+`base_query`, `country`, `offset`, `result_limit`, `sort=recent`) | ✅ | career-ops provider + live probe returning real India SDE postings |
| **Greenhouse** | `boards-api.greenhouse.io/v1/boards/<slug>/jobs` (`?content=true` for JD; detail `…/jobs/<id>`) | ✅ | live probe: Groww, Stripe, Figma, Airbnb, Databricks all answered 200 |
| **Lever** | `api.lever.co/v0/postings/<slug>?mode=json` | ✅ | live probe: CRED answered 200 |
| **SmartRecruiters** | `api.smartrecruiters.com/v1/companies/<id>/postings` (+detail `…/postings/<jobId>`) | ✅ | live probe: Freshworks answered 200 |
| **Workday** | `<tenant>.wd<N>.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs` (POST JSON; detail `…/job/<externalPath>`) | ✅ | career-ops provider; per-tenant `wd<N>` instance number varies |
| **Phenom People** (Salesforce, Verizon…) | `<brand>.my.site.com/tpAppTK__JobSearch` or `/widgets` POST | ⚠️ fragile | live probe of Salesforce's endpoint: 503 during the session |
| **Eightfold** (`<tenant>.eightfold.ai/api/apply/v2/jobs`) | ✅ but 10-row page cap | career-ops provider (Goldman Sachs runs on Eightfold) — **but see the declined row below: the flagship India-GCC tenant is not publicly resolvable** |
| **Oracle ORC** (`recruitingCEJobRequisitions`) | ✅ in general | career-ops provider (JPMorgan Chase, Amex) — **JPMC's own instance declined, see below** |
| **Ashby** (`api.ashbyhq.com/non-authed/posting-api/job-board/<slug>`) | ❌ now 401 | probed this session: `jobs.ashbyhq.com` boards render fine but the API requires auth since ~2025 |
| **Google Careers** | `careers.google.com/api/v3/search/` | ❌ gone | 404 on GET and POST; posting pages are JS-only with obfuscated `AF_initDataCallback` state, no JSON-LD |
| **Microsoft Careers** | `gcsservices.careers.microsoft.com/search/api/v1/search` | ❌ gated | requires an `APISessionId` cookie minted by the SPA; bare POST → 403 |

**Scraping-ethics note (inherited from career-ops and adopted here):** Glassdoor/Dice need stealth-browser evasion → out of scope, permanently. Where a site's `robots.txt` names AI crawlers or a Cloudflare challenge gates content, that is the owner's stated intent, not an obstacle to route around. Everything above is a *public endpoint the portals' own sites call* — used at human volume, no evasion.

### Evaluated, not supported (and why — so nobody re-investigates)

| Board | Reason | Evaluated |
|---|---|---|
| Google Careers | `/api/v3/search/` returns 404 (GET+POST); posting pages are JS-only (1.2 MB DOM, obfuscated state, no JSON-LD). Compliant access would need browser automation. | 2026-09-30 |
| Microsoft Careers | GCSServices search API requires a session cookie minted by their SPA; a bare POST returns 403. | 2026-09-30 |
| Ashby | The `non-authed` posting API now answers 401 regardless of headers/body. Boards render client-side; no compliant JSON path remains. | 2026-09-30 |
| Workday branded tenants (Flipkart) | CXS endpoint verified as the right API, but Flipkart's tenant config (`wd3`, site `Flipkart`) answered 422 — tenant-specific; connector is correct, seeds must be discovered per company. | 2026-09-30 |
| Salesforce Phenom | `salesforce.my.site.com/tpAppTK__JobSearch` returned 503 (DNS) on probe day. Connector shipped, marked **unverified**; it will surface a loud per-run error line until stable. | 2026-09-30 |
| Eightfold — Goldman Sachs | `goldmansachs.eightfold.ai` has **no public DNS A records** (Google authoritative DNS: NOERROR with zero answers; same for `tesla.eightfold.ai`) — the tenant is not publicly resolvable, likely VPN-gated. A shape-correct Eightfold connector ships in `enterprise.ts` and can be seeded with one line when a resolvable tenant is found. Do not re-investigate Goldman without new information. | 2026-10-01 |
| Oracle ORC — JPMorgan Chase | `jpmc.fa.ocs.oraclecloud.com` CX returns **503** to unauthenticated clients; `careers.jpmorgan.com/api/apply/v2/jobs` 301-redirects through locale paths into the AEM marketing site (HTML, not JSON). No compliant zero-auth JSON path remains for JPMC. | 2026-10-01 |
| SmartRecruiters ITS majors (LTIMindtree, Persistent, Zensar, Postman) | API answers 200 but `totalFound: 0` — the seeded ids are not the boards carrying their India postings. Excluded rather than shipping empty rows. | 2026-10-01 |

## 3. Upgrade list (what changed in this repo)

| # | Upgrade | Where | Status |
|---|---|---|---|
| C1 | New portal skill **`careers-search`** — 7 connectors (amazon, salesforce, greenhouse, lever, ashby†, smartrecruiters, workday) behind one CLI, one output contract | `.agents/skills/careers-search/` | ✅ built (†ashby connector retained for the day the API re-opens, but marked unverified) |
| C2 | **Company seed registry** — `companies.ts`: one line per company (mega-cap / india-product / gcc / startup categories), every seed probe-verified live before entering | same | ✅ (7 live seeds + Amazon global) |
| C3 | **URL detection** (`discover <url>`) — paste any careers URL, learn which board owns it; `/apply` and `/rank` can hand off posting URLs for detail regardless of seeding | `cli/src/detect.ts` | ✅ |
| C4 | **Allowlist pairing** — `careers-search` pre-approved in `.claude/settings.json` + `tools/security_guards.py` in the same diff (the U5 lesson applied) | both files | ✅ |
| C5 | **Politeness budget** — one fetch pass per company per run, `--max-pages` per-board cap (default 3), 300 ms inter-board pacing, 20 s timeout + single retry; no cookies, no evasion, ever | `helpers.ts` | ✅ |
| C6 | **Detail from the search API, not the HTML page** — Amazon's posting pages are JS shells; detail re-queries `search.json` by ID and returns full JD + qualifications + apply link | `connectors/enterprise.ts` | ✅ |
| C7 | **Greenhouse double-decode** — Greenhouse `content` is HTML-escaped markup (`&lt;div&gt;`); entities decoded before tag-stripping | `connectors/ats.ts` | ✅ |
| C8 | **Lever `lists` sections** — Lever keeps JD sections (`Responsibilities`, `Requirements`) in `lists[]`; detail now renders them | `connectors/ats.ts` | ✅ |
| C9 | **Per-board failure isolation** — a dead board yields a status line + `meta.boards` entry; other boards' results flow through (the `/scrape` Step 4.75 pattern) | `commands/search.ts` | ✅ |
| C10 | **Planned seeds** (next phase): more India product companies on Greenhouse/Lever; Workday tenant slugs for Walmart/Target/Adobe India; Eightfold connector for Goldman Sachs; Oracle connector for JPMorgan; Zoho (self-hosted ATS) | `companies.ts` | 📋 roadmap |

## 4. How the scraper was built (architecture)

```
.agents/skills/careers-search/
├── SKILL.md                        # portal-skill contract (frontmatter, triggers, ToS note)
└── cli/
    ├── package.json                # zero runtime deps; bun test + tsc --noEmit
    ├── tsconfig.json
    ├── src/
    │   ├── cli.ts                  # flag parsing, help, dispatch (search|detail|companies|discover)
    │   ├── types.ts                # NormalizedJob / CompanyBoard / SearchOpts / contract types
    │   ├── helpers.ts              # fetch w/ timeout+retry, HTML strip, entity decode, filters, formatters
    │   ├── companies.ts            # ← THE SEED REGISTRY (add a company = one line)
    │   ├── detect.ts               # careers-URL → board/slug/id detection
    │   ├── commands/search.ts      # runSearch (fan-out, merge, filter, page) + runDetail + runCompanies
    │   └── connectors/
    │       ├── index.ts            # BoardKind → connector registry
    │       ├── ats.ts              # greenhouse, lever, ashby, smartrecruiters
    │       └── enterprise.ts       # amazon, salesforce (phenom), workday (cxs)
    └── tests/
        ├── helpers.ts              # spawn-the-CLI test harness (same as every portal skill)
        ├── cli-flag-validation.test.ts   # 12 tests: help, unknown flags/commands, discover
        └── parsing.test.ts         # 10 tests: dates, filters, dedupe, HTML stripping
```

**Design rules baked in:**

1. **One contract.** Every connector emits `NormalizedJob { id, title, company, location, date, url }`. `date` is `null` when the source has none — never invented. This is the same contract `/scrape` Step 2 already promises for every portal CLI, so dedup, ranking, and health checks work unchanged.
2. **Fan-out, then merge.** `search` resolves the target set (by `--company` / `--board` / `--category` / `--region`, else all seeds), fetches boards **sequentially with pacing**, merges, dedupes by URL, applies client-side filters (`query`, `location`, `jobage`), then pages.
3. **Fail loud per board.** A connector error becomes a `meta.boards` entry with `ok: false` + the error string (JSON mode) or a `board: … — error: …` line (table mode). Exit code stays 0 while at least one board answered.
4. **Errors to stderr, data to stdout** — `{ "error": "...", "code": "..." }`, exit 1 (same convention as all 10 existing portal skills).

### The verified endpoint cheat-sheet

| Board | Search | Detail |
|---|---|---|
| Amazon | `GET amazon.jobs/en/search.json?base_query=<q>&country=IND&offset=0&result_limit=100&sort=recent` | same endpoint, `base_query=<job_id>` (returns full JD + qualifications) |
| Greenhouse | `GET boards-api.greenhouse.io/v1/boards/<slug>/jobs?content=true` | `GET …/boards/<slug>/jobs/<id>?content=true` |
| Lever | `GET api.lever.co/v0/postings/<slug>?mode=json` | same payload carries JD (use `description` + `lists[]`) |
| SmartRecruiters | `GET api.smartrecruiters.com/v1/companies/<id>/postings?limit=50&offset=0` | `GET …/postings/<jobId>` (`jobAd.sections[]`) |
| Workday | `POST https://<tenant>.wd<N>.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs` `{appliedFacets:{},limit,offset,searchText}` | `POST …/wday/cxs/<tenant>/<site>/job/<externalPath>` |
| Phenom (Salesforce) | `POST <brand>.my.site.com/tpAppTK__JobSearch` (widget payload, referer = careers site) | hiring site's job page or widget detail |

## 5. How to start working with it

### 5.1 From Claude Code / this repo's agent workflow

```
/scrape                    # careers-search is auto-discovered like every portal skill;
                           # its results flow into dedup, /rank, /apply unchanged
/scrape health careers-search   # probe it after any future refactor
```

Everything downstream — fit evaluation, `seen_jobs.json` provenance, the tracker — works on careers-search results with zero configuration, because the skill follows the same contract as the 10 shipped portal skills.

### 5.2 Direct CLI (today, verified live)

```bash
cd .agents/skills/careers-search/cli

# Amazon India — the flagship: every SDE/data/intern role, freshest first
bun run src/cli.ts search -b amazon -q "software engineer" --region india --format table
bun run src/cli.ts search -b amazon -q "intern" --country IND --format json   # (country is inside -b amazon)

# India product companies
bun run src/cli.ts search --region india -q "engineer" --format table

# Global startups (many India-remote)
bun run src/cli.ts search --category startup -q "backend" --format table

# Full detail on any posting (works for ANY company on a supported board)
bun run src/cli.ts detail <posting-url-or-id> [--board amazon|greenhouse|lever|smartrecruiters]

# Discover which board a URL belongs to
bun run src/cli.ts discover https://jobs.smartrecruiters.com/Freshworks/<id>
```

### 5.3 Adding companies (the part that grows coverage)

Open `cli/src/companies.ts`, find the employer's board:

1. Careers page → check the URL: `jobs.lever.co/<slug>` → `board: "lever"`, `slug: "<slug>"`. Same for `boards.greenhouse.io`, `jobs.smartrecruiters.com`. For `*.myworkdayjobs.com`, the slug is `<tenant>/<site>` (grab from the URL).
2. Probe it once (politeness): `curl -s "https://api.lever.co/v0/postings/<slug>?mode=json" | head -c 200`.
3. Add one line:
   ```ts
   { company: "Zepto", board: "greenhouse", slug: "zepto", region: "india", category: "india-product" },
   ```
4. `bun run src/cli.ts search -c zepto --limit 5 --format table` — if the board 404s, the company isn't on that ATS; try another platform or drop it.

**Rules of thumb for India coverage:** fintech/consumer startups cluster on Greenhouse + Lever; GCCs (Walmart, Target, Adobe, Goldman) live on Workday/Eightfold/Oracle; services giants (TCS, Infosys) run fully custom portals with no public API — skip them, use `linkedin-search`/`naukri-search` for those.

### 5.4 Where superpowers and gstack fit

`superpowers` and `gstack` are **external Claude Code plugin packs** — they are not files in this repo, and this workspace cannot install plugins. Two ways to use them:

**A. Install into your Claude Code (recommended):**
```bash
claude plugin marketplace add obra/superpowers-marketplace
claude plugin install superpowers
claude plugin marketplace add garrytan/gstack     # gstack
```
Then, for the next phases of this refactor, the packs' methodologies map directly:

| Task | superpowers skill to invoke | gstack skill to invoke |
|---|---|---|
| Design the Eightfold/Oracle connectors (C10) | `brainstorming` → design doc → `writing-plans` | `ceo` (prioritize), `eng-manager` (scope) |
| Build them | `test-driven-development` (red-green-refactor per connector) | `designer`→`eng` handoff, `release-manager` (ship checklist) |
| Debug a drifting endpoint (like Flipkart's 422) | `systematic-debugging`, `root-cause-tracing` | `qa` |
| Review the seed registry growth | `requesting-code-review` / `subagent-driven-development` | `eng-manager` |

**B. The in-repo equivalent (already used here):** this build followed the same methodology without the plugins — offline-test-first CLI scaffolding, live probes before seeding, per-board failure isolation, allowlist pairing in the same diff. Continue that pattern; install the packs only if you want the enforced ceremony.

## 6. Verification log (2026-09-30)

| Gate | Result |
|---|---|
| `bun run typecheck` (careers-search) | OK |
| `bun test` (careers-search) | 22 pass / 0 fail |

## 6b. Verification log — expansion batch (2026-10-01)

C10 seed growth + C11/C12 investigation, same gate discipline:

| Probe | Result |
|---|---|
| Lever: Paytm / Meesho / Zeta / Nium | ✅ 25 / 24 / 11 / 20 postings — **seeded** (india-product) |
| Greenhouse: Okta / Coinbase / Twilio / MongoDB / Coursera | ✅ boards live with India roles (Okta 108, Stripe 35, MongoDB 17, Twilio 12, Coinbase 11, Coursera 4) — **seeded** |
| Live CLI run: `-c paytm` | ✅ real Noida/Patna rows returned |
| Live CLI run: `-c okta -q india` | ✅ Bengaluru rows returned |
| Greenhouse slug guessing (Zepto, Meesho, Dream11, Swiggy, Razorpay, PhonePe…) | ❌ 404 — those companies are not on Greenhouse; Lever hits found instead where they exist |
| SmartRecruiters ITS majors | ❌ 200 but 0 postings (declined row above) |
| Eightfold Goldman Sachs | ❌ no public DNS (declined row above) |
| Oracle ORC JPMC | ❌ 503 / AEM redirect dead-end (declined row above) |
| Workday GCC tenants (Walmart wd5, Target, Adobe) | ❌ CXS 422/404 — per-tenant slug discovery still required; no GCC tenant verified |

### Declined job boards (evidence preserved 2026-10-08 from the retired `REFACTOR_PLAN.md` — do not re-propose without new information)

| Board | Probe result (2026-10-01) |
|---|---|
| Cuvette (`cuvette-search`) | ❌ `cuvette.tech` serves an unrelated product; `/job-link` 404s to plain HTTP; `app.cuvette.tech` has no DNS — no compliant endpoint without browser emulation |
| Instahyre (`instahyre-search`) | ❌ `/search-jobs/` answers 403 to plain HTTP — login-curated by design |
| Hirist (`hirist-search`) | ❌ Next.js rebuild ships empty SSR `jobfeed` (`isLoading: true`, `totalJobs: 0`) + a captcha scaffold; real feed is client-side post-hydration |
| `bunx tsc --noEmit` + `bun test` (careers-search) | OK — 30 pass / 0 fail (registry guard tests added) |

## 6c. Accuracy & yield hardening (2026-10-01)

A full-registry accuracy sweep (18 boards, live) plus the fixes it triggered:

| Check / fix | Result |
|---|---|
| Field accuracy sweep: date + location populated | ✅ 100% of returned rows across all 17 live boards carry non-empty `date` and `location` |
| Per-board fetch totals verified against the boards' own reported totals | ✅ (e.g. Okta 362/362, Databricks 879 fetched) |
| Display-cap honesty | `--limit` default 20 now reports `meta.truncated` + a note with the true `meta.total`; `--limit 0` emits every matched posting |
| Fetch-cap honesty | a board cut off by `--max-pages` gets a per-board note (page-size-aware per connector); `--max-pages 0` = fetch until exhausted |
| Inter-page politeness | 300 ms pause between pages inside every paginating connector (Greenhouse, SmartRecruiters, Amazon, Eightfold, Workday) |
| Regional Greenhouse boards | `job-boards.eu.greenhouse.io` (Groww's board) now detected — detail handoff previously failed with AMBIGUOUS_TARGET; verified fixed live |
| Amazon `/en/jobs/<id>` URLs | detection pattern fixed to accept the `en` segment |
| `--board eightfold` | CLI flag validation now includes the new board kind |
| `bun test` after hardening | 32 pass / 0 fail |

Note on `--max-pages 0`: mega-boards (Amazon global) legitimately take minutes at
polite pacing — that is the documented cost of "every posting", not a hang.
| Live probe: Amazon India search | ✅ real Bengaluru/Hyderabad SDE roles returned |
| Live probe: Amazon detail by ID | ✅ full JD + basic/preferred qualifications + apply link |
| Live probe: CRED (Lever) search + detail | ✅ JD with sections |
| Live probe: Freshworks (SmartRecruiters) search | ✅ Bengaluru roles |
| Live probe: Groww/Stripe/Figma/Airbnb/Databricks (Greenhouse) | ✅ boards live (200) |
| Live probe: Salesforce Phenom | ⚠️ 503 (marked unverified, errors loudly) |
| `tools/security_guards.py` | OK (careers-search allowlisted in both files) |
| `tools/lint_skills.py` | OK (19 skills — was 18) |
| Settings JSON validity | OK |

## 7. Next steps (ordered)

1. **Wire into a scrape run**: `/scrape` and confirm careers-search rows appear with `portal: careers-search` in `seen_jobs.json`.
2. ~~Grow the India seeds (C10)~~ — **done 2026-10-01**: 9 boards added (Paytm, Meesho, Zeta, Nium + Okta, Coinbase, Twilio, MongoDB, Coursera); declined candidates recorded in Section 2.
3. ~~Eightfold + Oracle connectors for Goldman Sachs / JPMorgan~~ — **declined 2026-10-01** with evidence (Section 2): Eightfold tenant has no public DNS; JPMC Oracle CX 503 + AEM redirect. An Eightfold connector ships ready-to-seed for any future resolvable tenant.
4. ~~`/apply` integration~~ — **done 2026-10-01**: `/apply` Step 0 now routes supported careers URLs through `careers-search discover` + `detail` before falling back to WebFetch.
5. If you install **superpowers/gstack** (Section 5.4), run the next connector build through `test-driven-development` + `requesting-code-review` for the enforced ceremony.

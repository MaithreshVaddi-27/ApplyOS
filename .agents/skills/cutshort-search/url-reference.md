# Cutshort URL & Parsing Reference

## Base URLs
- Web: `https://cutshort.io`
- Category page (search source): `https://cutshort.io/jobs/<category-slug>` — slug pattern `<skill>-jobs` (e.g. `reactjs-jobs`, `backend-developer-jobs`, `internship-jobs`); directory at `https://cutshort.io/jobs`
- Job detail: `https://cutshort.io/job/<Title-Slug>-<CitySlug>-<CompanySlug>-<8charId>` (some postings omit the city segment: `<Title>-<Company>-<Id>`)

## Access shape
Both page types are **server-rendered Next.js pages** carrying a dehydrated react-query
cache in `<script id="__NEXT_DATA__" type="application/json">`. The CLI parses that
payload — no API reverse-engineering, no browser emulation, no bot-detection evasion.
Verified live 2026-10-01 with a plain `fetch` and an honest UA string.

## Payload paths (helpers.ts `pageDataFor`)

### 1. Category page (search)
`NEXT_DATA → props.pageProps.dehydratedState.queries[]` — find the entry whose
`queryKey[0] === "jobListData"` (the second element is the category slug), then:

```
state.data.data.pageData.jobs[]      # ~50 postings (one server-side page)
state.data.data.pageData.liveJobCount  # total live postings in the category
```

There is **no crawled pagination**: one page per run, by design (politeness budget).
More coverage = more categories, not deeper crawling.

### 2. Detail page
Same tree — find the entry whose `queryKey[0] === "jobData"` (second element is the
posting slug); `state.data.data.pageData` **is** the job record.

## Job record → normalized fields

| Contract field | Source | Notes |
|---|---|---|
| `id` | `_id` | Mongo-style hex id |
| `title` | `headline` | fallback `jobFactSummary.roleTitle` |
| `company` | `companyDetails.name` | the employer, not an aggregator tag |
| `location` | `locationsText` | detail records may omit it → fall back to `jobFactSummary.locations`, then `locations[]` joined (search records carry `locationsText`, detail records carry the array — order matters) |
| `date` | `jobFactSummary.postedDate` | ISO timestamp → `YYYY-MM-DD`; `null` when absent/unparseable — never invented |
| `url` | `publicUrl` | canonical posting URL |

Extras carried for presentation: `salaryRangeText` → `salary`, `expRange{min,max}` →
`experience` ("6 - 12 yrs"), `remoteType` (`remote_not_okay` observed for
onsite/hybrid; remote variants matched defensively), `allSkills[]` → `skills` (max 10).

Detail adds `description` = `sanitizedComment` with tags stripped (HTML → readable text;
verified ~3.5KB for a real posting). No deadline field exists in the payload — `date`
semantics cover it, and `/rank`'s sweep leaves deadline-less entries alone.

## Client-side filters (search.ts)
- `--query`: substring on `title + company + skills` (lowercased)
- `--location`: substring on `location`
- `--remote`: `remoteType` starts with "remote" and is not `remote_not_okay`
- `--jobage <days>`: `date` within N days; **undated rows pass** (absence is not staleness)

## Health check (for `/scrape` Step 4.75)
Sentinel probe: `search -c reactjs-jobs --limit 3 --format json` (a query that provably
worked when the skill was registered). Failure signatures:
- `PARSE_EMPTY` / `PARSE_FAILED` → markup or payload path drifted; re-verify the
  `jobListData` / `jobData` paths above against a live page.
- `NOT_FOUND` on a known-good category → slug scheme changed; re-check the directory.
A 429 is **never** breakage evidence — record inconclusive (rate-limited) and back off.

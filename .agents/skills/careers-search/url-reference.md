# Company Career Portals URL & API Reference (careers-search)

One connector per ATS/portal platform; every connector normalizes to the same
`NormalizedJob` shape (`id, title, company, location, date, url`) — `date` is
`null` when the source has none, never invented. All endpoints are public and
unauthenticated. Board slugs/tenants come from the seed registry
(`cli/src/companies.ts`); `discover <url>` maps any careers URL to a board.

## Boards

### 1. Amazon / AWS (amazon.jobs)
- **Search:** `GET https://www.amazon.jobs/en/search.json?radius=24km&facetedLocale=true&flex_locations=[]&offset=<n>&result_limit=100&sort=recent&base_query=<query>` (`country=IND` appended for the `india` slug)
- **Response:** `{ jobs: [{ id_icims, title, company_name, normalized_location, location, posted_date, job_path, description }], error, error_details }`
- **Detail:** re-queries `search.json` by `id_icims` (posting HTML pages are JS shells)
- **URLs:** posting `https://www.amazon.jobs{job_path}`
- Status: **verified live** (2026-09-30)

### 2. Greenhouse
- **Search:** `GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true&offset=<n>`
- **Detail:** `GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs/{id}?content=true`
- **Response:** `{ jobs: [{ id, title, location: { name }, absolute_url, updated_at, content }] }` — `content` is HTML-escaped markup (`&lt;div&gt;`); entities are decoded before tag-stripping (C7)
- **URLs:** `absolute_url`, else `https://job-boards.greenhouse.io/{slug}/jobs/{id}`
- Status: **verified live**

### 3. Lever
- **Search/Detail:** `GET https://api.lever.co/v0/postings/{slug}?mode=json`
- **Response:** array of `{ id, text, categories: { location, commitment }, hostedUrl, createdAt, description, descriptionPlain, lists }` — JD sections (`Responsibilities`, `Requirements`) live in `lists[]` (C8)
- **URLs:** `hostedUrl`, else `https://jobs.lever.co/{slug}/{id}`
- Status: **verified live**

### 4. SmartRecruiters
- **Search:** `GET https://api.smartrecruiters.com/v1/companies/{slug}/postings?<params>`
- **Detail:** `GET https://api.smartrecruiters.com/v1/companies/{slug}/postings/{id}`
- **Response:** `{ content: [{ id, name, location: { city, country }, releasedDate, ... }] }`
- **URLs:** `https://jobs.smartrecruiters.com/{slug}/{id}`
- Status: **verified live**

### 5. Workday (CXS API)
- **Search/Detail:** `POST https://{tenant}.wd{N}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs` with JSON body `{ appliedFacets: {}, limit: 20, offset: <n>, searchText: <query> }`
- **Response:** `{ total, jobPostings: [{ title, externalPath, locationsText, postedOn, bulletFields }] }`
- **URLs:** `https://{tenant}.wd{N}.myworkdayjobs.com/en-US/{site}{externalPath}` (`externalPath` doubles as the board-local id)
- **Note:** connector is correct but the tenant/site pair is per company — seeds need per-tenant discovery (Flipkart's tenant answered 422 during the probe)
- Status: **connector ready; no verified seeded tenants yet**

### 6. Salesforce (Phenom widgets API)
- **Search:** `POST https://salesforce.my.site.com/tpAppTK__JobSearch` with `content-type: application/json`, `referer: https://careers.salesforce.com/en/jobs/`, body `{ query, keywords, locationOption: "2", sortBy: "POSTED_DATE", page, limit: 20, widgetFilter: ["locationMappingFilter"], ... }`
- **URLs:** `https://careers.salesforce.com/en/jobs/{id}/`
- Status: **unverified** — endpoint returned 503 during the 2026-09-30 probe; errors loudly per run rather than silently dropping

### 7. Ashby
- **Search/Detail:** `POST https://api.ashbyhq.com/non-authed/posting-api/job-board/{slug}` with `{}` body
- **Response (when it worked):** `{ jobs: [{ id, title, location, isRemote, jobUrl, publishedAt, descriptionPlain }] }`
- **URLs:** `jobUrl`, else `https://jobs.ashbyhq.com/{slug}/{id}`
- Status: **unverified** — the `non-authed` API answers 401 since ~2025; connector retained for URL detection (`discover`) for the day the API re-opens

## Evaluated, not supported
Google and Microsoft career sites are JS-only shells whose documented search
APIs are gone (Google 404, Microsoft cookie-gated 403) — see
`docs/COMPANY_PORTAL_SCRAPER.md` §"Evaluated, not supported".

## URL detection (`discover`)
`cli/src/companies.ts` `BOARD_HINTS` maps any careers URL to a board:

| URL pattern | Board |
|---|---|
| `amazon.jobs` | amazon |
| `job-boards.greenhouse.io` | greenhouse |
| `jobs.lever.co` / `jobs.eu.lever.co` | lever |
| `jobs.ashbyhq.com` | ashby |
| `jobs.smartrecruiters.com` / `careers.smartrecruiters.com` | smartrecruiters |
| `*.myworkdayjobs.com` | workday |

## Politeness budget
One fetch pass per company per run, per-board page cap (default 3), 300 ms
pacing between boards. These are employers' own sites — keep volume at human
levels.

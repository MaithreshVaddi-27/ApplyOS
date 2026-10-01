# Naukri.com URL & Parsing Reference

## Base URLs
- Web: `https://www.naukri.com`
- Search page: `https://www.naukri.com/jobs/?keyword=<query>&location=<location>&experience=<years>&salary=<range>&pageNo=<n>`
- Job detail: `https://www.naukri.com/job-listings-<slug>-<jobId>` (also reachable via any URL carrying a trailing numeric job id)

## Endpoints

### 1. Search results page (HTML)
- **URL:** `https://www.naukri.com/jobs/` + query string
- **Method:** `GET`
- **Query params:** `keyword`, `location`, `experience` (minimum years), `salary` (LPA range, e.g. `6-10`), `pageNo` (1-indexed pagination)
- **Headers:** browser-like `User-Agent` + `Accept`/`Accept-Language` (see `helpers.ts`); exponential backoff on 429/5xx, `""` on 404
- **Response Format:** HTML. Parsing strategy in `parseJobCards()` (`helpers.ts`):

#### Primary: embedded JSON state
`<script id="__NEXT_DATA__">` (or `window.__INITIAL_STATE__`) →
`data.props.pageProps.initialState.searchResult.jobDetails[]`

```json
{
  "jobId": "123456789",
  "jobTitle": "Software Engineer",
  "companyName": "Example Pvt Ltd",
  "placeholders": [
    { "type": "location", "label": "Bengaluru/Bangalore" },
    { "type": "experience", "label": "2-5 Yrs" },
    { "type": "salary", "label": "6-10 LPA" }
  ],
  "createdDate": "30 Sep 2026",
  "footerPlaceholderLabel": "+2 more",
  "jdURL": "/job-listings/software-engineer-example-123456789"
}
```

#### Fallback: HTML job-tuple containers
Results are split on `class="...srp-jobtuple-wrapper..."`, `class="...cust-job-tuple..."`, or legacy `<article class="jobTuple">`. Anchors per card (first regex that matches wins):

| Field | Anchor |
|---|---|
| Title + URL | `<a class="...title..." href="...">` (or any `href` containing `job-listings-`) |
| Job id | `data-job-id="..."` attr, else digits from the URL (`job-listings-.*?(\d{6,})` or trailing `-(\d+)`) |
| Company | `class="...comp-name..."` (`title` attr, inner text), fallbacks `subTitle`, `companyInfo` |
| Experience | `class="...exp-wrap..."` / `expwdth` / `experience` span |
| Salary | `class="...sal-wrap..."` / `salary` span / `title="N Lacs|LPA"` |
| Location | `class="...loc-wrap..."` / `locwdth` / `location` span |
| Posted date | `class="...job-post-day..."` / `date` |

Relative `href`/`jdURL` values are resolved against `https://www.naukri.com`.

### 2. Job detail page (HTML)
- **URL:** any search-result `url`, or `https://www.naukri.com/job-listings-<slug>-<id>`
- **Parsing anchors** in `parseJobDetail()` (`helpers.ts`):
  - Title: `<h1 class="...jd-header-title...">` (fallback: first `<h1>`)
  - Company: `class="...jd-header-comp-name..."` / `company-name`
  - Location / Experience / Salary: `class="location|exp|salary"` spans
  - Description: `<section class="...job-desc...">` / `dang-inner-html` / `clearboth description`
  - Key skills: `key-skill` section → `chip`-classed `<a>`/`<span>` texts (deduplicated)
  - Metadata rows: `<span>Role:</span><span>…</span>` and the same shape for `Industry Type:`, `Functional Area:`, `Employment Type:`, `Education`

## Field Mapping (search output contract)
- `id` -> `jobId` (JSON) or `data-job-id`/URL-derived id (HTML)
- `title` -> `jobTitle` / title anchor text (defaults `Untitled Role` when absent in JSON)
- `company` -> `companyName` / `comp-name` (null when absent — never invented)
- `location` -> `placeholders[type=location].label` / `loc-wrap`
- `experience`, `salary` -> matching `placeholders[].type` / card anchors (Naukri extras beyond the base contract)
- `date` -> `createdDate` (JSON) / `job-post-day` (HTML); null when absent. `--jobage` filters client-side and keeps rows without a parseable date
- `url` -> absolute `jdURL` / title-anchor href

## Client-side filters (search.ts)
- `--experience`: keeps cards whose parsed minimum years ≥ flag (cards without an experience string pass)
- `--salary "min-max"`: overlap check against parsed LPA range (cards with "Not Disclosed" pass)
- `--jobage <days>`: posted date within N days of today
- A client-side filter only applies when it leaves ≥1 result — an unparseable page is surfaced, not silently emptied

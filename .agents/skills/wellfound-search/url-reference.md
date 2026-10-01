# Wellfound (AngelList) URL Reference & Scraping Guide

## Public Role & Location Endpoints

Wellfound renders public SEO pages with Next.js SSR and embeds structured Apollo cache state into `<script id="__NEXT_DATA__">`:

- **Role + Location:** `https://wellfound.com/role/l/{role-slug}/{location-slug}`
  Example: `https://wellfound.com/role/l/software-engineer/india`
  Example: `https://wellfound.com/role/l/software-engineer/bangalore`

- **Role only:** `https://wellfound.com/role/{role-slug}`
  Example: `https://wellfound.com/role/data-scientist`

- **Location only:** `https://wellfound.com/location/{location-slug}`
  Example: `https://wellfound.com/location/india`
  Example: `https://wellfound.com/location/bangalore`

## Detail Pages

- **Job detail:** `https://wellfound.com/jobs/{id}-{slug}`
  Example: `https://wellfound.com/jobs/4662968-software-engineer`

- **Company job detail:** `https://wellfound.com/company/{startup}/jobs/{id}-{slug}`

## DOM / Data Anchors

### Search Listings (`__NEXT_DATA__`)
Inside `json.props.pageProps.apolloState.data`:
- `JobListingSearchResult`: contains `id`, `title`, `slug`, `liveStartAt`, `locationNames`, `compensation`, `remote`, `yearsExperienceMin`, `description`.
- `StartupResult`: contains `name`, `slug`, `highlightedJobListings` referencing `JobListingSearchResult:{id}`.

### Detail Pages (`application/ld+json`)
- Standard `JobPosting` schema with `title`, `hiringOrganization.name`, `jobLocation`, `datePosted`, `employmentType`, `description`.

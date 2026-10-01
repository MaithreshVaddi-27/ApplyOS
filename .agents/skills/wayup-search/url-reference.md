# WayUp URL Reference & Scraping Guide

## Public Category & Search Endpoints

WayUp renders public SEO directory pages with Next.js SSR and embeds structured listing data inside `<script id="__NEXT_DATA__">`:

- **Keyword Search:** `https://www.wayup.com/s/{listingType}/{keyword-slug}/`
  Example: `https://www.wayup.com/s/entry-level-jobs/computer-science/`
  Example: `https://www.wayup.com/s/internships/software/`

- **Location Search:** `https://www.wayup.com/s/{listingType}/_/{location-slug}/`
  Example: `https://www.wayup.com/s/entry-level-jobs/_/san-francisco-ca/`
  Example: `https://www.wayup.com/s/internships/_/remote/`

- **Keyword + Location:** `https://www.wayup.com/s/{listingType}/{keyword-slug}/{location-slug}/`
  Example: `https://www.wayup.com/s/internships/software/remote/`
  Example: `https://www.wayup.com/s/entry-level-jobs/software/new-york-ny/`

- **Taxonomy Directory:** `https://www.wayup.com/s/{listingType}/all/`

## Detail Pages

- **Job detail URL:** `https://www.wayup.com/{slug}/` or `https://www.wayup.com/i-{industry}-j-{slug}-{id}/`
  Example: `https://www.wayup.com/i-Biotechnology-j-Software-Automation-Internships-Danaher-15840404902708/`

## DOM & State Anchors

### Search Listings (`__NEXT_DATA__`)
Inside `json.props.pageProps.view.data.results`:
- Array of listing objects containing:
  - `id`: Unique numeric listing ID
  - `title` / `positionTitle`: Position title
  - `company`: Object with `name`, `logo`, `website`, `description`, `perks`
  - `geoZipCodes`: Array of `{ city, state, zip, name, fullTitle, latitude, longitude }`
  - `publicListingPage`: Full public URL
  - `slug`: Job slug
  - `jobListingType`: `entry_level`, `internship`, etc.
  - `responsibilities`: Full markdown/plain-text responsibilities
  - `qualifications`: Requirements & qualifications
  - `compensation`: Salary/hourly pay details
  - `isRemote`: Boolean flag for remote work
  - `thirdPartyApplyLink`: Direct application redirect link

### Detail Pages (`window.__data`)
- Embedded in `<script>window.__data = {...}</script>`
- Inside `data.publicBaselistingStore.byId[listingId]`:
  - `googleForJobsJsonLdMetadata`: standard `schema.org/JobPosting` object
  - `responsibilities`, `qualifications`, `company`, `geoZipCodes`, `thirdPartyApplyLink`

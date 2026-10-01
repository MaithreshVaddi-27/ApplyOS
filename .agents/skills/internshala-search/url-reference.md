# Internshala URL & Scraping Reference

## Search Endpoints

Internshala uses SEO-friendly URL paths for keyword and location searches:

- **Jobs Base URL:** `https://internshala.com/jobs/`
- **Internships Base URL:** `https://internshala.com/internships/`

### URL Patterns

1. **Keyword only:**
   `https://internshala.com/{jobs|internships}/keywords-{slug}/`
   Example: `https://internshala.com/jobs/keywords-software-developer/`

2. **Location only:**
   `https://internshala.com/{jobs|internships}/{jobs|internships}-in-{location-slug}/`
   Example: `https://internshala.com/jobs/jobs-in-bangalore/`

3. **Keyword + Location:**
   `https://internshala.com/{jobs|internships}/{slug}-{jobs|internships}-in-{location-slug}/`
   Example: `https://internshala.com/jobs/software-developer-jobs-in-bangalore/`

4. **Pagination:**
   Append `page-{n}/` to the path.
   Example: `https://internshala.com/jobs/keywords-python/page-2/`

## Detail Endpoints

- **Job detail:** `https://internshala.com/job/detail/{slug-or-id}`
- **Internship detail:** `https://internshala.com/internship/detail/{slug-or-id}`

## DOM Anchors for Scraping

### Search Results Listing
Container cards:
`<div ... class="... individual_internship ..." id="individual_internship_..." ...>`

Fields:
- **Card ID / Slug:** `id="individual_internship_(\d+)"` or extracted from `<a ... href="/(job|internship)/detail/([^"?]+)">`
- **Job Title:** `<a class="job-title-href" ...>(.*?)</a>` or `<h3 class="job-internship-name">...<a ...>(.*?)</a>`
- **Company Name:** `<p class="company-name">...<a ...>(.*?)</a>`
- **Location:** `<p class="row-1-item locations">...<a ...>(.*?)</a>` or `<div class="row-1-item locations">...<a ...>(.*?)</a>`
- **Salary / Stipend:** `<span class="desktop">...<i class="ic-16-money"></i>\s*([^<]+)</span>` or `<span class="stipend">...([^<]+)</span>`
- **Posted Date:** `<div class="status-container">...<div class="status-success">...<span>([^<]+)</span>`

### Detail Page
Container: `<div class="internship_details">` or `<div class="detail_view">`
- **Title:** `h1.heading_4_5` or `h1.profile_on_detail_page`
- **Company:** `a.link_display_like_text`
- **Salary/CTC:** `.salary_container` / `.stipend_container`
- **Job Description:** `.text-container` or `.about_company_text_container`
- **Skills:** `.round_tabs_container` or `.skills_container .round_tabs`
- **Number of Openings:** `.other_detail_item` containing "openings"

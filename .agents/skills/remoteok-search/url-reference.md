# Remote OK URL & API Reference

## Base URLs
- Web: `https://remoteok.com`
- API Endpoint: `https://remoteok.com/api`

## Endpoints

### 1. Public JSON API Feed
- **URL:** `https://remoteok.com/api`
- **Method:** `GET`
- **Headers:** `User-Agent: Mozilla/5.0 (compatible; remoteok-cli/1.0)`
- **Response Format:** JSON array where item `0` is metadata/legal notice, and subsequent items (`1...N`) are job postings.

#### Job Object Schema:
```json
{
  "id": "1137309",
  "slug": "remote-ai-response-analyst-imerit-technology-1137309",
  "epoch": 1788666444,
  "date": "2026-09-06T03:47:24+00:00",
  "company": "iMerit Technology",
  "company_logo": "...",
  "position": "AI Response Analyst",
  "tags": ["content writing", "quality assurance", "ai"],
  "description": "<h2>The work</h2><p>...</p>",
  "location": "",
  "salary_min": 20000,
  "salary_max": 20000,
  "apply_url": "https://remoteOK.com/remote-jobs/remote-ai-response-analyst-imerit-technology-1137309",
  "url": "https://remoteOK.com/remote-jobs/remote-ai-response-analyst-imerit-technology-1137309"
}
```

### 2. Job Detail Page
- **URL:** `https://remoteok.com/remote-jobs/{slug}` or `https://remoteok.com/remote-jobs/{id}`
- **Fallback extraction:** Contains JSON-LD `<script type="application/ld+json">` with `@type: "JobPosting"`.

## Field Mapping
- `id` -> `String(item.id)`
- `title` -> `item.position`
- `company` -> `item.company`
- `location` -> `item.location || "Worldwide"`
- `date` -> `item.date`
- `url` -> `item.url || "https://remoteok.com/remote-jobs/" + item.slug`
- `salary` -> Formatted range from `salary_min` & `salary_max`
- `tags` -> `item.tags`
- `description` -> HTML-stripped content from `item.description`

# Remotive URL & API Reference

## Endpoints

- **Main Website:** `https://remotive.com`
- **Developer API Endpoint:** `https://remotive.com/api/remote-jobs`
- **API Documentation:** `https://remotive.com/api-documentation`
- **Job Detail Pattern:** `https://remotive.com/remote-jobs/<category>/<slug>-<id>`

## API Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | String | Keywords / search query matching title, company, or skills |
| `category` | String | Filter by category (e.g. `software-dev`, `devops`, `qa`, `design`, `marketing`, `data`, `sales`, `product`) |
| `candidate_required_location` | String | Location filter string |
| `company_name` | String | Company name filter |
| `limit` | Integer | Max jobs returned by the API |

## Response Structure

```json
{
  "00-warning": "...",
  "0-legal-notice": "...",
  "job-count": 17,
  "total-job-count": 17,
  "jobs": [
    {
      "id": 2091101,
      "url": "https://remotive.com/remote-jobs/software-development/senior-react-full-stack-developer-2091101",
      "title": "Senior React Full-stack Developer",
      "company_name": "Lemon.io",
      "company_logo": "...",
      "company_logo_url": "...",
      "category": "Software Development",
      "tags": ["react", "node.js", "python", "fullstack"],
      "job_type": "full_time",
      "publication_date": "2026-08-27T14:36:09",
      "candidate_required_location": "LATAM, Europe, USA, Canada, APAC",
      "salary": "",
      "description": "<p>Job HTML description...</p>"
    }
  ]
}
```

## CLI Mapping & Normalization

- `id`: Converted to string.
- `title`: Extracted from `title`.
- `company`: Extracted from `company_name`.
- `location`: Extracted from `candidate_required_location` (defaults to `"Worldwide"` if empty).
- `date`: Extracted from `publication_date`.
- `url`: Direct link to listing on Remotive.
- `salary`: Normalizes empty string to `null`.
- `tags`: Array of string skill tags.
- `description`: Decodes HTML entities and strips HTML markup into clean plain text for `--format plain` / detail queries.

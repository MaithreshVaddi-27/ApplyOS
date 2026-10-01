# Unstop URL & API Reference

## Public Search REST API

Unstop provides a public search REST API allowed under their `robots.txt` (`Allow: /api/public/*`):

- **Search Endpoint:** `https://unstop.com/api/public/opportunity/search-result`
- **Method:** `GET`
- **Authentication:** None required

### Query Parameters

| Parameter | Type | Description |
|---|---|---|
| `opportunity` | string | `jobs` or `internships` |
| `searchTerm` | string | Combined query keywords and/or location |
| `page` | integer | 1-indexed page number |
| `per_page` | integer | Number of items per page (default: 10) |

## Public Detail Endpoints

- **Web URL Pattern:** `https://unstop.com/jobs/{slug}-{id}` or `https://unstop.com/internships/{slug}-{id}`
- **API Fetch:** `https://unstop.com/api/public/opportunity/search-result?searchTerm={id}` or `?opportunity=jobs&searchTerm={id}`

## Response Fields Structure

```json
{
  "data": {
    "current_page": 1,
    "total": 9631,
    "data": [
      {
        "id": 1739954,
        "public_url": "jobs/software-engineer-visheneracom-1739954",
        "title": "Software Engineer",
        "type": "jobs",
        "details": "<p>Description HTML...</p>",
        "organisation": {
          "id": 2058579,
          "name": "vishenera.com"
        },
        "locations": [
          { "city": "Varanasi", "state": "Uttar Pradesh", "country": "India" }
        ],
        "jobDetail": {
          "min_salary": 240000,
          "max_salary": 240000,
          "currency": "fa-rupee",
          "locations": ["Varanasi"],
          "type": "in_office",
          "timing": "full_time"
        },
        "required_skills": [
          { "skill_name": "Communication Skills" },
          { "skill_name": "Problem Solving" }
        ],
        "filters": [
          { "name": "Fresher", "type": "eligible" }
        ],
        "end_date": "2026-09-14T00:00:00+05:30",
        "updated_at": "2026-09-01T15:22:02+05:30"
      }
    ]
  }
}
```

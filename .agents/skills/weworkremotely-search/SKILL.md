---
name: weworkremotely-search
version: 1.0.0
description: >
  Search remote tech, software engineering, frontend, backend, DevOps, design, and product jobs
  worldwide on We Work Remotely via their official public RSS feeds. Find work-from-anywhere roles.
  Trigger phrases: we work remotely, weworkremotely jobs, search wwr remote jobs,
  find remote developer roles, work from home tech jobs, global remote job openings.
context: fork
enabled: true
allowed-tools: Bash(bun run .agents/skills/weworkremotely-search/cli/src/cli.ts *)
---

# We Work Remotely Search Skill

Search live remote job listings from **[We Work Remotely](https://weworkremotely.com)** — the largest remote work community and job board globally for software engineering, DevOps, frontend, backend, fullstack, design, product, and tech roles. Operates directly via official public RSS feeds (`https://weworkremotely.com/remote-jobs.rss`). Zero authentication required, no API keys, and **zero runtime dependencies** — runs directly with `bun`.

## ⚠️ Personal use only

This skill queries We Work Remotely's public RSS endpoints. Automated requests should be kept at low volume for personal job search use.

## When to use this skill

- Search for remote job postings by keyword, role, technology, or tag
- Filter remote jobs by location eligibility (e.g. "Worldwide", "India", "Europe", "USA", "Americas")
- Filter by category (e.g. `full-stack`, `front-end`, `back-end`, `devops`, `design`, `product`, `support`, `sales-marketing`)
- Filter by posting recency (`--jobage <days>`)
- Fetch full job descriptions, candidate region requirements, skills, and direct application links using `detail <id|url>`

## Commands

### Search job listings

```bash
bun run .agents/skills/weworkremotely-search/cli/src/cli.ts search [flags]
```

Search flags:
- `--query, -q <text>` — Keywords, job title, or skill (e.g. `"software"`, `"react"`, `"python"`, `"devops"`).
- `--location, -l <text>` — Location filter or restriction (e.g. `"worldwide"`, `"india"`, `"europe"`, `"usa"`).
- `--category <text>` — Filter by job category (e.g. `"full-stack"`, `"front-end"`, `"back-end"`, `"devops"`, `"design"`, `"product"`, `"support"`).
- `--tag <text>` — Filter specifically by tag or tech skill (e.g. `"react"`, `"aws"`, `"golang"`, `"docker"`).
- `--jobage <days>` — Only jobs posted within the last N days (e.g. `7`, `14`, `30`).
- `--page <n>` — 1-indexed page number (default `1`).
- `--limit, -n <n>` — Maximum number of results to output (default `20`).
- `--format <fmt>` — `json` (default) | `table` | `plain`.

### Fetch full job detail

```bash
bun run .agents/skills/weworkremotely-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` can be the job slug (e.g. `jfrog-senior-professional-services-devops-engineer`) or the full job URL (`https://weworkremotely.com/remote-jobs/...`).

## Usage examples

```bash
# Search for remote software engineering roles
bun run .agents/skills/weworkremotely-search/cli/src/cli.ts search -q "software engineer" --limit 5 --format table

# Search for worldwide remote developer jobs
bun run .agents/skills/weworkremotely-search/cli/src/cli.ts search -q "react" -l "worldwide" --format table

# Search for DevOps positions
bun run .agents/skills/weworkremotely-search/cli/src/cli.ts search --category "devops" --limit 5 --format table

# Output structured JSON results
bun run .agents/skills/weworkremotely-search/cli/src/cli.ts search -q "python" --limit 3 --format json

# Fetch complete job description and details
bun run .agents/skills/weworkremotely-search/cli/src/cli.ts detail jfrog-senior-professional-services-devops-engineer --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Programmatic use, scoring, and matching with full job details |
| `table` | Quick terminal scanning with ID, Title, Company, Location, and Type |
| `plain` | Reading full formatted job details and descriptions |

JSON output shape:
```json
{
  "meta": {
    "count": 5,
    "page": 1
  },
  "results": [
    {
      "id": "jfrog-senior-professional-services-devops-engineer",
      "title": "Senior Professional Services DevOps Engineer",
      "company": "JFrog",
      "location": "Anywhere in the World (🇨🇦 Canada)",
      "date": "2026-09-08T07:31:09.000Z",
      "url": "https://weworkremotely.com/remote-jobs/jfrog-senior-professional-services-devops-engineer",
      "salary": null,
      "category": "DevOps and Sysadmin",
      "jobType": "Full-Time",
      "tags": ["DevOps", "Docker", "Kubernetes", "AWS"]
    }
  ]
}
```

## Notes

- Uses We Work Remotely's official public RSS feeds at `https://weworkremotely.com/remote-jobs.rss` and category feeds.
- Listings include candidate required location/region, category tags, skills, and full posting descriptions.
- All errors are printed to `stderr` as JSON (`{"error": "...", "code": "..."}`) with exit code `1`.

---
name: remotive-search
version: 1.0.0
description: >
  Search remote tech, programming, engineering, DevOps, design, marketing, and product jobs
  worldwide on Remotive via their open developer API. Find remote and work-from-anywhere roles.
  Trigger phrases: remotive jobs, remote jobs remotive, search remotive developer jobs,
  find remote software roles, work from home tech jobs, global remote job listings.
context: fork
enabled: true
allowed-tools: Bash(bun run .agents/skills/remotive-search/cli/src/cli.ts *)
---

# Remotive Search Skill

Search live remote job listings from **[Remotive](https://remotive.com)** — a leading global platform and community for remote tech, development, DevOps, QA, product, marketing, and customer support positions. Operates directly via Remotive's official public developer API (`https://remotive.com/api/remote-jobs`). Zero authentication required, no API keys, and **zero runtime dependencies** — runs directly with `bun`.

## ⚠️ Personal use only & attribution

This skill queries Remotive's public developer API endpoint. Remotive provides this API for developers and requests attribution (mentioning Remotive as the source). Automated requests should be kept at low volume for personal job search use.

## When to use this skill

- Search for remote job postings by keyword, role, technology, or tag
- Filter remote jobs by location eligibility (e.g. "Worldwide", "APAC", "India", "Europe", "USA", "LATAM")
- Filter by category (e.g. `software-dev`, `customer-support`, `design`, `marketing`, `sales`, `product`, `devops`, `qa`, `data`, `finance-legal`, `writing`)
- Filter by posting recency (`--jobage <days>`)
- Fetch full job descriptions, salary ranges, candidate location requirements, and direct application links using `detail <id|url>`

## Commands

### Search job listings

```bash
bun run .agents/skills/remotive-search/cli/src/cli.ts search [flags]
```

Search flags:
- `--query, -q <text>` — Keywords, job title, or skill (e.g. `"software"`, `"react"`, `"python"`, `"devops"`).
- `--location, -l <text>` — Location filter or restriction (e.g. `"worldwide"`, `"india"`, `"apac"`, `"europe"`, `"usa"`).
- `--category <text>` — Filter by job category (e.g. `"software-dev"`, `"devops"`, `"qa"`, `"design"`, `"marketing"`, `"product"`, `"data"`).
- `--tag <text>` — Filter specifically by tag or tech skill (e.g. `"react"`, `"aws"`, `"golang"`, `"docker"`).
- `--jobage <days>` — Only jobs posted within the last N days (e.g. `7`, `14`, `30`).
- `--page <n>` — 1-indexed page number (default `1`).
- `--limit, -n <n>` — Maximum number of results to output (default `20`).
- `--format <fmt>` — `json` (default) | `table` | `plain`.

### Fetch full job detail

```bash
bun run .agents/skills/remotive-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` can be the numeric job ID (e.g. `2091101`) or the full job URL (`https://remotive.com/remote-jobs/software-development/...`).

## Usage examples

```bash
# Search for remote software engineering roles
bun run .agents/skills/remotive-search/cli/src/cli.ts search -q "software engineer" --limit 5 --format table

# Search for worldwide remote developer jobs
bun run .agents/skills/remotive-search/cli/src/cli.ts search -q "react" -l "worldwide" --format table

# Search for DevOps positions posted in the last 20 days
bun run .agents/skills/remotive-search/cli/src/cli.ts search --category "devops" --jobage 20 --format table

# Output structured JSON results
bun run .agents/skills/remotive-search/cli/src/cli.ts search -q "python" --limit 3 --format json

# Fetch complete job description and details
bun run .agents/skills/remotive-search/cli/src/cli.ts detail 2091101 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Programmatic use, scoring, and matching with full job details |
| `table` | Quick terminal scanning with ID, Title, Company, Location, and Salary |
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
      "id": "2091101",
      "title": "Senior React Full-stack Developer",
      "company": "Lemon.io",
      "location": "LATAM, Europe, USA, Canada, APAC",
      "date": "2026-08-27T14:36:09",
      "url": "https://remotive.com/remote-jobs/software-development/senior-react-full-stack-developer-2091101",
      "salary": null,
      "category": "Software Development",
      "jobType": "full_time",
      "tags": ["react", "node.js", "python", "fullstack", "Typescript"]
    }
  ]
}
```

## Notes

- Uses Remotive's official public developer API endpoint at `https://remotive.com/api/remote-jobs`.
- Listings include candidate required location, salary specifications (where disclosed by employers), category tags, and full posting descriptions.
- All errors are printed to `stderr` as JSON (`{"error": "...", "code": "..."}`) with exit code `1`.

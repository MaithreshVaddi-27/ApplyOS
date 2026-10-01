---
name: remoteok-search
version: 1.1.0
description: >
  Search remote tech, programming, engineering, design, marketing, and startup jobs
  globally via the Remote OK public API. Find fully remote opportunities worldwide
  and in specific regions. Includes experience filtering (minimum years) and salary 
  filtering (minimum USD). Trigger phrases: remote job search, remote developer jobs,
  find work from home tech jobs, remote programming roles, remoteok jobs, look up
  remote job listing.
context: fork
enabled: true
allowed-tools: Bash(bun run .agents/skills/remoteok-search/cli/src/cli.ts *)
---

# Remote OK Search Skill

Search live remote job listings from **[Remote OK](https://remoteok.com)** — one of the largest and most popular platforms for remote software, technology, design, product, and startup positions globally. Zero authentication required, no API keys, and **zero runtime dependencies** — runs directly with `bun`.

## ⚠️ Personal use only

This skill queries Remote OK's public API endpoints. Remote OK requires attribution when displaying listings. Automated requests should be kept at low volume for personal job search use.

## When to use this skill

- Search for remote job postings by keyword, role, technology, or tag
- Filter remote jobs by location eligibility (e.g. "Worldwide", "US", "Europe", "LATAM", "Asia", "India")
- Filter by posting recency (`--jobage <days>`)
- Fetch full job descriptions, salary ranges, required tags, and direct application links using `detail <id|url>`

## Commands

### Search job listings

```bash
bun run .agents/skills/remoteok-search/cli/src/cli.ts search [flags]
```

Search flags:
- `--query, -q <text>` — Keywords, job title, or skill (e.g. `"software"`, `"python"`, `"react"`, `"ai"`, `"product manager"`).
- `--location, -l <text>` — Location filter or restriction (e.g. `"Worldwide"`, `"India"`, `"US"`, `"Europe"`, `"APAC"`).
- `--tag <text>` — Filter specifically by tag / category (e.g. `"dev"`, `"engineer"`, `"design"`, `"marketing"`).
- `--jobage <days>` — Only jobs posted within the last N days (e.g. `7`, `14`, `30`).
- `--page <n>` — 1-indexed page number (default `1`).
- `--limit, -n <n>` — Maximum number of results to output (default all matches).
- `--format <fmt>` — `json` (default) | `table` | `plain`.

### Fetch full job detail

```bash
bun run .agents/skills/remoteok-search/cli/src/cli.ts detail <id|slug|url> [--format json|plain]
```

`id` can be the numeric job ID (e.g. `1137309`), the full slug (e.g. `remote-ai-response-analyst-imerit-technology-1137309`), or the full job URL (`https://remoteok.com/remote-jobs/...`).

## Usage examples

```bash
# Search for remote software engineering roles
bun run .agents/skills/remoteok-search/cli/src/cli.ts search -q "software engineer" --limit 5 --format table

# Search for Python developer jobs posted in the last 14 days
bun run .agents/skills/remoteok-search/cli/src/cli.ts search -q "python" --jobage 14 --format table

# Search for worldwide remote React jobs
bun run .agents/skills/remoteok-search/cli/src/cli.ts search -q "react" -l "worldwide" --format table

# Output search results as structured JSON
bun run .agents/skills/remoteok-search/cli/src/cli.ts search -q "full stack" --limit 3 --format json

# Fetch complete job details and description
bun run .agents/skills/remoteok-search/cli/src/cli.ts detail 1137309 --format plain
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
      "id": "1137309",
      "title": "AI Response Analyst",
      "company": "iMerit Technology",
      "location": "Worldwide",
      "date": "2026-09-06T03:47:24+00:00",
      "url": "https://remoteok.com/remote-jobs/remote-ai-response-analyst-imerit-technology-1137309",
      "salary": "$20,000 / year",
      "tags": ["content writing", "quality assurance", "ai"]
    }
  ]
}
```

## Notes

- Uses Remote OK's public API feed at `https://remoteok.com/api` and HTML detail fallback.
- If a listing has no specific location restriction specified, location defaults to `"Worldwide"`.
- All errors are printed to `stderr` as JSON (`{"error": "...", "code": "..."}`) with exit code `1`.

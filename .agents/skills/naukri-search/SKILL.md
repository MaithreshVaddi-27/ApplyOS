---
name: naukri-search
version: 1.1.0
description: Search for experienced professional jobs across India on Naukri.com, India's largest job portal for mid-senior level roles. Covers IT, software, data science, engineering, finance, marketing, and other sectors in Bangalore, Hyderabad, Pune, Mumbai, Delhi NCR, Chennai, and remote roles. Triggers on "naukri", "naukri jobs", "naukri search", "jobs in India", "experienced jobs India", "mid level jobs India", "senior jobs India".
context: fork
allowed-tools: Bash(bun run .agents/skills/naukri-search/cli/src/cli.ts *)
---
# Naukri Search Skill

Search live job listings from Naukri.com for **India** — focused on experienced professional and mid-senior level roles. No authentication required for basic search, zero runtime dependencies — it runs with just `bun`.

> **⚠️ Personal use only**: Naukri.com may have access restrictions — keep volume low and use only for personal job search. For heavy usage, consider using their official API if available.
>
> **Bot-gating note**: Naukri's search pages are JS shells with no server-rendered
> postings and its JSON API is recaptcha-gated by IP, so `search` fails loudly with
> `SEARCH_BLOCKED`/`SEARCH_FAILED` (never a silent empty board) when it cannot read
> results. On those runs fall back to WebSearch `site:naukri.com` queries; `detail`
> on a known posting URL is unaffected.

## When to use this skill

- Search for experienced professional job openings in Indian cities
- Filter by experience level, salary range, and industry
- Get the full description of a specific Naukri job listing
- Search for roles in specific Indian tech hubs (Bangalore, Hyderabad, Pune, etc.)

## Commands

### Search job listings

```bash
bun run .agents/skills/naukri-search/cli/src/cli.ts search --location "<place>" [flags]
```

Key flags:
- `--location <text>` / `-l <text>` — Location filter (e.g. `"Bangalore"`, `"Hyderabad"`, `"Pune"`, `"Delhi NCR"`, `"Mumbai"`, `"Chennai"`, `"Remote"`). Optional but recommended.
- `--query <text>` / `-q <text>` — keyword search (title, skill, company, role). Highly recommended.
- `--experience <years>` — Minimum years of experience (e.g. `2`, `5`, `10`). Maps to Naukri's experience filter.
- `--salary <range>` — Salary range in lakhs per annum (e.g. `"6-10"`, `"15-25"`). Optional.
- `--jobage <days>` — posted within N days: `1`, `3`, `7`, `15`, `30`. Omit for all postings.
- `--page <n>` — page number (1-indexed).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/naukri-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the job ID from `search` results. You may also pass a full Naukri job URL. Returns the full description, key skills, experience required, salary, company details, and application details.

## Usage examples

```bash
# Software engineer roles in Bangalore with 3+ years experience
bun run .agents/skills/naukri-search/cli/src/cli.ts search -q "software engineer" -l "Bangalore" --experience 3 --format table

# Data scientist roles in Hyderabad, last 7 days
bun run .agents/skills/naukri-search/cli/src/cli.ts search -q "data scientist" -l "Hyderabad" --jobage 7 --format table

# Product manager roles in Pune, salary 15-25 LPA
bun run .agents/skills/naukri-search/cli/src/cli.ts search -q "product manager" -l "Pune" --salary "15-25" --format table

# Senior developer roles, remote
bun run .agents/skills/naukri-search/cli/src/cli.ts search -q "senior developer" -l "Remote" --experience 5 --format table

# Full details for a specific job
bun run .agents/skills/naukri-search/cli/src/cli.ts detail <job-id> --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data is from Naukri.com's public job listings — no credentials required for basic search.
- Experience filtering works for ranges like "0-1", "1-3", "3-5", "5-7", "7-10", "10+" years.
- Salary filtering uses lakhs per annum (LPA) - common format in Indian job postings.
- Naukri may implement rate limiting or bot detection; keep search volume reasonable.
- Job IDs are typically alphanumeric strings - pass them as-is to `detail`.
- For best results with Naukri, use specific location names like "Bangalore, Karnataka" rather than just "Bangalore" when possible.
---
name: wellfound-search
version: 1.1.1
description: Search startup and tech jobs on Wellfound (formerly AngelList Talent) across India (Bangalore, Mumbai, Pune, Hyderabad, Delhi NCR, remote), the US, and globally. Covers engineering, product, data, AI/ML, design, and growth roles at high-growth startups and tech companies. Includes experience filtering and salary filtering. Triggers on "wellfound", "wellfound jobs", "angellist", "angellist talent", "startup jobs India", "startup jobs Bangalore".
context: fork
allowed-tools: Bash(bun run .agents/skills/wellfound-search/cli/src/cli.ts *)
---

# Wellfound (AngelList Talent) Search

Search startup jobs, early-stage engineering roles, and AI/tech opportunities on Wellfound's public listings. Zero runtime dependencies, no authentication required.
Includes experience filtering (minimum years) and salary filtering (minimum USD).

> ⚠️ **Personal use only**: Keep request volume low. Designed for targeted personal job searching.

## Quick Start

```bash
# Search for software engineering startup jobs in Bangalore
bun run .agents/skills/wellfound-search/cli/src/cli.ts search -q "software engineer" -l "Bangalore" --format table

# Search for AI/ML startup jobs in India
bun run .agents/skills/wellfound-search/cli/src/cli.ts search -q "machine learning" -l "India" --limit 5 --format table

# Search for senior software engineer roles with 3+ years experience and $100k+ salary
bun run .agents/skills/wellfound-search/cli/src/cli.ts search -q "software engineer" -l "India" --experience 3 --salary 100000 --format table

# View details of a specific job by ID or URL
bun run .agents/skills/wellfound-search/cli/src/cli.ts detail 4662968-software-engineer --format plain
bun run .agents/skills/wellfound-search/cli/src/cli.ts detail https://wellfound.com/jobs/4662968-software-engineer
```

## Commands & Flags

### `search`
Search startup jobs with role, keywords, and location filters.

| Flag | Shorthand | Description | Default |
|---|---|---|---|
| `--query <text>` | `-q` | Role or keywords (e.g. `"software engineer"`, `"frontend"`, `"ai"`) | `"software-engineer"` |
| `--location <text>` | `-l` | Location (e.g. `"Bangalore"`, `"Pune"`, `"Mumbai"`, `"India"`) | `"india"` |
| `--experience <years>` | `-e` | Minimum years of experience (e.g. 0, 1, 2, 3, 5) | none |
| `--salary <usd>` | `-s` | Minimum salary in USD (e.g. 80000, 120000) | none |
| `--page <n>` | | Page number (1-indexed) | `1` |
| `--limit <n>` | `-n` | Maximum number of results to display | all |
| `--format <fmt>` | | Output format: `json`, `table`, or `plain` | `json` |

### `detail <id|url>`
Fetch full job description and startup information.

| Flag | Description | Default |
|---|---|---|
| `--format <fmt>` | Output format: `json` or `plain` | `json` |

## Examples

```bash
# Search for frontend engineering startup roles in Bangalore
bun run .agents/skills/wellfound-search/cli/src/cli.ts search -q "frontend" -l "Bangalore" --limit 10 --format table

# Search for Product Manager startup jobs in India
bun run .agents/skills/wellfound-search/cli/src/cli.ts search -q "product manager" -l "India" --format table

# View full description for a job listing
bun run .agents/skills/wellfound-search/cli/src/cli.ts detail 4662968-software-engineer --format plain
```

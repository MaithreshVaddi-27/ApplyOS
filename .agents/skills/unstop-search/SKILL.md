---
name: unstop-search
version: 1.3.0
description: Search jobs, hiring challenges, and internships across India on Unstop (formerly Dare2Compete). Covers technology, software engineering, analytics, marketing, product, and business roles across Bangalore, Hyderabad, Delhi NCR, Mumbai, Pune, and pan-India remote. Includes salary-range and posting-age filtering. Triggers on "unstop", "unstop jobs", "unstop internships", "unstop hiring challenges", "hackathons jobs India".
context: fork
allowed-tools: Bash(bun run .agents/skills/unstop-search/cli/src/cli.ts *)
---

# Unstop Search

Search jobs, internships, and hiring challenges across India via Unstop's public API. Zero runtime dependencies, no authentication required.

> ⚠️ **Personal use only**: Keep volume reasonable. For personal job search use.

## Quick Start

```bash
# Search for software engineering jobs in Bangalore
bun run .agents/skills/unstop-search/cli/src/cli.ts search -q "software developer" -l "Bangalore" --format table

# Search for data science internships
bun run .agents/skills/unstop-search/cli/src/cli.ts search -q "data science" --type internships --limit 5 --format table

# View details of a specific job by ID or URL
bun run .agents/skills/unstop-search/cli/src/cli.ts detail 1739954 --format plain
bun run .agents/skills/unstop-search/cli/src/cli.ts detail https://unstop.com/jobs/software-engineer-visheneracom-1739954
```

## Commands & Flags

### `search`
Search opportunities with optional keyword, location, and type filters.

| Flag | Shorthand | Description | Default |
|---|---|---|---|
| `--query <text>` | `-q` | Search keywords (e.g. `"full stack"`, `"python"`) | none |
| `--location <text>` | `-l` | Location / city name (e.g. `"Bangalore"`, `"Hyderabad"`) | none |
| `--type <type>` | `-t` | Listing type: `jobs` or `internships` | `jobs` |
| `--salary <range>` | | Stipend/salary range in LPA (e.g. `"4-8"`); cards without a listed range pass |
| `--page <n>` | | Page number (1-indexed) | `1` |
| `--jobage <days>` | | Posted within N days (relative-date aware); cards with unknown age pass |
| `--limit <n>` | `-n` | Maximum number of results to display | all |
| `--format <fmt>` | | Output format: `json`, `table`, or `plain` | `json` |

### `detail <id|url>`
Fetch full opportunity details (description, requirements, skills, CTC/stipend, deadline).

| Flag | Description | Default |
|---|---|---|
| `--format <fmt>` | Output format: `json` or `plain` | `json` |

## Output contract

Every row carries: `id`, `title`, `company`, `location`, `date` (ISO, from `updated_at`), `url`, `salary` (formatted only when the poster filled one in), `type`, plus `employmentType` (`jobDetail.timing`: part_time/full_time) and `workplaceType` (`jobDetail.type`: wfh/hybrid) so remote and part-time rows filter without a detail fetch. `detail` adds `deadline` (ISO), `skills`, `eligibility`, and the full `description`.

## Examples

```bash
# Search for frontend developer jobs
bun run .agents/skills/unstop-search/cli/src/cli.ts search -q "frontend" --limit 10 --format table

# Search for AI/ML internships
bun run .agents/skills/unstop-search/cli/src/cli.ts search -q "machine learning" --type internships --format table

# View details for a listing
bun run .agents/skills/unstop-search/cli/src/cli.ts detail 1739954 --format plain
```

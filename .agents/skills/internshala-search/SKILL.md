---
name: internshala-search
version: 1.3.0
description: Search jobs, fresh graduate roles, and internships across India on Internshala. Covers tech, engineering, data science, product, and business roles in Bangalore, Delhi NCR, Mumbai, Pune, Hyderabad, Chennai, and remote. Includes posting-age filtering (`--jobage`) with client-side query-relevance scoring. Triggers on "internshala", "internshala jobs", "internshala internships", "internships in India", "fresh graduate jobs India", "entry level jobs India".
context: fork
allowed-tools: Bash(bun run .agents/skills/internshala-search/cli/src/cli.ts *)
---

# Internshala Search

Search job listings and internships across India using Internshala's public search pages. Zero runtime dependencies, no authentication required.

> ⚠️ **Personal use only**: Keep request volume low. Designed for targeted personal job searching.

## Quick Start

```bash
# Search for software engineering jobs in Bangalore
bun run .agents/skills/internshala-search/cli/src/cli.ts search -q "software engineer" -l "Bangalore" --format table

# Search for data science internships
bun run .agents/skills/internshala-search/cli/src/cli.ts search -q "data science" --type internships --limit 5 --format table

# View details of a specific job
bun run .agents/skills/internshala-search/cli/src/cli.ts detail <id-or-url> --format plain
```

## Commands & Flags

### `search`
Search job postings or internships with optional keyword, location, and type filters.

| Flag | Shorthand | Description | Default |
|---|---|---|---|
| `--query <text>` | `-q` | Search keywords (e.g. `"backend developer"`, `"python"`) | none |
| `--location <text>` | `-l` | Location / city name (e.g. `"Bangalore"`, `"Hyderabad"`, `"Delhi"`) | none |
| `--type <type>` | `-t` | Listing type: `jobs` or `internships` | `jobs` |
| `--page <n>` | | Page number (1-indexed) | `1` |
| `--jobage <days>` | | Posted within N days (relative-date aware: "3 days ago") | all |
| `--limit <n>` | `-n` | Maximum number of results to display | all |
| `--format <fmt>` | | Output format: `json`, `table`, or `plain` | `json` |

### `detail <id|url>`
Fetch full job details (description, requirements, skills, stipend/CTC, openings).

| Flag | Description | Default |
|---|---|---|
| `--format <fmt>` | Output format: `json` or `plain` | `json` |

## Examples

```bash
# Search for React developer jobs across India
bun run .agents/skills/internshala-search/cli/src/cli.ts search -q "react" --limit 10 --format table

# Search for Machine Learning internships in Pune
bun run .agents/skills/internshala-search/cli/src/cli.ts search -q "machine learning" -l "Pune" --type internships --format table

# Get detailed description of a job
bun run .agents/skills/internshala-search/cli/src/cli.ts detail https://internshala.com/job/detail/software-engineer-job-in-bangalore-at-example123 --format plain
```

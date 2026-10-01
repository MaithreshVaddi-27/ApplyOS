---
name: wayup-search
version: 1.0.0
description: Search early-career jobs, internships, and entry-level positions on WayUp across tech, engineering, business, data science, and finance (US, Remote, Global). Triggers on "wayup", "wayup jobs", "wayup internships", "entry level tech jobs", "college grad jobs".
context: fork
allowed-tools: Bash(bun run .agents/skills/wayup-search/cli/src/cli.ts *)
enabled: false  # D5: US-only early-career board — near-zero yield for the India + remote stage model; flip to true if targeting US internships
---

# WayUp Search

Search early-career jobs, college internships, co-ops, and entry-level engineering/tech positions on WayUp's public listings. Zero runtime dependencies, no authentication required.

> ⚠️ **Personal use only**: Keep request volume low. Designed for targeted personal job searching.

## Quick Start

```bash
# Search for entry-level software engineering jobs
bun run .agents/skills/wayup-search/cli/src/cli.ts search -q "software" --limit 5 --format table

# Search for remote internships in computer science
bun run .agents/skills/wayup-search/cli/src/cli.ts search -q "computer science" -l "remote" --type internships --format table

# View details of a specific job by ID or URL
bun run .agents/skills/wayup-search/cli/src/cli.ts detail i-Biotechnology-j-Software-Automation-Internships-Danaher-15840404902708 --format plain
```

## Commands & Flags

### `search`
Search opportunities with keyword, role, location, and type filters.

| Flag | Shorthand | Description | Default |
|---|---|---|---|
| `--query <text>` | `-q` | Role or keywords (e.g. `"software"`, `"computer-science"`, `"data science"`) | `"software"` |
| `--location <text>` | `-l` | Location or `"remote"` (e.g. `"san-francisco-ca"`, `"new-york-ny"`, `"remote"`) | `""` |
| `--type <text>` | | Listing type: `entry-level-jobs`, `internships`, or `all` | `entry-level-jobs` |
| `--page <n>` | | Page number (1-indexed) | `1` |
| `--limit <n>` | `-n` | Maximum number of results to display | all |
| `--format <fmt>` | | Output format: `json`, `table`, or `plain` | `json` |

### `detail <id|url>`
Fetch full job description, qualifications, and company information.

| Flag | Description | Default |
|---|---|---|
| `--format <fmt>` | Output format: `json` or `plain` | `json` |

## Examples

```bash
# Search for computer science entry-level jobs
bun run .agents/skills/wayup-search/cli/src/cli.ts search -q "computer science" --limit 5 --format table

# Search for internships in New York
bun run .agents/skills/wayup-search/cli/src/cli.ts search -q "software" -l "new-york-ny" --type internships --format table

# View full description for a listing
bun run .agents/skills/wayup-search/cli/src/cli.ts detail i-Biotechnology-j-Software-Automation-Internships-Danaher-15840404902708 --format plain
```

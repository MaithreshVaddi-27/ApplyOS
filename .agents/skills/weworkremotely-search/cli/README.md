# weworkremotely-cli

Zero-dependency CLI for searching remote software development, engineering, DevOps, design, product, and tech jobs on **[We Work Remotely](https://weworkremotely.com)** via official public RSS feeds.

## Features

- Search remote job postings by keyword, role, technology, tag, category, and location
- View formatted tables, structured JSON, or plain text
- Read complete job descriptions, requirements, candidate region specifications, and direct URLs
- Zero runtime dependencies — runs natively with `bun`

## Usage

```bash
# Search for software engineering jobs
bun run src/cli.ts search -q "engineer" --limit 5 --format table

# Filter by category
bun run src/cli.ts search --category "devops" --limit 5 --format table

# Filter by location
bun run src/cli.ts search -q "react" -l "worldwide" --format table

# Fetch job details
bun run src/cli.ts detail <id|url> --format plain
```

## Testing

```bash
bun test
bun run typecheck
```

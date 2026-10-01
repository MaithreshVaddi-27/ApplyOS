# remoteok-cli

Self-contained CLI for searching remote tech, software engineering, design, and startup jobs on Remote OK.

## Features
- **Zero runtime dependencies**: Native `bun` HTTP & JSON processing
- **Structured Search**: Query by keyword, location filter, tag, and posting recency
- **Full Detail Extraction**: Retrieve complete job descriptions, salary ranges, and application URLs

## Usage

```bash
# Search jobs
bun run src/cli.ts search -q "software" --limit 5 --format table

# Detailed job view
bun run src/cli.ts detail 1137309 --format plain
```

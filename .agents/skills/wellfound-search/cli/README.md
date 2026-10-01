# wellfound-cli

Self-contained CLI for searching startup and tech jobs on [Wellfound](https://wellfound.com) (formerly AngelList Talent) across India, the US, and remote.

No authentication required. Zero runtime dependencies.

## Usage

```bash
# Search for software engineering jobs in India / Bangalore
bun run src/cli.ts search -q "software engineer" -l "Bangalore" --format table

# Search for frontend startup jobs
bun run src/cli.ts search -q "frontend" --limit 5 --format table

# View details for a specific listing by ID or URL
bun run src/cli.ts detail 4662968-software-engineer --format plain
bun run src/cli.ts detail https://wellfound.com/jobs/4662968-software-engineer
```

## Testing

```bash
bun install
bun run typecheck
bun test
```

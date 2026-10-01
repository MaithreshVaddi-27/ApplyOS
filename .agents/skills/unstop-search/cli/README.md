# unstop-cli

Self-contained CLI for searching jobs, hiring challenges, and internships on [Unstop](https://unstop.com) across India.

No authentication required. Zero runtime dependencies.

## Usage

```bash
# Search for software engineering jobs in Bangalore
bun run src/cli.ts search -q "software developer" -l "Bangalore" --format table

# Search for internships
bun run src/cli.ts search -q "data science" --type internships --limit 5

# View details for a specific listing by ID or URL
bun run src/cli.ts detail 1739954 --format plain
bun run src/cli.ts detail https://unstop.com/jobs/software-engineer-visheneracom-1739954
```

## Testing

```bash
bun install
bun run typecheck
bun test
```

# internshala-cli

Self-contained CLI for searching jobs and internships on [Internshala](https://internshala.com) across India.

No authentication required. Zero runtime dependencies.

## Usage

```bash
# Search for software jobs in Bangalore
bun run src/cli.ts search -q "software developer" -l "Bangalore" --format table

# Search for remote/work-from-home internships
bun run src/cli.ts search -q "data science" --type internships --limit 5

# View details for a specific listing by ID or URL
bun run src/cli.ts detail <id-or-url> --format plain
```

## Testing

```bash
bun install
bun run typecheck
bun test
```

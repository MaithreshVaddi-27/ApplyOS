# remotive-cli

Zero-dependency CLI for searching remote tech, software engineering, product, and DevOps opportunities on Remotive (`remotive.com`) via their official public developer API.

## Usage

```bash
# Search for remote roles
bun run src/cli.ts search -q "engineer" --limit 5 --format table

# Filter by location and job age
bun run src/cli.ts search -q "python" -l "worldwide" --jobage 30 --format table

# Fetch job detail
bun run src/cli.ts detail 2091101 --format plain
```

## Testing

```bash
bun test
bun run typecheck
```

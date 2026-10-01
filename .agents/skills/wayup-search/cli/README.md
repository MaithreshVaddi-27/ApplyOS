# wayup-cli

Zero-dependency TypeScript CLI for searching early-career opportunities and internships on WayUp.

## Usage

```bash
# Search entry-level software jobs
bun run src/cli.ts search -q "software" --limit 5 --format table

# Search remote internships in computer science
bun run src/cli.ts search -q "computer science" -l "remote" --type internships --format table

# Fetch details for a listing
bun run src/cli.ts detail i-Biotechnology-j-Software-Automation-Internships-Danaher-15840404902708 --format plain
```

## Testing & Typecheck

```bash
bun install
bun run typecheck
bun test
```

---
name: arbeitnow-search
version: 1.0.0
description: Search remote tech jobs across Europe on Arbeitnow via its public job board API. Covers engineering, data, design, product, and startup roles with location and remote filters. No authentication, zero runtime dependencies. Triggers on "arbeitnow", "arbeitnow jobs", "europe remote jobs", "remote tech jobs europe", "arbeitnow search".
context: fork
allowed-tools: Bash(bun run .agents/skills/arbeitnow-search/cli/src/cli.ts *)
---

# Arbeitnow Search

Search live remote job listings from **[Arbeitnow](https://www.arbeitnow.com)** via its public job
board API. Zero authentication required, no API keys, and zero runtime dependencies — runs directly
with `bun`.

> Personal use only. Keep request volume reasonable.

## Quick start

```bash
# Search engineering roles
bun run .agents/skills/arbeitnow-search/cli/src/cli.ts search -q "engineer" --limit 5 --format table

# Only remote postings in Europe
bun run .agents/skills/arbeitnow-search/cli/src/cli.ts search --remote -l "Europe" --format json

# Full detail for one posting
bun run .agents/skills/arbeitnow-search/cli/src/cli.ts detail python-developer-123456 --format plain
```

## Commands & flags

### `search`

| Flag | Shorthand | Description | Default |
|---|---|---|---|
| `--query <text>` | `-q` | Keywords (title or company) | none |
| `--location <text>` | `-l` | Place filter | none |
| `--remote` | | Only postings the board marks remote | false |
| `--jobage <days>` | | Posted within N days; undated rows pass | all |
| `--page <n>` | | 1-indexed page | 1 |
| `--limit <n>` | `-n` | Cap results emitted; 0 means all | 20 |
| `--format <fmt>` | | `json`, `table`, `plain` | `json` |

### `detail <id|url>`

Fetch one posting by its slug or URL. `--format json|plain`.

## Output contract

Every row carries `id`, `title`, `company`, `location` (null when the board states none), `date`
(YYYY-MM-DD), `url`, `remote`, `tags` and `jobTypes`. `detail` adds the full `description`.

## Notes

- The board has no search endpoint: all filtering is client-side over its single feed.
- `created_at` is a unix-seconds timestamp; the CLI renders a calendar date.

---
name: cutshort-search
version: 1.0.0
description: Search jobs on Cutshort (cutshort.io) — India's AI-matched startup job board with a strong fresher-to-3yr band, Bengaluru/Pune/remote-heavy, plus global-remote-from-India roles. Reads the public server-rendered listing pages, no authentication. Triggers on "cutshort", "cutshort jobs", "startup jobs india", "cutshort-search".
context: fork
allowed-tools: Bash(bun run .agents/skills/cutshort-search/cli/src/cli.ts *)
enabled: true
---

# Cutshort Search

Search postings on [Cutshort](https://cutshort.io), the AI-matched Indian startup
job board — strong coverage of the fresher-to-3-years band, Bengaluru/Pune/remote-heavy
listings, and startup product roles that rarely reach the big portals. Zero runtime
dependencies, no authentication, no cookies, no bot-detection evasion: the CLI reads
the public server-rendered listing pages and their embedded `__NEXT_DATA__` payload
(see `url-reference.md`).

> ⚠️ **Personal use only**: one category page (~50 postings) per run, 15s timeout,
> backoff on 429/5xx. Keep volume at human levels.

## Stage relevance

Primary for the **fresher** and **experienced** stages (see the Stage Profile in
`search-queries.md`); useful for `remote-global` with the `--remote` flag.

## How it works

`search` fetches one category page (`cutshort.io/jobs/<category-slug>`, ~50 postings
plus the category's live total) and parses the dehydrated job data out of the page's
embedded JSON. `detail` fetches one posting page the same way and returns the full
description. Pagination is deliberately not crawled — run different categories instead.

| Command | Purpose |
|---|---|
| `search` | One category page → normalized postings |
| `detail` | One posting URL/slug → full description + facts |

Search flags: `-c/--category` (slug, e.g. `reactjs-jobs`; derived from `--query` when
omitted), `-q/--query` (client-side filter on title/company/skills), `-l/--location`,
`--remote` (remote-friendly only), `--jobage <days>`, `-n/--limit`,
`--format json|table|plain`.

## Output contract

Every search hit carries `id`, `title`, `company`, `location`, `date`, `url` — the
`/scrape` Step 2 contract — plus `salary`, `experience`, `remoteType`, and `skills`.
`date` is `null` when the posting carries no parseable date; never invented. All
errors go to **stderr** as `{ "error": "...", "code": "..." }` with exit code 1
(`NO_CATEGORY`, `NOT_FOUND`, `PARSE_EMPTY`, `PARSE_FAILED`, `BAD_ARG`, `UNKNOWN_FLAG`,
`NO_ID`, `BAD_CMD`).

```bash
# Search a category (India + remote), table output
bun run .agents/skills/cutshort-search/cli/src/cli.ts search -c reactjs-jobs --format table

# Backend roles in Pune posted this week
bun run .agents/skills/cutshort-search/cli/src/cli.ts search -c backend-developer-jobs -l "Pune" --jobage 7 -n 20

# Remote-friendly postings only
bun run .agents/skills/cutshort-search/cli/src/cli.ts search -c nodejs-jobs --remote --format json

# Query-derived category ("internship" -> /jobs/internship-jobs)
bun run .agents/skills/cutshort-search/cli/src/cli.ts search -q "internship" -n 10

# Full detail on one posting (any posting URL works)
bun run .agents/skills/cutshort-search/cli/src/cli.ts detail "https://cutshort.io/job/<slug>" --format plain
```

Category slugs are exact — Cutshort serves an empty shell (HTTP 200) for slugs that
don't exist, so `--query` resolves through a verified alias map in the CLI
(`backend` → `backend-developer-jobs`, `react` → `reactjs-jobs`, …); pass an
explicit `--category` to skip the map, or browse the directory at
`cutshort.io/jobs` for the full registry.

## Notes

- Honesty rules apply as everywhere in this repo: results come only from real page
  payloads; a category page that yields no parseable postings reports `PARSE_EMPTY`
  loudly instead of pretending the board is empty.
- Parsing anchors and the payload path are documented in `url-reference.md`; if
  `/scrape health cutshort-search` flags this portal degraded or broken, start there.

# `@applyos/company-scraper` — standalone (clean-room)

Search job/internship postings **directly on employers' own career sites**.
Zero runtime dependencies. Works without ApplyOS.

```bash
cd standalone/packages/company-scraper
bun run src/cli.ts companies
bun run src/cli.ts search --region india -q "sde intern" --format table
bun run src/cli.ts search -c groww --limit 20 --format json
bun run src/cli.ts detail https://job-boards.greenhouse.io/groww/jobs/123 --format plain
bun run src/cli.ts discover https://jobs.lever.co/cred/abc
```

Flags: `-q/--query`, `-l/--location`, `-b/--board`, `-c/--company`,
`--category mega-cap|india-product|gcc|startup`, `--region india|global`,
`--type jobs|internships|all`, `--stage student|fresher|experienced|remote-global`,
`--jobage days`, `-n/--limit`, `--max-pages`, `--format json|table|plain`.

Boards in this build: `greenhouse`, `lever`, `smartrecruiters`, `amazon`
live; `workday` connector implemented (needs per-tenant slugs in
`registry.yaml`); `eightfold`/`oracle-orc` ship unseeded and fail loudly
per source instead of guessing.

> Personal use only: one fetch pass per company per run, default page cap 3,
> 300 ms pacing between hosts, 20 s timeout + 1 retry. Public JSON endpoints
> at human volume — no cookies, no evasion. Adding a company is one block in
> `registry.yaml`; it must be probe-verified live before entry.

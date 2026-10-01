#!/usr/bin/env bun
// Self-contained CLI for searching job postings on company career portals
// directly (Amazon, Google, Microsoft, Salesforce, Greenhouse, Lever, Ashby,
// SmartRecruiters, Workday). Public endpoints only, zero runtime dependencies.
//
// Personal use only: keep volume low, one request pass per company per run.

import { runSearch, runDetail, runCompanies } from "./commands/search.js"
import { writeError, type BoardKind } from "./types.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[] | undefined
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = {
    q: "query",
    l: "location",
    n: "limit",
    b: "board",
    c: "company",
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--") || (a.startsWith("-") && a.length > 1)) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || (next.startsWith("-") && !/^-?\d/.test(next))) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set(["query", "location", "board", "company", "category", "region", "jobage", "page", "limit", "format", "max-pages", "help", "h"]),
  detail: new Set(["board", "format", "help", "h"]),
  companies: new Set(["format", "help", "h"]),
  discover: new Set(["format", "help", "h"]),
}

const HELP = `careers-cli — search job postings directly on company career portals

USAGE
  bun run src/cli.ts search [flags]
  bun run src/cli.ts detail <id|url> [--board <kind>] [--format json|plain]
  bun run src/cli.ts companies [--format json|table]
  bun run src/cli.ts discover <careers-url>

SEARCH FLAGS
  --query, -q <text>       Keywords or role (e.g. "software engineer", "sde intern").
  --location, -l <text>    Location filter, client-side (e.g. "Bengaluru", "india").
  --board <kind>           Only this board: amazon|salesforce|greenhouse|lever|ashby|smartrecruiters|workday|eightfold
  --company, -c <name>     Only boards for this company (e.g. -c amazon, -c swiggy).
  --category <name>        mega-cap | india-product | gcc | startup
  --region <name>          india | global
  --jobage <days>          Posted within the last N days (client-side; boards without dates pass through).
  --page <n>               1-indexed page over the merged results. Default 1.
  --limit, -n <n>          Cap emitted results. Default 20. Use 0 for ALL matched
                           postings (truncation is always reported either way).
  --max-pages <n>          Per-board fetch cap (default 3; 0 = all pages). Keep low:
                           politeness. A run that hits the cap says so in its output.
  --format <fmt>           json (default) | table | plain.

EXAMPLES
  # Amazon India software roles
  bun run src/cli.ts search -b amazon -q "software engineer" --format table

  # Google India + Salesforce India, one pass
  bun run src/cli.ts search -q "software engineer" --category mega-cap --region india --format table

  # Every seeded Indian product company + GCC board, backend roles
  bun run src/cli.ts search -q "backend engineer" --region india --limit 30 --format json

  # One company's whole board
  bun run src/cli.ts search -c swiggy --limit 50 --format table

  # Detail for a specific posting
  bun run src/cli.ts detail https://job-boards.greenhouse.io/swiggy/jobs/1004321 --format plain
  bun run src/cli.ts detail 1234567 --board greenhouse

  # Which board handles this URL? (used by /apply and /rank handoffs)
  bun run src/cli.ts discover https://jobs.ashbyhq.com/vercel

NOTES
  - All boards are fetched with public, unauthenticated endpoints. No cookies,
    no logins, no bot-detection evasion. If a portal blocks the request, the
    board reports an error line and the rest of the run continues.
  - Volume stays low by design: one fetch pass per company per run, default
    max-pages 3, 300ms pacing between boards.

Personal use only — keep volume low.
`

function str(v: string | boolean | string[] | undefined): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined
}

function num(v: string | boolean | string[] | undefined): number | undefined {
  if (typeof v !== "string") return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

async function main(): Promise<number> {
  const flags = parseFlags(process.argv.slice(2))
  const command = (flags._ as string[])[0]

  if (flags.help || flags.h || command === "help" || !command) {
    process.stdout.write(HELP)
    return 0
  }

  const known = KNOWN_FLAGS[command]
  if (!known) {
    writeError(`unknown command "${command}" — try search | detail | companies | discover`, "UNKNOWN_COMMAND")
    return 1
  }
  for (const f of Object.keys(flags)) {
    if (f !== "_" && !known.has(f)) {
      writeError(`unknown flag "--${f}" for ${command}`, "UNKNOWN_FLAG")
      return 1
    }
  }

  const format = (str(flags.format) ?? "json") as "json" | "table" | "plain"
  if (!["json", "table", "plain"].includes(format)) {
    writeError(`invalid format "${format}"`, "INVALID_FORMAT")
    return 1
  }

  if (command === "search") {
    const page = num(flags.page) ?? 1
    if (page < 1) {
      writeError("page must be >= 1", "INVALID_PAGE")
      return 1
    }
    const board = str(flags.board) as BoardKind | undefined
    if (board && !["amazon", "salesforce", "greenhouse", "lever", "ashby", "smartrecruiters", "workday", "eightfold"].includes(board)) {
      writeError(`unknown board "${board}"`, "INVALID_BOARD")
      return 1
    }
    return runSearch({
      query: str(flags.query),
      location: str(flags.location),
      board,
      company: str(flags.company),
      category: str(flags.category),
      region: str(flags.region),
      jobage: num(flags.jobage),
      page,
      limit: num(flags.limit),
      format,
      maxPages: num(flags["max-pages"]),
    })
  }

  if (command === "detail") {
    const target = (flags._ as string[])[1]
    if (!target) {
      writeError("detail requires an id or URL argument", "MISSING_ARG")
      return 1
    }
    const board = str(flags.board) as BoardKind | undefined
    if (board && !["amazon", "salesforce", "greenhouse", "lever", "ashby", "smartrecruiters", "workday", "eightfold"].includes(board)) {
      writeError(`unknown board "${board}"`, "INVALID_BOARD")
      return 1
    }
    return runDetail(target, { board, format: format === "table" ? "plain" : (format as "json" | "plain") })
  }

  if (command === "companies") {
    return runCompanies({ format: format === "plain" ? "table" : (format as "json" | "table") })
  }

  // discover
  const url = (flags._ as string[])[1]
  if (!url) {
    writeError("discover requires a careers URL argument", "MISSING_ARG")
    return 1
  }
  const { detectBoards } = await import("./detect.js")
  const { BOARD_HINTS } = await import("./companies.js")
  const detected = detectBoards(url)
  if (detected.length > 0) {
    process.stdout.write(JSON.stringify({ url, ...detected[0] }, null, 2) + "\n")
    return 0
  }
  const hint = BOARD_HINTS.find((h) => h.pattern.test(url))
  process.stdout.write(
    JSON.stringify(
      {
        url,
        board: hint ? hint.kind : null,
        note: hint ? hint.note : "unrecognized careers host — add a seed row or a connector (see docs/COMPANY_PORTAL_SCRAPER.md)",
      },
      null,
      2,
    ) + "\n",
  )
  return 0
}

process.exitCode = await main()

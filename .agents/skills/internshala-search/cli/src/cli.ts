#!/usr/bin/env bun
// Self-contained CLI for searching jobs and internships on Internshala across India.
// No authentication required. Zero runtime dependencies.
//
// Personal use only: keep volume low.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"
import { writeError } from "./helpers.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = {
    q: "query",
    l: "location",
    n: "limit",
    t: "type",
    j: "jobage",
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--") || a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
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

const HELP = `internshala-cli — search jobs and internships across India

USAGE
  bun run src/cli.ts search [flags]
  bun run src/cli.ts detail <id|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords (role, title, or technology e.g. "software engineer", "python").
  --location, -l <text>   City or location filter (e.g. "Bangalore", "Delhi", "Mumbai", "Pune").
  --type, -t <type>       "jobs" (default) or "internships".
  --jobage <days>         Posted within N days: 1, 3, 7, 15, 30. Default: all.
  --page <n>              1-indexed page. Default 1.
  --limit, -n <n>         Cap results emitted. Default all.
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "software developer" --format table
  bun run src/cli.ts search -q "react" -l "Bangalore" --limit 5 --format table
  bun run src/cli.ts search -q "data science" --type internships --format table
  bun run src/cli.ts search -q "software engineer" -l "Bangalore" --jobage 7 --format table
  bun run src/cli.ts detail aws-databricks-job-in-nanakramguda-at-quess-corp-limited1788766452 --format plain
  bun run src/cli.ts detail https://internshala.com/job/detail/aws-databricks-job-in-nanakramguda-at-quess-corp-limited1788766452

Personal use only — uses Internshala public listings. Keep volume low.
`

const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set([
    "query",
    "location",
    "type",
    "jobage",
    "page",
    "limit",
    "format",
    "help",
    "h",
  ]),
  detail: new Set(["format", "help", "h"]),
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return flags.help || flags.h ? 0 : 1
  }

  const knownFlags = KNOWN_FLAGS[cmd]
  if (knownFlags) {
    for (const key of Object.keys(flags)) {
      if (key === "_" || knownFlags.has(key)) continue
      writeError(
        `unknown flag --${key} for '${cmd}' - flags are never silently ignored; see --help for the supported flags`,
        "UNKNOWN_FLAG",
      )
      return 1
    }
  }

  // P-M1: a known value-flag passed without a value parses as `true` and its
  // filter would silently drop — reject loudly instead.
  const valueFlags =
    cmd === "search"
      ? ["query", "location", "type", "jobage", "page", "limit", "format"]
      : ["format"]
  for (const name of valueFlags) {
    if (flags[name] === true) {
      writeError(`--${name} requires a value`, "INVALID_ARG")
      return 1
    }
  }

  if (cmd === "search") {
    const pageNum = flags.page !== undefined ? parseInt(String(flags.page), 10) : 1
    if (isNaN(pageNum) || pageNum < 1) {
      writeError("--page must be a positive integer", "INVALID_PAGE")
      return 1
    }

    let limitNum: number | undefined
    if (flags.limit !== undefined) {
      limitNum = parseInt(String(flags.limit), 10)
      if (isNaN(limitNum) || limitNum < 0) {
        writeError("--limit must be a non-negative integer", "INVALID_LIMIT")
        return 1
      }
    }

    const typeVal = flags.type === "internships" ? "internships" : "jobs"
    // P-M2: never silently default an invalid --type to "jobs".
    if (flags.type !== undefined && flags.type !== "jobs" && flags.type !== "internships") {
      writeError(`--type must be "jobs" or "internships", got "${flags.type}"`, "INVALID_TYPE")
      return 1
    }
    // P-M3: never silently default an invalid --format to "json".
    if (
      flags.format !== undefined &&
      flags.format !== "json" &&
      flags.format !== "table" &&
      flags.format !== "plain"
    ) {
      writeError(`--format must be json, table, or plain, got "${flags.format}"`, "INVALID_FORMAT")
      return 1
    }
    const formatVal = flags.format === "table" || flags.format === "plain" ? flags.format : "json"

    // P-M4: never silently coerce an invalid --jobage to undefined.
    let jobageVal: number | undefined
    if (flags.jobage !== undefined) {
      const raw = String(flags.jobage)
      if (!/^\d+$/.test(raw) || Number(raw) < 1) {
        writeError(`--jobage must be a positive integer number of days, got "${flags.jobage}"`, "INVALID_JOBAGE")
        return 1
      }
      jobageVal = parseInt(raw, 10)
    }

    const opts: SearchOpts = {
      query: typeof flags.query === "string" ? flags.query : undefined,
      location: typeof flags.location === "string" ? flags.location : undefined,
      type: typeVal,
      jobage: jobageVal,
      page: pageNum,
      limit: limitNum,
      format: formatVal,
    }

    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) {
      writeError("missing required argument <id|url> for detail", "MISSING_ARG")
      return 1
    }
    // P-M3: never silently default an invalid detail --format to "json".
    if (flags.format !== undefined && flags.format !== "json" && flags.format !== "plain") {
      writeError(`--format must be json or plain, got "${flags.format}"`, "INVALID_FORMAT")
      return 1
    }
    const formatVal = flags.format === "plain" ? "plain" : "json"
    const opts: DetailOpts = {
      id,
      format: formatVal,
    }
    return runDetail(opts)
  }

  writeError(`unknown command '${cmd}' — expected 'search' or 'detail'`, "UNKNOWN_COMMAND")
  return 1
}

main().then(
  (code) => process.exit(code),
  (err) => {
    writeError(err instanceof Error ? err.message : String(err), "FATAL")
    process.exit(1)
  },
)

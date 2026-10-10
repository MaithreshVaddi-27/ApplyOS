#!/usr/bin/env bun
// Self-contained CLI for searching remote tech and startup jobs on Remote OK.
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
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--") || a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || (next.startsWith("-") && !/^-\d+$/.test(next))) {
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

const HELP = `remoteok-cli — search remote tech, developer, engineering, and startup jobs on Remote OK

USAGE
  bun run src/cli.ts search [flags]
  bun run src/cli.ts detail <id|slug|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords or role (e.g. "software", "python", "react", "ai").
  --location, -l <text>   Location filter (e.g. "worldwide", "us", "europe", "india").
  --tag <text>            Tag filter (e.g. "dev", "engineer", "full stack", "design").
  --salary <usd>          Minimum salary in USD (e.g. 80000, 120000).
  --jobage <days>         Posted within the last N days.
  --page <n>              1-indexed page. Default 1.
  --limit, -n <n>         Cap results emitted. Default 20.
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "software engineer" --limit 5 --format table
  bun run src/cli.ts search -q "python" --jobage 14 --format table
  bun run src/cli.ts search -q "react" -l "worldwide" --format table
  bun run src/cli.ts search -q "software engineer" --salary 100000 --format table
  bun run src/cli.ts detail 1137309 --format plain

Personal use only — uses Remote OK public listings. Keep volume low.
`

const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set([
    "query",
    "location",
    "tag",
    "salary",
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
    // P-M1: a known value-flag passed without a value parses as `true` and
    // its filter is silently dropped. Every known flag except help/h takes a
    // value, so a `true` here is always a missing value — fail loudly before
    // dispatch (in particular before the numeric checks below, so a bare
    // --page reports INVALID_ARG, not INVALID_PAGE).
    for (const key of Object.keys(flags)) {
      if (key === "_" || key === "help" || key === "h") continue
      if (flags[key] === true) {
        writeError(`--${key} requires a value`, "INVALID_ARG")
        return 1
      }
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

    let jobageNum: number | undefined
    if (flags.jobage !== undefined) {
      // P-M4: strict whole number >= 1 — parseInt would truncate "1.5" to 1,
      // accept "7abc" as 7, and take "0x10" as hex, silently changing the filter.
      const s = String(flags.jobage).trim()
      if (!/^\d+$/.test(s) || Number(s) <= 0) {
        writeError(`--jobage must be a positive integer, got "${flags.jobage}"`, "INVALID_JOBAGE")
        return 1
      }
      jobageNum = Number(s)
    }

    // P-M3: a --format typo must fail, never silently coerce to json.
    const rawFmt = flags.format
    if (rawFmt !== undefined && rawFmt !== "json" && rawFmt !== "table" && rawFmt !== "plain") {
      writeError(`--format must be one of json|table|plain, got "${rawFmt}"`, "INVALID_FORMAT")
      return 1
    }
    const formatVal = rawFmt === "table" || rawFmt === "plain" ? rawFmt : "json"

    // P-M6: --salary must be a strict whole number, never silently dropped
    // to undefined (remoteok declares no --experience flag).
    let salaryNum: number | undefined
    if (flags.salary !== undefined) {
      const s = String(flags.salary).trim()
      if (!/^\d+$/.test(s)) {
        writeError(`--salary must be a whole number, got "${flags.salary}"`, "INVALID_SALARY")
        return 1
      }
      salaryNum = Number(s)
    }

    const opts: SearchOpts = {
      query: typeof flags.query === "string" ? flags.query : undefined,
      location: typeof flags.location === "string" ? flags.location : undefined,
      tag: typeof flags.tag === "string" ? flags.tag : undefined,
      salary: salaryNum,
      jobage: jobageNum,
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
    const rawFmt = flags.format
    // P-M3: detail only accepts json|plain; validate before dispatch so a
    // typo can't silently coerce (P-M1 above already rejects a bare --format).
    if (rawFmt !== undefined && rawFmt !== "json" && rawFmt !== "plain") {
      writeError(`--format must be one of json|plain, got "${rawFmt}"`, "INVALID_FORMAT")
      return 1
    }
    const opts: DetailOpts = {
      id,
      format: rawFmt === "plain" ? "plain" : "json",
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

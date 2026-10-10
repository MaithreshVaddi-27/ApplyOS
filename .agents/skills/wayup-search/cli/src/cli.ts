#!/usr/bin/env bun
// Self-contained CLI for searching early-career jobs and internships on WayUp.
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

const HELP = `wayup-cli — search early-career jobs, internships, and entry-level positions on WayUp

USAGE
  bun run src/cli.ts search [flags]
  bun run src/cli.ts detail <id|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords or role (e.g. "software", "computer science", "data science").
  --location, -l <text>   Location filter (e.g. "san-francisco-ca", "new-york-ny", "remote").
  --type <text>           Listing type: entry-level-jobs (default) | internships | all.
  --page <n>              1-indexed page. Default 1.
  --limit, -n <n>         Cap results emitted. Default all.
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "software" --limit 5 --format table
  bun run src/cli.ts search -q "computer science" -l "remote" --type internships --format table
  bun run src/cli.ts detail i-Biotechnology-j-Software-Automation-Internships-Danaher-15840404902708 --format plain

Personal use only — uses WayUp public listings. Keep volume low.
`

const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set([
    "query",
    "location",
    "type",
    "page",
    "limit",
    "format",
    "help",
    "h",
  ]),
  detail: new Set(["format", "help", "h"]),
}

// Every known flag except help/h takes a value. A value-flag parsed as
// `true` means it was passed without a value — reject, never drop silently.
const VALUE_FLAGS: Record<string, Set<string>> = {
  search: new Set(["query", "location", "type", "page", "limit", "format"]),
  detail: new Set(["format"]),
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

  const valueFlags = VALUE_FLAGS[cmd]
  if (valueFlags) {
    for (const key of valueFlags) {
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

    if (
      flags.format !== undefined &&
      flags.format !== "json" &&
      flags.format !== "table" &&
      flags.format !== "plain"
    ) {
      writeError(`invalid format "${flags.format}"`, "INVALID_FORMAT")
      return 1
    }
    const formatVal = ((flags.format as string | undefined) ?? "json") as
      | "json"
      | "table"
      | "plain"

    const opts: SearchOpts = {
      query: typeof flags.query === "string" ? flags.query : undefined,
      location: typeof flags.location === "string" ? flags.location : undefined,
      type: typeof flags.type === "string" ? flags.type : undefined,
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
    if (flags.format !== undefined && flags.format !== "json" && flags.format !== "plain") {
      writeError(`invalid format "${flags.format}"`, "INVALID_FORMAT")
      return 1
    }
    const formatVal = ((flags.format as string | undefined) ?? "json") as "json" | "plain"
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

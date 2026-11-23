#!/usr/bin/env bun
// Self-contained CLI for searching remote tech jobs in Europe on Arbeitnow.
// No authentication required. Zero runtime dependencies.
//
// Personal use only: keep volume low.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"
import { writeError } from "./helpers.js"
import { parseRawArgs, type ParsedArgs } from "../../../cli-shared/src/flags.js"

type Flags = ParsedArgs

const ALIASES = { q: "query", l: "location", n: "limit" }

function parseFlags(argv: string[]): Flags {
  return parseRawArgs(argv, ALIASES, "int-only")
}

const HELP = `arbeitnow-cli — search remote tech jobs across Europe on Arbeitnow

USAGE
  bun run src/cli.ts search [flags]
  bun run src/cli.ts detail <slug|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords (title or company).
  --location, -l <text>   Place filter (e.g. "Berlin", "Remote").
  --remote                Only postings the board marks remote.
  --jobage <days>         Posted within the last N days; undated rows pass.
  --page <n>              1-indexed page. Default 1.
  --limit, -n <n>         Cap results emitted. Default 20; 0 means all.
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "engineer" --limit 5 --format table
  bun run src/cli.ts search --remote -l "Europe" --format json
  bun run src/cli.ts detail python-developer-123456 --format plain

Personal use only — queries Arbeitnow's public job board API. Keep volume low.
`

const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set(["query", "location", "remote", "jobage", "page", "limit", "format", "help", "h"]),
  detail: new Set(["format", "help", "h"]),
}

const VALUE_FLAGS: Record<string, Set<string>> = {
  search: new Set(["query", "location", "jobage", "page", "limit", "format"]),
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

  const known = KNOWN_FLAGS[cmd]
  if (known) {
    for (const key of Object.keys(flags)) {
      if (key === "_" || known.has(key)) continue
      writeError(`unknown flag --${key} for '${cmd}' - see --help`, "UNKNOWN_FLAG")
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
    const page = flags.page !== undefined ? parseInt(String(flags.page), 10) : 1
    if (isNaN(page) || page < 1) {
      writeError("--page must be a positive integer", "INVALID_PAGE")
      return 1
    }
    let limit: number | undefined
    if (flags.limit !== undefined) {
      limit = parseInt(String(flags.limit), 10)
      if (isNaN(limit) || limit < 0) {
        writeError("--limit must be a non-negative integer", "INVALID_LIMIT")
        return 1
      }
    }
    let jobage: number | undefined
    if (flags.jobage !== undefined) {
      const raw = String(flags.jobage)
      if (!/^\d+$/.test(raw) || Number(raw) < 1) {
        writeError("--jobage must be a positive integer number of days", "INVALID_JOBAGE")
        return 1
      }
      jobage = parseInt(raw, 10)
    }
    if (
      flags.format !== undefined &&
      flags.format !== "json" && flags.format !== "table" && flags.format !== "plain"
    ) {
      writeError(`invalid format "${flags.format}"`, "INVALID_FORMAT")
      return 1
    }

    const opts: SearchOpts = {
      query: typeof flags.query === "string" ? flags.query : undefined,
      location: typeof flags.location === "string" ? flags.location : undefined,
      remote: flags.remote === true,
      jobage,
      page,
      limit,
      format: (flags.format as "json" | "table" | "plain") ?? "json",
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
    const opts: DetailOpts = { id, format: flags.format === "plain" ? "plain" : "json" }
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

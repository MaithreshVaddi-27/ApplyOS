#!/usr/bin/env bun
// Self-contained CLI for searching jobs on Cutshort (AI-matched Indian startup
// job board, strong fresher-to-3yr band). Parses the public server-rendered
// listing pages' embedded __NEXT_DATA__ payload — see url-reference.md.
// No external CLI framework, zero install beyond the repo clone.
//
// Personal use only. Keep volume low; one category page per run.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", c: "category", l: "location", n: "limit" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    // A token starting with "-" is a flag unless it is a negative number,
    // which is a VALUE (e.g. --jobage -3 must reach the validator, not the
    // flag parser — otherwise the validation exit never fires).
    const isNegativeNumber = /^-\d/.test(a)
    if (a.startsWith("--") || (a.startsWith("-") && !isNegativeNumber)) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || (next.startsWith("-") && !/^-\d/.test(next))) {
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

const HELP = `cutshort-cli — search jobs on Cutshort (AI-matched startup jobs, India + remote)

USAGE
  bun run src/cli.ts search -c "<category-slug>" [flags]
  bun run src/cli.ts detail <url|slug> [--format json|plain]

SEARCH FLAGS
  --category, -c <slug>   Category slug, e.g. "reactjs-jobs", "backend-developer-jobs",
                          "internship-jobs". Browse categories at cutshort.io/jobs.
                          Optional when --query is given: the query is slugified
                          ("backend" -> "backend-jobs").
  --query, -q <text>      Client-side keyword filter on title, company, and skills.
  --location, -l <text>   Client-side filter on the location text (e.g. "Bengaluru", "Remote").
  --remote                Only remote-friendly postings (remoteType is a remote variant).
  --jobage <days>         Keep postings published within N days (undated rows pass).
  --limit, -n <n>         Cap results emitted (client-side).
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -c reactjs-jobs -q "react" --remote --format table
  bun run src/cli.ts search -c backend-developer-jobs -l "Pune" --jobage 7 -n 20
  bun run src/cli.ts search -q "internship" --format json
  bun run src/cli.ts detail https://cutshort.io/job/<title-slug>-<company>-<id> --format plain

NOTES
  One category page (~50 postings) is fetched per run — Cutshort paginates
  server-side and this CLI deliberately does not crawl further. Combine
  categories across runs, or narrow with --query/--location.

Personal use only — keep volume low and respect cutshort.io's access policies.
`

// Long-form flag names each command accepts (parseFlags resolves short
// aliases q/c/l/n to these before validation). "help"/"h" pass so
// `search --help` still prints usage.
const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set(["category", "query", "location", "remote", "jobage", "limit", "format", "help", "h"]),
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
      process.stderr.write(
        JSON.stringify({
          error: `unknown flag --${key} for '${cmd}' - flags are never silently ignored`,
          code: "UNKNOWN_FLAG",
        }) + "\n",
      )
      return 1
    }
  }

  // P-M1: a known value-flag passed without a value parses as `true` and its
  // filter would silently drop — reject loudly instead. (`remote` is a
  // boolean flag and is intentionally excluded.)
  const valueFlags = cmd === "search"
    ? ["category", "query", "location", "jobage", "limit", "format"]
    : ["format"]
  for (const name of valueFlags) {
    if (flags[name] === true) {
      process.stderr.write(JSON.stringify({ error: `--${name} requires a value`, code: "INVALID_ARG" }) + "\n")
      return 1
    }
  }

  if (cmd === "search") {
    // P-M3: never silently default an invalid --format to "json".
    if (flags.format !== undefined && !["json", "table", "plain"].includes(flags.format as string)) {
      process.stderr.write(
        JSON.stringify({ error: `--format must be json, table, or plain, got "${flags.format}"`, code: "INVALID_FORMAT" }) + "\n",
      )
      return 1
    }
    const fmt = (flags.format as string) || "json"
    const parseIntFlag = (name: string, raw: string | boolean | string[]): number | null => {
      const val = typeof raw === "string" ? Number(raw.trim()) : NaN
      if (!Number.isInteger(val) || val < 1) {
        process.stderr.write(
          JSON.stringify({ error: `--${name} must be a whole number of at least 1, got "${raw}"`, code: "BAD_ARG" }) + "\n",
        )
        return null
      }
      return val
    }
    const jobageVal = flags.jobage ? parseIntFlag("jobage", flags.jobage) : undefined
    const limitVal = flags.limit ? parseIntFlag("limit", flags.limit) : undefined
    if (jobageVal === null || limitVal === null) return 1
    const opts: SearchOpts = {
      query: typeof flags.query === "string" ? flags.query : undefined,
      category: typeof flags.category === "string" ? flags.category : undefined,
      location: typeof flags.location === "string" ? flags.location : undefined,
      remote: flags.remote === true,
      jobage: jobageVal ?? undefined,
      limit: limitVal ?? undefined,
      format: (["json", "table", "plain"].includes(fmt) ? fmt : "json") as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) {
      process.stderr.write(JSON.stringify({ error: "detail requires a <url|slug>", code: "NO_ID" }) + "\n")
      return 1
    }
    // P-M3: never silently default an invalid detail --format to "json".
    if (flags.format !== undefined && flags.format !== "json" && flags.format !== "plain") {
      process.stderr.write(
        JSON.stringify({ error: `--format must be json or plain, got "${flags.format}"`, code: "INVALID_FORMAT" }) + "\n",
      )
      return 1
    }
    const fmt = (flags.format as string) || "json"
    const opts: DetailOpts = { id, format: (fmt === "plain" ? "plain" : "json") as DetailOpts["format"] }
    return runDetail(opts)
  }

  process.stderr.write(JSON.stringify({ error: `Unknown command "${cmd}"`, code: "BAD_CMD" }) + "\n")
  return 1
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    process.stderr.write(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e), code: "INTERNAL_ERROR" }) + "\n",
    )
    process.exit(1)
  })

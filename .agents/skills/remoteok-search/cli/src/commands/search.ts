// Implementation of `remoteok-cli search [flags]`
//
// The filtering, paging, and parsing live in the provider SDK. This file is
// the surface: it turns flags into a request, and rows into the output shape
// the portal-skill contract defines.

import { isProviderError, remoteOkProvider, writeError, type RemoteOkJob } from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  tag?: string
  jobage?: number
  salary?: number        // minimum salary in USD
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

export interface SearchResult {
  meta: {
    count: number
    page: number
    total?: number
  }
  results: Array<{
    id: string
    title: string
    company: string
    location: string | null
    date: string | null
    url: string
    salary?: string
    tags?: string[]
    description?: string
  }>
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  let page
  try {
    page = await remoteOkProvider.search({
      query: opts.query,
      location: opts.location,
      tag: opts.tag,
      salaryMin: opts.salary,
      jobAgeDays: opts.jobage,
      page: opts.page,
      // The CLI's `--limit 0` means "use the default page size", which is
      // what it has always meant. The SDK's `0` means "no cap". The two
      // conventions are translated here, at the surface, so neither the CLI
      // nor the engine has to change.
      limit: opts.limit && opts.limit > 0 ? opts.limit : 20,
    })
  } catch (err: any) {
    // The provider names the code. A search failure is a fetch failure
    // unless the provider says otherwise.
    const code = isProviderError(err) ? err.cliCode : "FETCH_ERROR"
    writeError(err.message || "failed to fetch listings from RemoteOK", code)
    return 1
  }

  const results = page.rows as RemoteOkJob[]
  return emitSearch(results, page.total, page.page, opts.format)
}

function emitSearch(
  results: RemoteOkJob[],
  total: number,
  page: number,
  format: "json" | "table" | "plain",
): number {
  if (format === "json") {
    const output: SearchResult = {
      meta: {
        count: results.length,
        page,
        total,
      },
      results: results.map((r) => ({
        id: r.id,
        title: r.title,
        company: r.company,
        location: r.location,
        date: r.date,
        url: r.url,
        salary: r.salary,
        tags: r.tags,
        description: r.description,
      })),
    }
    process.stdout.write(JSON.stringify(output, null, 2) + "\n")
    return 0
  }

  if (format === "table") {
    if (results.length === 0) {
      process.stdout.write("No matching jobs found on Remote OK.\n")
      return 0
    }

    const pad = (s: string, w: number) => {
      const clean = s.replace(/\s+/g, " ")
      if (clean.length > w) return clean.slice(0, w - 1) + "…"
      return clean.padEnd(w)
    }

    const colId = 10
    const colTitle = 30
    const colComp = 24
    const colLoc = 18
    const colSal = 22

    const header = `${pad("ID", colId)} ${pad("TITLE", colTitle)} ${pad("COMPANY", colComp)} ${pad("LOCATION", colLoc)} ${pad("SALARY", colSal)}`
    const divider = "-".repeat(header.length)

    process.stdout.write(header + "\n" + divider + "\n")
    for (const r of results) {
      // An absent location is an empty cell, not "N/A": the table renders the
      // same fact the JSON renders as null (docs/design/cli-design.md §4).
      const line = `${pad(r.id, colId)} ${pad(r.title, colTitle)} ${pad(r.company, colComp)} ${pad(r.location ?? "", colLoc)} ${pad(r.salary || "N/A", colSal)}`
      process.stdout.write(line + "\n")
    }
    return 0
  }

  // Plain format
  for (const r of results) {
    process.stdout.write(`ID: ${r.id}\n`)
    process.stdout.write(`Title: ${r.title}\n`)
    process.stdout.write(`Company: ${r.company}\n`)
    process.stdout.write(`Location: ${r.location ?? ""}\n`)
    if (r.salary) process.stdout.write(`Salary: ${r.salary}\n`)
    process.stdout.write(`URL: ${r.url}\n`)
    if (r.tags && r.tags.length > 0) process.stdout.write(`Tags: ${r.tags.join(", ")}\n`)
    process.stdout.write("\n")
  }
  return 0
}

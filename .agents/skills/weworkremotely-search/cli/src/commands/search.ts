// Implementation of `weworkremotely-cli search [flags]`
//
// The feed, the parsing and the filters live in the provider SDK. This file
// is the surface: it turns flags into a request, pages the result, and emits
// the output shape the portal-skill contract defines.

import { wwrProvider, writeError, toJob, type WWRJob } from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  category?: string
  tag?: string
  jobage?: number
  page?: number
  limit?: number
  format?: "json" | "table" | "plain"
}

/**
 * Pure pagination helper (offline-testable): --limit 0 means ALL results
 * (same convention as careers-search), otherwise slice the page window.
 */
export function paginateJobs<T>(filtered: T[], page: number, limit: number): T[] {
  if (limit === 0) return filtered
  const startIndex = (page - 1) * limit
  return filtered.slice(startIndex, startIndex + limit)
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  const page = opts.page && opts.page > 0 ? opts.page : 1
  const limit = opts.limit !== undefined && opts.limit >= 0 ? opts.limit : 20
  const format = opts.format || "json"

  try {
    // The SDK applies every filter; the CLI then pages the result, so its
    // own pagination rule stays in one place.
    const result = await wwrProvider.search({
      query: opts.query,
      location: opts.location,
      jobAgeDays: opts.jobage,
      limit: 0,
      extra: { category: opts.category, tag: opts.tag },
    })
    const jobs = paginateJobs(result.rows.map(toJob), page, limit)

    return emitResults(jobs, jobs.length, page, format)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    writeError(`search failed: ${msg}`, "FETCH_ERROR")
    return 1
  }
}

function emitResults(
  jobs: WWRJob[],
  totalCount: number,
  page: number,
  format: "json" | "table" | "plain",
): number {
  if (format === "json") {
    const output = {
      meta: {
        count: totalCount,
        page,
      },
      results: jobs.map((j) => ({
        id: j.id,
        title: j.title,
        company: j.company ?? "Unknown",
        location: j.location ?? "",
        date: j.date,
        url: j.url,
        salary: j.salary,
        category: j.category,
        jobType: j.jobType,
        tags: j.tags,
      })),
    }
    process.stdout.write(JSON.stringify(output, null, 2) + "\n")
    return 0
  }

  if (format === "plain") {
    for (const j of jobs) {
      process.stdout.write(`ID: ${j.id}\n`)
      process.stdout.write(`Title: ${j.title}\n`)
      process.stdout.write(`Company: ${j.company ?? "Unknown"}\n`)
      process.stdout.write(`Location: ${j.location ?? ""}\n`)
      if (j.category) process.stdout.write(`Category: ${j.category}\n`)
      if (j.jobType) process.stdout.write(`Job Type: ${j.jobType}\n`)
      process.stdout.write(`URL: ${j.url}\n`)
      process.stdout.write(`Date: ${j.date ?? ""}\n`)
      if (j.tags.length > 0) process.stdout.write(`Tags: ${j.tags.join(", ")}\n`)
      process.stdout.write("\n---\n\n")
    }
    return 0
  }

  // format === 'table'
  if (jobs.length === 0) {
    process.stdout.write("No matching We Work Remotely jobs found.\n")
    return 0
  }

  const headers = ["ID", "TITLE", "COMPANY", "LOCATION", "TYPE"]
  const rows = jobs.map((j) => [
    j.id.length > 25 ? j.id.slice(0, 22) + "..." : j.id,
    j.title.length > 35 ? j.title.slice(0, 32) + "..." : j.title,
    (j.company ?? "Unknown").length > 20 ? (j.company ?? "Unknown").slice(0, 17) + "..." : (j.company ?? "Unknown"),
    (j.location ?? "").length > 25 ? (j.location ?? "").slice(0, 22) + "..." : (j.location ?? ""),
    j.jobType || "-",
  ])

  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ? r[i].length : 0))),
  )

  const formatRow = (cols: string[]) =>
    cols.map((c, i) => c.padEnd(colWidths[i])).join("  ")

  process.stdout.write(formatRow(headers) + "\n")
  process.stdout.write(colWidths.map((w) => "-".repeat(w)).join("  ") + "\n")
  for (const row of rows) {
    process.stdout.write(formatRow(row) + "\n")
  }

  return 0
}

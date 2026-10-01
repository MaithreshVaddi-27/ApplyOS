// Implementation of `weworkremotely-cli search [flags]`

import {
  fetchWWRFeed,
  writeError,
  type WWRJob,
} from "../helpers.js"

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

export async function runSearch(opts: SearchOpts): Promise<number> {
  const page = opts.page && opts.page > 0 ? opts.page : 1
  const limit = opts.limit !== undefined && opts.limit >= 0 ? opts.limit : 20
  const format = opts.format || "json"

  try {
    const allJobs = await fetchWWRFeed(opts.category)
    let filtered = allJobs

    if (opts.query) {
      const q = opts.query.toLowerCase()
      filtered = filtered.filter((j) => {
        const titleMatch = j.title.toLowerCase().includes(q)
        const companyMatch = j.company.toLowerCase().includes(q)
        const tagMatch = j.tags.some((t) => t.toLowerCase().includes(q))
        const descMatch = j.description ? j.description.toLowerCase().includes(q) : false
        const catMatch = j.category ? j.category.toLowerCase().includes(q) : false
        return titleMatch || companyMatch || tagMatch || descMatch || catMatch
      })
    }

    if (opts.location) {
      const loc = opts.location.toLowerCase()
      filtered = filtered.filter((j) => j.location.toLowerCase().includes(loc))
    }

    if (opts.tag) {
      const tagQuery = opts.tag.toLowerCase()
      filtered = filtered.filter(
        (j) =>
          j.tags.some((t) => t.toLowerCase().includes(tagQuery)) ||
          (j.description && j.description.toLowerCase().includes(tagQuery)),
      )
    }

    if (opts.jobage !== undefined && opts.jobage > 0) {
      const cutoff = Date.now() - opts.jobage * 24 * 60 * 60 * 1000
      filtered = filtered.filter((j) => {
        if (!j.date) return true
        const parsed = new Date(j.date).getTime()
        if (isNaN(parsed)) return true
        return parsed >= cutoff
      })
    }

    // Pagination
    const startIndex = (page - 1) * limit
    const paged = limit === 0 ? [] : filtered.slice(startIndex, startIndex + limit)

    return emitResults(paged, filtered.length, page, format)
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
        company: j.company,
        location: j.location,
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
      process.stdout.write(`Company: ${j.company}\n`)
      process.stdout.write(`Location: ${j.location}\n`)
      if (j.category) process.stdout.write(`Category: ${j.category}\n`)
      if (j.jobType) process.stdout.write(`Job Type: ${j.jobType}\n`)
      process.stdout.write(`URL: ${j.url}\n`)
      process.stdout.write(`Date: ${j.date}\n`)
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
    j.company.length > 20 ? j.company.slice(0, 17) + "..." : j.company,
    j.location.length > 25 ? j.location.slice(0, 22) + "..." : j.location,
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

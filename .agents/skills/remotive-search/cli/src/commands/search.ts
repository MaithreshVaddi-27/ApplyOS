// Implementation of `remotive-cli search`
//
// The filtering, paging and parsing live in the provider SDK. This file is
// the surface: it turns flags into a request, and rows into the output shape
// the portal-skill contract defines.

import { remotiveProvider, writeError, type RemotiveRow } from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  category?: string
  tag?: string
  jobage?: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  let page
  try {
    page = await remotiveProvider.search({
      query: opts.query,
      location: opts.location,
      tag: opts.tag,
      jobAgeDays: opts.jobage,
      page: opts.page,
      limit: opts.limit,
      extra: { category: opts.category },
    })
  } catch (err: any) {
    // This CLI has always reported a failed search as API_ERROR. The SDK's
    // shared mapping would say FETCH_ERROR; the surface translates, so the
    // code a consumer has always seen does not change.
    writeError(err.message || "failed to fetch listings from Remotive", "API_ERROR")
    return 1
  }

  const paginated = page.rows

  if (opts.format === "json") {
    const payload = {
      meta: {
        count: paginated.length,
        page: page.page,
      },
      results: paginated.map((j) => ({
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location,
        date: j.date,
        url: j.url,
        salary: j.salary ?? null,
        category: j.category ?? null,
        jobType: j.jobType ?? null,
        tags: j.tags ?? [],
      })),
    }
    process.stdout.write(JSON.stringify(payload, null, 2) + "\n")
    return 0
  }

  if (opts.format === "table") {
    if (paginated.length === 0) {
      process.stdout.write("No jobs found matching the criteria.\n")
      return 0
    }

    const headers = ["ID", "TITLE", "COMPANY", "LOCATION", "SALARY", "DATE"]
    const rows = paginated.map((j) => [
      j.id,
      truncate(j.title, 34),
      truncate(j.company ?? "", 20),
      truncate(j.location ?? "", 25),
      truncate(j.salary || "-", 15),
      formatDate(j.date),
    ])

    printTable(headers, rows)
    return 0
  }

  // plain text
  if (paginated.length === 0) {
    process.stdout.write("No jobs found matching the criteria.\n")
    return 0
  }

  for (const j of paginated) {
    process.stdout.write(`ID: ${j.id}\n`)
    process.stdout.write(`Title: ${j.title}\n`)
    process.stdout.write(`Company: ${j.company ?? ""}\n`)
    process.stdout.write(`Location: ${j.location ?? ""}\n`)
    if (j.salary) process.stdout.write(`Salary: ${j.salary}\n`)
    if (j.category) process.stdout.write(`Category: ${j.category}\n`)
    if (j.tags && j.tags.length > 0) process.stdout.write(`Tags: ${j.tags.join(", ")}\n`)
    process.stdout.write(`Date: ${j.date ?? ""}\n`)
    process.stdout.write(`URL: ${j.url}\n`)
    process.stdout.write("----------------------------------------\n")
  }

  return 0
}

function truncate(str: string, len: number): string {
  if (!str) return ""
  return str.length > len ? str.slice(0, len - 3) + "..." : str
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-"
  return dateStr.split("T")[0] || dateStr
}

function printTable(headers: string[], rows: string[][]): void {
  const colWidths = headers.map((h, i) => {
    let max = h.length
    for (const r of rows) {
      if (r[i] && r[i].length > max) max = r[i].length
    }
    return max
  })

  const headerLine = headers.map((h, i) => h.padEnd(colWidths[i])).join("  ")
  const dividerLine = colWidths.map((w) => "-".repeat(w)).join("  ")
  process.stdout.write(headerLine + "\n")
  process.stdout.write(dividerLine + "\n")
  for (const r of rows) {
    const rowLine = r.map((c, i) => (c || "").padEnd(colWidths[i])).join("  ")
    process.stdout.write(rowLine + "\n")
  }
}

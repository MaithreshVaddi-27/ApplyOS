// Implementation of `remotive-cli search`

import { fetchRemotiveJobs, type RemotiveJob } from "../helpers.js"

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
  let jobs: RemotiveJob[]
  try {
    jobs = await fetchRemotiveJobs({
      search: opts.query,
      category: opts.category,
      candidate_required_location: opts.location,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(JSON.stringify({ error: msg, code: "API_ERROR" }) + "\n")
    return 1
  }

  // Client-side refinement
  let filtered = jobs

  if (opts.query) {
    const q = opts.query.toLowerCase()
    filtered = filtered.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        (j.category && j.category.toLowerCase().includes(q)) ||
        (j.tags && j.tags.some((t) => t.toLowerCase().includes(q))) ||
        (j.description && j.description.toLowerCase().includes(q)),
    )
  }

  if (opts.location) {
    const loc = opts.location.toLowerCase()
    filtered = filtered.filter((j) => j.location.toLowerCase().includes(loc))
  }

  if (opts.category) {
    const cat = opts.category.toLowerCase().replace(/[-\s]/g, "")
    filtered = filtered.filter((j) =>
      j.category ? j.category.toLowerCase().replace(/[-\s]/g, "").includes(cat) : false,
    )
  }

  if (opts.tag) {
    const tagQ = opts.tag.toLowerCase()
    filtered = filtered.filter(
      (j) => j.tags && j.tags.some((t) => t.toLowerCase().includes(tagQ)),
    )
  }

  if (opts.jobage && opts.jobage > 0) {
    const now = Date.now()
    const maxAgeMs = opts.jobage * 24 * 60 * 60 * 1000
    filtered = filtered.filter((j) => {
      if (!j.date) return true
      const parsed = Date.parse(j.date)
      if (isNaN(parsed)) return true
      return now - parsed <= maxAgeMs
    })
  }

  const page = opts.page || 1
  const limit = opts.limit !== undefined ? opts.limit : 20

  const startIndex = (page - 1) * limit
  const paginated = limit > 0 ? filtered.slice(startIndex, startIndex + limit) : filtered

  if (opts.format === "json") {
    const payload = {
      meta: {
        count: paginated.length,
        page,
      },
      results: paginated.map((j) => ({
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location,
        date: j.date,
        url: j.url,
        salary: j.salary,
        category: j.category || null,
        jobType: j.jobType || null,
        tags: j.tags || [],
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
      truncate(j.company, 20),
      truncate(j.location, 25),
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
    process.stdout.write(`Company: ${j.company}\n`)
    process.stdout.write(`Location: ${j.location}\n`)
    if (j.salary) process.stdout.write(`Salary: ${j.salary}\n`)
    if (j.category) process.stdout.write(`Category: ${j.category}\n`)
    if (j.tags && j.tags.length > 0) process.stdout.write(`Tags: ${j.tags.join(", ")}\n`)
    process.stdout.write(`Date: ${j.date}\n`)
    process.stdout.write(`URL: ${j.url}\n`)
    process.stdout.write(`----------------------------------------\n`)
  }

  return 0
}

function truncate(str: string, len: number): string {
  if (!str) return ""
  return str.length > len ? str.slice(0, len - 3) + "..." : str
}

function formatDate(dateStr: string): string {
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

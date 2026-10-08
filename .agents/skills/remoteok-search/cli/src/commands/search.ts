// Implementation of `remoteok-cli search [flags]`

import { fetchApiJobs, writeError, type RemoteOkJob } from "../helpers.js"

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
    location: string
    date: string
    url: string
    salary?: string
    tags?: string[]
    description?: string
  }>
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  let jobs: RemoteOkJob[]
  try {
    jobs = await fetchApiJobs()
  } catch (err: any) {
    writeError(err.message || "failed to fetch listings from RemoteOK", "FETCH_ERROR")
    return 1
  }

  // Filter by query keywords
  if (opts.query) {
    const qWords = opts.query.toLowerCase().trim().split(/\s+/)
    jobs = jobs.filter((j) => {
      const targetText = [
        j.title,
        j.company,
        j.location,
        ...(j.tags || []),
        j.description || "",
      ]
        .join(" ")
        .toLowerCase()

      return qWords.every((w) => targetText.includes(w))
    })
  }

  // Filter by tag
  if (opts.tag) {
    const tagQuery = opts.tag.toLowerCase().trim()
    jobs = jobs.filter((j) =>
      (j.tags || []).some((t) => t.toLowerCase().includes(tagQuery)),
    )
  }

  // Filter by location
  if (opts.location) {
    const locQuery = opts.location.toLowerCase().trim()
    if (locQuery !== "remote" && locQuery !== "any" && locQuery !== "all") {
      jobs = jobs.filter((j) => {
        const loc = j.location.toLowerCase()
        if (loc.includes("worldwide") || loc === "") return true
        return loc.includes(locQuery)
      })
    }
  }

  // Filter by salary (minimum USD)
  if (opts.salary !== undefined) {
    const minSalary = opts.salary
    const salaryFiltered = jobs.filter(job => {
      // Keep if no salary info or if salary meets minimum
      if (!job.salary) return true
      try {
        // Extract numeric value from salary string (e.g., "$20,000 / year" or "$80k - $120k")
        const salaryMatch = job.salary.match(/[\d,]+/g)
        if (!salaryMatch) return true

        // Take the first number found (minimum salary)
        let salaryNum = parseFloat(salaryMatch[0].replace(/,/g, ''))

        // Handle k suffix (e.g., "80k" -> 80000)
        if (job.salary.toLowerCase().includes('k')) {
          salaryNum = salaryNum * 1000
        }

        return salaryNum >= minSalary
      } catch (e) {
        // If parsing fails, keep the job
        return true
      }
    })

    jobs = salaryFiltered
  }

  // Filter by jobage (posting date)
  if (opts.jobage && opts.jobage > 0) {
    const cutoff = Date.now() - opts.jobage * 24 * 60 * 60 * 1000
    jobs = jobs.filter((j) => {
      if (!j.date) return true
      const postTime = new Date(j.date).getTime()
      if (isNaN(postTime)) return true
      return postTime >= cutoff
    })
  }

  const total = jobs.length
  const page = Math.max(1, opts.page || 1)
  const limit = opts.limit && opts.limit > 0 ? opts.limit : 20

  const startIndex = (page - 1) * limit
  const pagedResults = jobs.slice(startIndex, startIndex + limit)

  return emitSearch(pagedResults, total, page, opts.format)
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
      const line = `${pad(r.id, colId)} ${pad(r.title, colTitle)} ${pad(r.company, colComp)} ${pad(r.location, colLoc)} ${pad(r.salary || "N/A", colSal)}`
      process.stdout.write(line + "\n")
    }
    return 0
  }

  // Plain format
  for (const r of results) {
    process.stdout.write(`ID: ${r.id}\n`)
    process.stdout.write(`Title: ${r.title}\n`)
    process.stdout.write(`Company: ${r.company}\n`)
    process.stdout.write(`Location: ${r.location}\n`)
    if (r.salary) process.stdout.write(`Salary: ${r.salary}\n`)
    process.stdout.write(`URL: ${r.url}\n`)
    if (r.tags && r.tags.length > 0) process.stdout.write(`Tags: ${r.tags.join(", ")}\n`)
    process.stdout.write("\n")
  }
  return 0
}

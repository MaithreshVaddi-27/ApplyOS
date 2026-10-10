// Implementation of `wayup-cli search`

import {
  BASE_URL,
  fetchWithBackoff,
  parseNextDataJobs,
  slugify,
  writeError,
  type WayupJobResult,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  type?: string
  page?: number
  limit?: number
  format: "json" | "table" | "plain"
}

export function buildSearchUrls(query?: string, location?: string, type = "entry-level-jobs"): string[] {
  const listingType = type === "internships" ? "internships" : "entry-level-jobs"
  const qSlug = query ? slugify(query) : ""
  const lSlug = location ? slugify(location) : ""

  const urls: string[] = []

  if (qSlug && lSlug) {
    urls.push(`${BASE_URL}/s/${listingType}/${qSlug}/${lSlug}/`)
    urls.push(`${BASE_URL}/s/${listingType}/${qSlug}/`)
    urls.push(`${BASE_URL}/s/${listingType}/_/${lSlug}/`)
  } else if (qSlug) {
    urls.push(`${BASE_URL}/s/${listingType}/${qSlug}/`)
    if (listingType !== "internships") {
      urls.push(`${BASE_URL}/s/internships/${qSlug}/`)
    }
  } else if (lSlug) {
    urls.push(`${BASE_URL}/s/${listingType}/_/${lSlug}/`)
    if (listingType !== "internships") {
      urls.push(`${BASE_URL}/s/internships/_/${lSlug}/`)
    }
  } else {
    urls.push(`${BASE_URL}/s/${listingType}/`)
    if (listingType !== "internships") {
      urls.push(`${BASE_URL}/s/internships/`)
    }
  }

  return urls
}

/**
 * P-M11: decide whether an empty result is an outage (exit 1) or a genuine
 * empty board (exit 0). Outage = zero final rows AND no fetch ever produced
 * rows AND at least one fetch errored. All fetches ok with zero rows — or
 * rows parsed but filtered out client-side — stays exit 0.
 */
export function isOutageEmpty(fetchErrors: number, anyRowsParsed: boolean, finalCount: number): boolean {
  return finalCount === 0 && !anyRowsParsed && fetchErrors > 0
}

// Table renderer. The ID column is sized to the longest id and never
// truncated — a cut id can't round-trip into `detail` (freehire convention);
// the fixed-width display columns truncate for scanning.
export function renderTable(pageResults: WayupJobResult[]): string {
  if (pageResults.length === 0) {
    return "No jobs found matching query."
  }
  const idW = Math.max("ID".length, ...pageResults.map((j) => j.id.length))
  const cell = (s: string, w: number) => (s.length > w ? s.slice(0, w - 1) + "…" : s).padEnd(w)

  const rows = [
    `${"ID".padEnd(idW)} ${cell("TITLE", 24)} ${cell("COMPANY", 24)} ${cell("LOCATION", 24)} TYPE`,
    "-".repeat(110),
  ]

  for (const j of pageResults) {
    const id = j.id.padEnd(idW)
    const title = cell(j.title, 24)
    const company = cell(j.company, 24)
    const locationStr = cell(j.location, 24)
    const typeStr = (j.type || "").slice(0, 20)

    rows.push(`${id} ${title} ${company} ${locationStr} ${typeStr}`)
  }

  return rows.join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  const query = opts.query?.trim() || ""
  const location = opts.location?.trim() || ""
  const listingType = opts.type?.trim() || "entry-level-jobs"

  const urls = buildSearchUrls(query, location, listingType)

  const seenIds = new Set<string>()
  const allResults: WayupJobResult[] = []
  let fetchErrors = 0
  let anyRowsParsed = false

  for (const url of urls) {
    const res = await fetchWithBackoff(url)
    if (!res || !res.ok) {
      fetchErrors++
      continue
    }

    const html = await res.text()
    const jobs = parseNextDataJobs(html)
    if (jobs.length > 0) anyRowsParsed = true

    for (const job of jobs) {
      if (!job.id || seenIds.has(job.id)) continue
      seenIds.add(job.id)
      allResults.push(job)
    }

    if (allResults.length >= (opts.limit || 50)) break
  }

  if (isOutageEmpty(fetchErrors, anyRowsParsed, allResults.length)) {
    writeError(
      `all ${urls.length} Wayup page fetch(es) failed or yielded no postings — the board may be unreachable or its markup may have drifted`,
      "SEARCH_FAILED",
    )
    return 1
  }

  // Client-side filtering if query or location was broad
  let filtered = allResults
  if (query) {
    const qLower = query.toLowerCase()
    const matchScore = (j: WayupJobResult) => {
      let score = 0
      if (j.title.toLowerCase().includes(qLower)) score += 2
      if (j.company.toLowerCase().includes(qLower)) score += 1
      if (j.description && j.description.toLowerCase().includes(qLower)) score += 1
      return score
    }
    const withScores = filtered.map((j) => ({ job: j, score: matchScore(j) }))
    if (withScores.some((x) => x.score > 0)) {
      withScores.sort((a, b) => b.score - a.score)
      filtered = withScores.map((x) => x.job)
    }
  }

  if (location) {
    const lLower = location.toLowerCase()
    const locMatches = filtered.filter(
      (j) =>
        j.location.toLowerCase().includes(lLower) ||
        (lLower === "remote" && (j.location.toLowerCase().includes("remote") || j.type?.includes("remote"))),
    )
    if (locMatches.length > 0) {
      filtered = locMatches
    }
  }

  const page = opts.page || 1
  const limit = opts.limit
  let pageResults = filtered
  if (limit !== undefined && limit > 0) {
    pageResults = filtered.slice(0, limit)
  }

  if (opts.format === "json") {
    const envelope = {
      meta: {
        count: pageResults.length,
        page,
      },
      results: pageResults.map((r) => ({
        id: r.id,
        title: r.title,
        company: r.company,
        location: r.location,
        date: r.date,
        url: r.url,
        salary: r.salary || null,
        type: r.type || null,
      })),
    }
    process.stdout.write(JSON.stringify(envelope, null, 2) + "\n")
    return 0
  }

  if (opts.format === "table") {
    process.stdout.write(renderTable(pageResults) + "\n")
    return 0
  }

  // Plain format
  for (const j of pageResults) {
    process.stdout.write(
      `ID: ${j.id}\nTitle: ${j.title}\nCompany: ${j.company}\nLocation: ${j.location}\nURL: ${j.url}\n\n`,
    )
  }

  return 0
}

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

export async function runSearch(opts: SearchOpts): Promise<number> {
  const query = opts.query?.trim() || ""
  const location = opts.location?.trim() || ""
  const listingType = opts.type?.trim() || "entry-level-jobs"

  const urls = buildSearchUrls(query, location, listingType)

  const seenIds = new Set<string>()
  const allResults: WayupJobResult[] = []

  for (const url of urls) {
    const res = await fetchWithBackoff(url)
    if (!res || !res.ok) continue

    const html = await res.text()
    const jobs = parseNextDataJobs(html)

    for (const job of jobs) {
      if (!job.id || seenIds.has(job.id)) continue
      seenIds.add(job.id)
      allResults.push(job)
    }

    if (allResults.length >= (opts.limit || 50)) break
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
    if (pageResults.length === 0) {
      process.stdout.write("No jobs found matching query.\n")
      return 0
    }

    const rows = [
      ["ID", "TITLE", "COMPANY", "LOCATION", "TYPE"].map((h) => h.padEnd(24)).join(" "),
      "-".repeat(110),
    ]

    for (const j of pageResults) {
      const id = (j.id.length > 20 ? j.id.slice(0, 18) + "…" : j.id).padEnd(24)
      const title = (j.title.length > 22 ? j.title.slice(0, 20) + "…" : j.title).padEnd(24)
      const company = (j.company.length > 22 ? j.company.slice(0, 20) + "…" : j.company).padEnd(24)
      const locationStr = (j.location.length > 22 ? j.location.slice(0, 20) + "…" : j.location).padEnd(24)
      const typeStr = (j.type || "").slice(0, 20)

      rows.push(`${id} ${title} ${company} ${locationStr} ${typeStr}`)
    }

    process.stdout.write(rows.join("\n") + "\n")
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

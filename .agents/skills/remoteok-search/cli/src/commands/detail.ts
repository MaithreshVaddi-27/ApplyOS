// Implementation of `remoteok-cli detail <id|slug|url>`

import {
  BASE_URL,
  fetchApiJobs,
  fetchWithBackoff,
  stripHtmlTags,
  writeError,
  type RemoteOkJob,
} from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export function buildDetailUrl(idOrUrl: string): string {
  const trimmed = idOrUrl.trim()
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed
  }
  if (trimmed.startsWith("/")) {
    return `${BASE_URL}${trimmed}`
  }
  return `${BASE_URL}/remote-jobs/${trimmed}`
}

export function extractIdFromUrl(idOrUrl: string): string {
  const trimmed = idOrUrl.trim()
  const match = trimmed.match(/\/remote-jobs\/(?:.*-)?(\d+)/) || trimmed.match(/(\d+)$/)
  return match ? match[1] : trimmed
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const searchId = opts.id.trim()
  const extractedNum = extractIdFromUrl(searchId)

  // 1. Try finding in API feed first (fastest and most accurate)
  try {
    const jobs = await fetchApiJobs()
    const found = jobs.find(
      (j) =>
        j.id === searchId ||
        j.id === extractedNum ||
        (j.slug && j.slug === searchId) ||
        (j.url && j.url === searchId) ||
        (j.url && j.url.endsWith(searchId)),
    )

    if (found) {
      return emitDetail(found, opts.format)
    }
  } catch {
    // Fall back to direct page fetch
  }

  // 2. Direct page fetch fallback
  const url = buildDetailUrl(searchId)
  const res = await fetchWithBackoff(url)

  if (!res || !res.ok) {
    writeError(`listing not found: ${opts.id}`, "NOT_FOUND")
    return 1
  }

  const html = await res.text()
  const detail = parseDetailFromHtml(html, url, extractedNum)

  if (!detail) {
    writeError(`failed to parse listing data for: ${opts.id}`, "PARSE_ERROR")
    return 1
  }

  return emitDetail(detail, opts.format)
}

function parseDetailFromHtml(html: string, url: string, fallbackId: string): RemoteOkJob | null {
  // Check for JSON-LD JobPosting schema
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)]
  for (const s of scripts) {
    try {
      const json = JSON.parse(s[1])
      if (json["@type"] === "JobPosting") {
        const title = json.title || ""
        const company = json.hiringOrganization?.name || ""
        const description = json.description ? stripHtmlTags(json.description) : ""
        const date = json.datePosted || ""
        let salary: string | undefined
        if (json.baseSalary?.value?.minValue || json.baseSalary?.value?.maxValue) {
          const min = json.baseSalary.value.minValue
          const max = json.baseSalary.value.maxValue
          const curr = json.baseSalary.currency || "$"
          salary = min === max ? `${curr}${min}` : `${curr}${min} - ${curr}${max}`
        }

        return {
          id: fallbackId,
          title,
          company,
          location: "Worldwide",
          date,
          url,
          salary,
          description,
        }
      }
    } catch {
      // Continue to next script
    }
  }

  // Fallback: extract title and description from meta tags / body
  const titleMatch = html.match(/<title>(.*?)<\/title>/i)
  const title = titleMatch ? titleMatch[1].replace(/ at .*/i, "").trim() : "Unknown Title"
  const compMatch = html.match(/at ([^<]+)<\/title>/i)
  const company = compMatch ? compMatch[1].trim() : "Unknown Company"

  return {
    id: fallbackId,
    title,
    company,
    location: "Worldwide",
    date: "",
    url,
    description: "Please visit the URL to view the complete job description.",
  }
}

function emitDetail(detail: RemoteOkJob, format: "json" | "plain"): number {
  if (format === "json") {
    process.stdout.write(JSON.stringify(detail, null, 2) + "\n")
    return 0
  }

  process.stdout.write(`Title: ${detail.title}\n`)
  process.stdout.write(`Company: ${detail.company}\n`)
  process.stdout.write(`Location: ${detail.location}\n`)
  if (detail.salary) process.stdout.write(`Salary: ${detail.salary}\n`)
  process.stdout.write(`URL: ${detail.url}\n`)
  if (detail.applyUrl) process.stdout.write(`Apply URL: ${detail.applyUrl}\n`)
  if (detail.tags && detail.tags.length > 0) process.stdout.write(`Tags: ${detail.tags.join(", ")}\n`)
  if (detail.description) {
    process.stdout.write(`\n--- Description ---\n\n${detail.description}\n`)
  }

  return 0
}

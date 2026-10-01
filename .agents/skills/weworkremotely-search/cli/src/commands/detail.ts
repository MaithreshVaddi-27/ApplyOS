// Implementation of `weworkremotely-cli detail <id|url>`

import {
  fetchWWRFeed,
  writeError,
  type WWRJob,
  CATEGORY_MAP,
} from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export function extractIdFromInput(idOrUrl: string): string {
  const trimmed = idOrUrl.trim()
  const match = trimmed.match(/remote-jobs\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : trimmed
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const searchId = opts.id.trim()
  const extractedId = extractIdFromInput(searchId)

  try {
    // First try main RSS feed
    const mainJobs = await fetchWWRFeed()
    let found = findJob(mainJobs, searchId, extractedId)

    // If not found in main feed, search category feeds
    if (!found) {
      const categories = Object.keys(CATEGORY_MAP)
      for (const cat of categories) {
        try {
          const catJobs = await fetchWWRFeed(cat)
          found = findJob(catJobs, searchId, extractedId)
          if (found) break
        } catch {
          // continue checking other feeds
        }
      }
    }

    if (found) {
      return emitDetail(found, opts.format)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    writeError(`failed to retrieve listing details: ${msg}`, "FETCH_ERROR")
    return 1
  }

  writeError(`listing not found: ${opts.id}`, "NOT_FOUND")
  return 1
}

function findJob(jobs: WWRJob[], searchId: string, extractedId: string): WWRJob | undefined {
  return jobs.find(
    (j) =>
      j.id === searchId ||
      j.id === extractedId ||
      j.url === searchId ||
      j.url.endsWith(searchId) ||
      j.url.includes(searchId) ||
      j.id.toLowerCase() === searchId.toLowerCase() ||
      j.id.toLowerCase() === extractedId.toLowerCase(),
  )
}

function emitDetail(detail: WWRJob, format: "json" | "plain"): number {
  if (format === "json") {
    process.stdout.write(JSON.stringify(detail, null, 2) + "\n")
    return 0
  }

  process.stdout.write(`Title: ${detail.title}\n`)
  process.stdout.write(`Company: ${detail.company}\n`)
  process.stdout.write(`Location: ${detail.location}\n`)
  if (detail.category) process.stdout.write(`Category: ${detail.category}\n`)
  if (detail.jobType) process.stdout.write(`Job Type: ${detail.jobType}\n`)
  process.stdout.write(`URL: ${detail.url}\n`)
  process.stdout.write(`Date: ${detail.date}\n`)
  if (detail.tags && detail.tags.length > 0) {
    process.stdout.write(`Tags: ${detail.tags.join(", ")}\n`)
  }
  if (detail.description) {
    process.stdout.write(`\n--- Description ---\n\n${detail.description}\n`)
  }

  return 0
}

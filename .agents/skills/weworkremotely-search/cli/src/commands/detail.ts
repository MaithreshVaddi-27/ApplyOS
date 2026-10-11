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

    // If not found in main feed, sweep the category feeds concurrently.
    // Same request volume as a sequential sweep at a fraction of the
    // latency; per-feed failures stay isolated and priority still follows
    // CATEGORY_MAP order. The 60s deadline bounds the whole sweep.
    if (!found) {
      const deadline = Date.now() + 60000
      const feedUrls = [...new Set(Object.values(CATEGORY_MAP))]
      const keysByUrl = new Map<string, string>()
      for (const [key, url] of Object.entries(CATEGORY_MAP)) {
        if (!keysByUrl.has(url)) keysByUrl.set(url, key)
      }
      const settled = await Promise.allSettled(
        feedUrls.map(async (url) => {
          if (Date.now() > deadline) return undefined
          try {
            return await fetchWWRFeed(keysByUrl.get(url))
          } catch {
            return undefined
          }
        }),
      )
      for (const [i] of feedUrls.entries()) {
        const s = settled[i]
        if (s.status !== "fulfilled" || !s.value) continue
        found = findJob(s.value, searchId, extractedId)
        if (found) break
      }
      if (!found && Date.now() > deadline) {
        writeError("detail lookup timed out after 60s", "PARSE_ERROR")
        return 1
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

/**
 * P-M13: exact matching only. The old includes()/endsWith() fallbacks turned
 * a "dev" query into the "backend-dev-xyz1" posting. Exact id/url
 * (case-insensitive — WWR ids are URL slugs) first; the only fallback is a
 * dash-anchored url tail ("-xyz", never a mid-token substring) and only when
 * exactly one job carries it.
 */
export function findJob(jobs: WWRJob[], searchId: string, extractedId: string): WWRJob | undefined {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\/+$/, "")
  const nSearch = norm(searchId)
  const nExt = norm(extractedId)
  const exact = jobs.find(
    (j) => norm(j.id) === nSearch || norm(j.id) === nExt || norm(j.url) === nSearch,
  )
  if (exact) return exact
  if (!nExt) return undefined
  const cands = jobs.filter(
    (j) => norm(j.url).endsWith(`/${nExt}`) || norm(j.url).endsWith(`-${nExt}`),
  )
  return cands.length === 1 ? cands[0] : undefined
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

// Implementation of `weworkremotely-cli detail <id|url>`
//
// The lookup lives in the provider SDK: which feeds to sweep, and the
// exact-match rule. This file is the surface: it calls the provider and
// prints what it gets.

import { extractWwrId, toJob, wwrProvider, writeError, type WWRJob } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export function extractIdFromInput(idOrUrl: string): string {
  return extractWwrId(idOrUrl)
}

/**
 * Find one posting by id or url.
 *
 * Kept under the name the CLI has always exposed. The SDK owns the rule:
 * exact id or url first, and the only fallback is a dash-anchored url tail,
 * and only when exactly one posting carries it.
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

export async function runDetail(opts: DetailOpts): Promise<number> {
  const searchId = opts.id.trim()
  const extractedId = extractIdFromInput(searchId)

  try {
    const detail = toJob(await wwrProvider.detail(searchId));
    return emitDetail(detail, opts.format)
  } catch (err: any) {
    // This CLI has always reported a missing posting as NOT_FOUND and any
    // other failure as FETCH_ERROR. The surface translates, so the codes a
    // consumer has always seen do not change.
    const code = err?.code === "not-found" ? "NOT_FOUND" : "FETCH_ERROR"
    writeError(err?.message || `failed to retrieve listing details: ${opts.id}`, code)
    return 1
  }
}

function emitDetail(detail: WWRJob, format: "json" | "plain"): number {
  if (format === "json") {
    // The contract's detail shape: the search card plus the body. The SDK's
    // own `guid` is not part of it.
    process.stdout.write(
      JSON.stringify(
        {
          id: detail.id,
          title: detail.title,
          company: detail.company ?? "Unknown",
          location: detail.location ?? "",
          date: detail.date,
          url: detail.url,
          salary: detail.salary,
          category: detail.category ?? undefined,
          jobType: detail.jobType ?? undefined,
          tags: detail.tags,
          description: detail.description ?? undefined,
        },
        null,
        2,
      ) + "\n",
    )
    return 0
  }

  process.stdout.write(`Title: ${detail.title}\n`)
  process.stdout.write(`Company: ${detail.company ?? "Unknown"}\n`)
  process.stdout.write(`Location: ${detail.location ?? ""}\n`)
  if (detail.category) process.stdout.write(`Category: ${detail.category}\n`)
  if (detail.jobType) process.stdout.write(`Job Type: ${detail.jobType}\n`)
  process.stdout.write(`URL: ${detail.url}\n`)
  process.stdout.write(`Date: ${detail.date ?? ""}\n`)
  if (detail.tags && detail.tags.length > 0) {
    process.stdout.write(`Tags: ${detail.tags.join(", ")}\n`)
  }
  if (detail.description) {
    process.stdout.write(`\n--- Description ---\n\n${detail.description}\n`)
  }

  return 0
}

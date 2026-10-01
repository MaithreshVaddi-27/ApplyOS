// Implementation of `remotive-cli detail <id|url>`

import {
  fetchRemotiveJobs,
  writeError,
  type RemotiveJob,
} from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export function extractIdFromInput(idOrUrl: string): string {
  const trimmed = idOrUrl.trim()
  const match = trimmed.match(/(\d+)$/) || trimmed.match(/remote-jobs\/.*-(\d+)/)
  return match ? match[1] : trimmed
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const searchId = opts.id.trim()
  const extractedId = extractIdFromInput(searchId)

  try {
    const jobs = await fetchRemotiveJobs({})
    const found = jobs.find(
      (j) =>
        j.id === searchId ||
        j.id === extractedId ||
        j.url === searchId ||
        j.url.endsWith(searchId) ||
        j.url.includes(searchId),
    )

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

function emitDetail(detail: RemotiveJob, format: "json" | "plain"): number {
  if (format === "json") {
    process.stdout.write(JSON.stringify(detail, null, 2) + "\n")
    return 0
  }

  process.stdout.write(`Title: ${detail.title}\n`)
  process.stdout.write(`Company: ${detail.company}\n`)
  process.stdout.write(`Location: ${detail.location}\n`)
  if (detail.salary) process.stdout.write(`Salary: ${detail.salary}\n`)
  if (detail.category) process.stdout.write(`Category: ${detail.category}\n`)
  if (detail.jobType) process.stdout.write(`Job Type: ${detail.jobType}\n`)
  process.stdout.write(`URL: ${detail.url}\n`)
  process.stdout.write(`Date: ${detail.date}\n`)
  if (detail.tags && detail.tags.length > 0) process.stdout.write(`Tags: ${detail.tags.join(", ")}\n`)
  if (detail.description) {
    process.stdout.write(`\n--- Description ---\n\n${detail.description}\n`)
  }

  return 0
}

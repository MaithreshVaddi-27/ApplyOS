// Implementation of `remotive-cli detail <id|url>`
//
// The lookup and the exact-match rules live in the provider SDK. This file is
// the surface: it calls the provider and prints what it gets.

import { remotiveProvider, writeError, type RemotiveRow } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  try {
    const detail = await remotiveProvider.detail(opts.id)
    return emitDetail(detail as RemotiveRow, opts.format)
  } catch (err: any) {
    // This CLI has always reported a failed fetch as FETCH_ERROR and a
    // missing posting as NOT_FOUND. The surface translates, so the codes a
    // consumer has always seen do not change.
    const code = err?.code === "not-found" ? "NOT_FOUND" : "FETCH_ERROR"
    writeError(err.message || `failed to retrieve listing details: ${opts.id}`, code)
    return 1
  }
}

function emitDetail(detail: RemotiveRow, format: "json" | "plain"): number {
  if (format === "json") {
    process.stdout.write(JSON.stringify(detail, null, 2) + "\n")
    return 0
  }

  process.stdout.write(`Title: ${detail.title}\n`)
  process.stdout.write(`Company: ${detail.company ?? ""}\n`)
  process.stdout.write(`Location: ${detail.location ?? ""}\n`)
  if (detail.salary) process.stdout.write(`Salary: ${detail.salary}\n`)
  if (detail.category) process.stdout.write(`Category: ${detail.category}\n`)
  if (detail.jobType) process.stdout.write(`Job Type: ${detail.jobType}\n`)
  process.stdout.write(`URL: ${detail.url}\n`)
  process.stdout.write(`Date: ${detail.date ?? ""}\n`)
  if (detail.tags && detail.tags.length > 0) process.stdout.write(`Tags: ${detail.tags.join(", ")}\n`)
  if (detail.description) {
    process.stdout.write(`\n--- Description ---\n\n${detail.description}\n`)
  }

  return 0
}

// Implementation of `remoteok-cli detail <id|slug|url>`
//
// The lookup, the exact-match rules, and the JSON-LD fallback all live in the
// provider SDK. This file is the surface: it calls the provider and prints
// what it gets.

import { isProviderError, remoteOkProvider, writeError, type RemoteOkJob } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  try {
    const detail = await remoteOkProvider.detail(opts.id)
    return emitDetail(detail as RemoteOkJob, opts.format)
  } catch (err: any) {
    // The provider distinguishes "not found" from "could not parse" from
    // "the board is down". Each keeps its own code, because they are
    // different facts for the candidate. The provider names the code, so
    // the mapping lives in one place rather than in every surface.
    const code = isProviderError(err) ? err.cliCode : "FETCH_ERROR"
    writeError(err.message || `failed to read listing: ${opts.id}`, code)
    return 1
  }
}

function emitDetail(detail: RemoteOkJob, format: "json" | "plain"): number {
  if (format === "json") {
    process.stdout.write(JSON.stringify(detail, null, 2) + "\n")
    return 0
  }

  process.stdout.write(`Title: ${detail.title}\n`)
  process.stdout.write(`Company: ${detail.company}\n`)
  process.stdout.write(`Location: ${detail.location ?? ""}\n`)
  if (detail.salary) process.stdout.write(`Salary: ${detail.salary}\n`)
  process.stdout.write(`URL: ${detail.url}\n`)
  if (detail.applyUrl) process.stdout.write(`Apply URL: ${detail.applyUrl}\n`)
  if (detail.tags && detail.tags.length > 0) process.stdout.write(`Tags: ${detail.tags.join(", ")}\n`)
  if (detail.description) {
    process.stdout.write(`\n--- Description ---\n\n${detail.description}\n`)
  }

  return 0
}

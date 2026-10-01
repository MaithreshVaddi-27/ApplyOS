// Implementation of `wayup-cli detail <id|url>`

import {
  BASE_URL,
  fetchWithBackoff,
  parseWindowDataDetail,
  writeError,
  type WayupDetail,
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
  return `${BASE_URL}/${trimmed}/`
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const url = buildDetailUrl(opts.id)
  const res = await fetchWithBackoff(url)

  if (!res || !res.ok) {
    if (res?.status === 404) {
      // Try fallback URL pattern if needed
      if (!opts.id.startsWith("http") && !opts.id.startsWith("i-")) {
        const fallbackUrl = `${BASE_URL}/i-j-${opts.id}/`
        const fbRes = await fetchWithBackoff(fallbackUrl)
        if (fbRes && fbRes.ok) {
          const html = await fbRes.text()
          const detail = parseWindowDataDetail(html, fallbackUrl)
          if (detail) return emitDetail(detail, opts.format)
        }
      }
      writeError(`listing not found: ${opts.id}`, "NOT_FOUND")
      return 1
    }
    writeError(`failed to fetch listing: HTTP ${res?.status || "network error"}`, "FETCH_ERROR")
    return 1
  }

  const html = await res.text()
  const detail = parseWindowDataDetail(html, url)

  if (!detail) {
    writeError(`failed to parse listing data for: ${opts.id}`, "PARSE_ERROR")
    return 1
  }

  return emitDetail(detail, opts.format)
}

function emitDetail(detail: WayupDetail, format: "json" | "plain"): number {
  if (format === "json") {
    process.stdout.write(JSON.stringify(detail, null, 2) + "\n")
    return 0
  }

  process.stdout.write(`Title: ${detail.title}\n`)
  process.stdout.write(`Company: ${detail.company}\n`)
  process.stdout.write(`Location: ${detail.location}\n`)
  if (detail.salary) process.stdout.write(`Salary: ${detail.salary}\n`)
  if (detail.type) process.stdout.write(`Type: ${detail.type}\n`)
  process.stdout.write(`URL: ${detail.url}\n`)
  if (detail.applyUrl) process.stdout.write(`Apply URL: ${detail.applyUrl}\n`)
  process.stdout.write(`\n--- Description ---\n\n${detail.description}\n`)

  return 0
}

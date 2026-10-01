// Data source: Cutshort public job-listing pages (server-rendered __NEXT_DATA__).
// No authentication required. Zero runtime dependencies. Personal use only —
// keep request volume at human levels and respect cutshort.io's access policies.

export const BASE_URL = "https://cutshort.io"

/** Honest UA token, per the repo's CLI convention (identifiable, no browser spoofing). */
const UA = "cutshort-search-cli/1.0 (personal job search; repo: applyos)"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

/** Fetch with exponential backoff on 429/5xx. Returns "" on a 404. */
export async function fetchText(url: string): Promise<string> {
  const maxRetries = 4
  let delay = 600
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return ""
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.text()
  }
  throw new Error("Request failed after max retries")
}

interface NextData {
  props?: { pageProps?: { dehydratedState?: { queries?: Array<{
    queryKey?: unknown[]
    state?: { data?: { data?: { pageData?: Record<string, unknown> } } }
  }> } } }
}

/**
 * Extract and parse the embedded __NEXT_DATA__ JSON from a Cutshort page.
 * Returns null when the page has no such payload (error page, markup drift) —
 * callers decide whether that means empty results or a loud failure.
 */
export function extractNextData(html: string): NextData | null {
  const match = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
  )
  if (!match) return null
  try {
    return JSON.parse(match[1]) as NextData
  } catch {
    return null
  }
}

/**
 * Find a dehydrated react-query entry by its first queryKey element
 * ("jobListData" for category pages, "jobData" for detail pages) and return
 * its pageData payload. Returns null when absent — never a guessed shape.
 */
export function pageDataFor(next: NextData | null, key: string): Record<string, unknown> | null {
  const queries = next?.props?.pageProps?.dehydratedState?.queries ?? []
  const entry = queries.find((q) => q?.queryKey?.[0] === key)
  const pageData = entry?.state?.data?.data?.pageData
  return pageData && typeof pageData === "object" ? pageData : null
}

export function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** ISO timestamp -> YYYY-MM-DD; null when absent or unparseable. Never invented. */
export function toIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

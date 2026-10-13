// Helper utilities for wayup-cli: fetching with backoff, Next.js / window.__data parsing, error handling.

export const BASE_URL = "https://www.wayup.com"
export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

export { writeError } from "../../../cli-shared/src/errors.js"
export function stripHtmlTags(html: string): string {
  if (!html) return ""
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export async function fetchWithBackoff(
  url: string,
  maxRetries = 4,
  baseDelayMs = 500,
): Promise<Response | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        // A hung portal must never hang /scrape: 15s per attempt, then retry/fail.
        signal: AbortSignal.timeout(15000),
      })

      if (res.status === 404) {
        return res
      }

      if (res.status === 429 || res.status >= 500) {
        if (attempt === maxRetries) return res
        const jitter = Math.floor(Math.random() * 200)
        const delay = baseDelayMs * Math.pow(2, attempt) + jitter
        await new Promise((r) => setTimeout(r, delay))
        continue
      }

      return res
    } catch (err) {
      if (attempt === maxRetries) {
        return null
      }
      const delay = baseDelayMs * Math.pow(2, attempt)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  return null
}

export interface WayupJobResult {
  id: string
  title: string
  /** Missing values are null, never "" - an empty string reads as a value that
   *  was stated and found empty, and passes `!== null` checks downstream. */
  company: string | null
  location: string | null
  date: string | null
  url: string
  salary?: string
  type?: string
  description?: string
}

export function parseNextDataJobs(html: string): WayupJobResult[] {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s)
  if (!match) return []

  try {
    const json = JSON.parse(match[1])
    const results = json.props?.pageProps?.view?.data?.results || []
    if (!Array.isArray(results)) return []

    return results.map((r: any) => {
      const idStr = r.slug || String(r.id || r.randomId || "")
      const fullUrl = r.publicListingPage || (r.slug ? `${BASE_URL}/${r.slug}/` : "")
      // "Remote" is a real answer only when the listing says isRemote; a
      // location-less listing states no location, so null - never a guess.
      const locationStr =
        r.geoZipCodes?.map((g: any) => g.fullTitle || `${g.city}, ${g.state}`).filter(Boolean).join("; ") ||
        (r.isRemote ? "Remote" : null)

      return {
        id: idStr,
        title: r.title || r.positionTitle || "",
        company: r.company?.name || null,
        location: locationStr,
        date: r.liveStartAt || r.datePosted || null,
        url: fullUrl,
        salary: r.compensation || undefined,
        type: r.jobListingType || undefined,
        description: r.responsibilities ? stripHtmlTags(r.responsibilities) : undefined,
      }
    })
  } catch {
    return []
  }
}

export interface WayupDetail {
  id: string
  url: string
  title: string
  company: string | null
  location: string | null
  /** Mandatory in the search-output contract: present but null when the board
   *  omits it. Omitting the key entirely breaks any consumer that reads it. */
  date: string | null
  salary?: string
  type?: string
  description: string
  qualifications?: string
  applyUrl?: string
}

export function parseWindowDataDetail(html: string, fallbackUrl = ""): WayupDetail | null {
  const match = html.match(/window\.__data\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/)
  if (match) {
    // SECURITY: never eval remote HTML. The blob is JSON except for
    // `undefined` literals, so substitute those with null (a pure data
    // transform — nothing executes) and strict-parse. Anything else
    // non-JSON yields null and the caller reports PARSE_ERROR.
    let data: any
    try {
      data = JSON.parse(match[1].replace(/:\s*undefined\b/g, ":null"))
    } catch {
      return null
    }
    try {
      const listing = Object.values(data.publicBaselistingStore?.byId || {})[0] as any
      if (listing) {
        const idStr = listing.slug || String(listing.id || listing.randomId || "")
        const loc =
          listing.geoZipCodes?.map((g: any) => g.fullTitle).filter(Boolean).join("; ") ||
          (listing.isRemote ? "Remote" : null)
        const fullDesc = [listing.responsibilities, listing.qualifications, listing.skills]
          .filter(Boolean)
          .map((s) => stripHtmlTags(String(s)))
          .join("\n\n")

        return {
          id: idStr,
          url: listing.publicListingPage || fallbackUrl,
          title: listing.title || listing.positionTitle || "",
          company: listing.company?.name || null,
          location: loc,
          date: listing.liveStartAt || listing.datePosted || null,
          salary: listing.compensation || undefined,
          type: listing.jobListingType || undefined,
          description: fullDesc || stripHtmlTags(listing.responsibilities || ""),
          qualifications: listing.qualifications ? stripHtmlTags(listing.qualifications) : undefined,
          applyUrl: listing.thirdPartyApplyLink || undefined,
        }
      }
    } catch {
      // fallback to HTML regex
    }
  }

  // No structured listing data: report PARSE_ERROR (null) instead of
  // fabricating a detail from og:title (no verified company, location, or id).
  return null
}

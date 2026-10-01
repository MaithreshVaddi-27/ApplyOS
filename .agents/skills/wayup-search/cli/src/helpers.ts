// Helper utilities for wayup-cli: fetching with backoff, Next.js / window.__data parsing, error handling.

export const BASE_URL = "https://www.wayup.com"
export const USER_AGENT = "Mozilla/5.0 (compatible; wayup-cli/1.0)"

export interface ErrorEnvelope {
  error: string
  code: string
}

export function writeError(message: string, code = "ERROR"): void {
  const env: ErrorEnvelope = { error: message, code }
  process.stderr.write(JSON.stringify(env) + "\n")
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

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
  company: string
  location: string
  date: string
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
      const locationStr =
        r.geoZipCodes?.map((g: any) => g.fullTitle || `${g.city}, ${g.state}`).filter(Boolean).join("; ") ||
        (r.isRemote ? "Remote" : "")

      return {
        id: idStr,
        title: r.title || r.positionTitle || "",
        company: r.company?.name || "",
        location: locationStr,
        date: r.liveStartAt || r.datePosted || "",
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
  company: string
  location: string
  salary?: string
  type?: string
  description: string
  qualifications?: string
  applyUrl?: string
}

export function parseWindowDataDetail(html: string, fallbackUrl = ""): WayupDetail | null {
  const match = html.match(/window\.__data\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/)
  if (match) {
    try {
      const data = new Function("return " + match[1])()
      const listing = Object.values(data.publicBaselistingStore?.byId || {})[0] as any
      if (listing) {
        const idStr = listing.slug || String(listing.id || listing.randomId || "")
        const loc =
          listing.geoZipCodes?.map((g: any) => g.fullTitle).filter(Boolean).join("; ") ||
          (listing.isRemote ? "Remote" : "")
        const fullDesc = [listing.responsibilities, listing.qualifications, listing.skills]
          .filter(Boolean)
          .map((s) => stripHtmlTags(String(s)))
          .join("\n\n")

        return {
          id: idStr,
          url: listing.publicListingPage || fallbackUrl,
          title: listing.title || listing.positionTitle || "",
          company: listing.company?.name || "",
          location: loc,
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

  // Fallback: regex extraction from DOM and OpenGraph tags
  const titleMatch = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i)
  const descMatch = html.match(/<meta\s+(?:property="og:description"|name="description")\s+content="([^"]*)"/i)

  if (titleMatch) {
    return {
      id: fallbackUrl.split("/").filter(Boolean).pop() || "unknown",
      url: fallbackUrl,
      title: stripHtmlTags(titleMatch[1]),
      company: "",
      location: "",
      description: descMatch ? stripHtmlTags(descMatch[1]) : "",
    }
  }

  return null
}

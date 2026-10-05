// Data source: Internshala public job/internship listings across India.
// No authentication required. Zero runtime dependencies.
// Personal use only.

export const BASE_URL = "https://internshala.com"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; internshala-cli/1.0)"

/** Fetch HTML with exponential backoff on 429/5xx. Returns "" on a 404. */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 5
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
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

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
}

export interface JobDetail extends JobCard {
  salary: string | null
  description: string | null
  skills: string[]
  perks: string[]
  numberOfOpenings: string | null
  whoCanApply: string | null
}

/**
 * Client-side query-relevance filter. Internshala's combined keyword+city URL
 * can fall back to a city listing page (e.g. sales roles for any tech query in
 * Hyderabad), so keep only cards whose title or company matches ALL query
 * words. Words match on stem-prefix (>= 5 shared chars) so "developer" matches
 * a "Development" title; generic collisions like "Business Development" for a
 * "web development" query are dropped because the other word doesn't match.
 * Like careers-search's query filter this is a hard filter — if nothing
 * matches, an empty result is more truthful than an unrelated city page.
 */
export function filterByQuery(cards: JobCard[], query: string): JobCard[] {
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((w) => w.length > 1)
  if (words.length === 0) return cards
  // Match two tokens when one extends the other (intern ↔ internship) or when
  // they share a >= 7-char stem (developer ↔ development). The stem threshold
  // stays above the 6-char "intern" shared by internship/international so a
  // query for one does not surface the other.
  const stemsMatch = (a: string, b: string): boolean => {
    if (a === b) return true
    const min = Math.min(a.length, b.length)
    let shared = 0
    while (shared < min && a[shared] === b[shared]) shared++
    return (min >= 5 && shared === min) || shared >= 7
  }
  return cards.filter((c) => {
    const tokens = `${c.title} ${c.company ?? ""}`
      .toLowerCase()
      .split(/[^a-z0-9+#]+/)
      .filter(Boolean)
    return words.every((w) => tokens.some((t) => stemsMatch(w, t)))
  })
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

export function clean(html: string): string {
  return decodeHtmlEntities(stripTags(html))
}

/** Slugify query string for Internshala URL paths. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Parse the search response: a list of job/internship cards.
 * We split on `id="individual_internship_` and parse each chunk independently
 * so one malformed card cannot break the rest.
 */
export function parseJobCards(html: string): JobCard[] {
  const results: JobCard[] = []
  const chunks = html.split(/id="individual_internship_/).slice(1)

  for (const chunk of chunks) {
    // Title
    const titleMatch =
      chunk.match(/class="job-title-href"[^>]*>([^<]+)<\/a>/i) ||
      chunk.match(/class="job-internship-name"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i) ||
      chunk.match(/class="heading_4_5 profile"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i)
    if (!titleMatch) continue
    const title = clean(titleMatch[1])
    if (!title) continue

    // URL & ID
    const hrefMatch = chunk.match(/data-href=['"]([^'"]+)['"]/i)
    let rawPath = hrefMatch ? hrefMatch[1].split("?")[0] : ""
    if (!rawPath) {
      const linkMatch = chunk.match(/class="job-title-href"[^>]*href=['"]([^'"]+)['"]/i)
      rawPath = linkMatch ? linkMatch[1].split("?")[0] : ""
    }
    const url = rawPath ? (rawPath.startsWith("http") ? rawPath : `${BASE_URL}${rawPath}`) : ""

    // ID is derived from the URL path slug (e.g. `software-developer-178876`) or the numeric ID
    let id = ""
    if (rawPath) {
      const slugParts = rawPath.replace(/^\/(?:job|internship)\/detail\//, "").replace(/\/$/, "")
      id = slugParts
    }
    if (!id) {
      const numMatch = chunk.match(/^(\d+)/)
      id = numMatch ? numMatch[1] : ""
    }
    if (!id) continue

    // Company
    const compMatch =
      chunk.match(/class="company-name"[^>]*>\s*([\s\S]*?)\s*<\/p>/i) ||
      chunk.match(/class="link_display_like_text"[^>]*>([^<]+)<\/a>/i) ||
      chunk.match(/class="heading_6 company_name"[^>]*>[\s\S]*?<p[^>]*>([^<]+)<\/p>/i)
    const company = compMatch ? clean(compMatch[1]) || null : null

    // Location
    const locMatch =
      chunk.match(/class="[^"]*locations[^"]*"[\s\S]*?<a[^>]*>([^<]+)<\/a>/i) ||
      chunk.match(/class="[^"]*locations[^"]*"[\s\S]*?<span>\s*([^<]+)\s*<\/span>/i)
    const location = locMatch ? clean(locMatch[1]) || null : null

    // Date / recency
    const dateMatch = chunk.match(
      /class="(?:status-inactive|status-success|status-info|status-warning|status-container)"[^>]*>[\s\S]*?<span>\s*([^<]+)\s*<\/span>/i,
    )
    const date = dateMatch ? clean(dateMatch[1]) || null : null

    results.push({
      id,
      title,
      company,
      location,
      date,
      url: url || `${BASE_URL}/job/detail/${id}`,
    })
  }

  return results
}

/** Parse a single job/internship detail page. */
export function parseJobDetail(html: string, url: string, id: string): JobDetail {
  // Title
  const titleMatch =
    html.match(/class="profile_on_detail_page"[^>]*>([^<]+)<\/span>/i) ||
    html.match(/class="job-internship-name"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i) ||
    html.match(/class="heading_4_5 profile"[^>]*>([^<]+)<\/h[12]>/i) ||
    html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  const title = titleMatch ? clean(titleMatch[1]) : "Job Detail"

  // Company
  const compMatch =
    html.match(/class="link_display_like_text"[^>]*>([^<]+)<\/a>/i) ||
    html.match(/class="company-name"[^>]*>([^<]+)<\/p>/i) ||
    html.match(/class="heading_6 company_name"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i)
  const company = compMatch ? clean(compMatch[1]) || null : null

  // Location
  const locMatch =
    html.match(/class="[^"]*locations[^"]*"[\s\S]*?<a[^>]*>([^<]+)<\/a>/i) ||
    html.match(/class="[^"]*locations[^"]*"[\s\S]*?<span>\s*([^<]+)\s*<\/span>/i) ||
    html.match(/id="location_names"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i)
  const location = locMatch ? clean(locMatch[1]) || null : null

  // Salary / Stipend
  const stipendMatch =
    html.match(/class=['"]stipend['"][^>]*>([^<]+)<\/span>/i) ||
    html.match(/class=['"]desktop['"][^>]*>([^<]+)<\/span>/i) ||
    html.match(/class=['"]salary_heading['"][^>]*>([^<]+)<\/div>/i)
  const salary = stipendMatch ? clean(stipendMatch[1]) || null : null

  // Description
  let description: string | null = null
  const descMatch =
    html.match(/class="text-container(?:\s+about_job_text)?"[^>]*>([\s\S]*?)<\/div>/i) ||
    html.match(/class="internship_details"[\s\S]*?<div class="text-container"[^>]*>([\s\S]*?)<\/div>/i)
  if (descMatch) {
    description = decodeHtmlEntities(
      descMatch[1]
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<li[^>]*>/gi, "• ")
        .replace(/<\/li>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s+\n/g, "\n\n")
        .trim(),
    )
  }

  // Skills
  const skills: string[] = []
  const skillChunks = html.split(/class="round_tabs"/).slice(1)
  for (const sc of skillChunks) {
    const m = sc.match(/^[^>]*>([^<]+)<\/span>/)
    if (m) {
      const s = clean(m[1])
      if (s && !skills.includes(s)) skills.push(s)
    }
  }

  // Perks
  const perks: string[] = []
  const perkSection = html.match(/class="round_tabs_container perks_container"[^>]*>([\s\S]*?)<\/div>/i)
  if (perkSection) {
    const perkMatches = perkSection[1].match(/class="round_tabs"[^>]*>([^<]+)<\/span>/gi) || []
    for (const pm of perkMatches) {
      const p = clean(pm)
      if (p && !perks.includes(p)) perks.push(p)
    }
  }

  // Number of openings
  const openingsMatch = html.match(/class="other_detail_item_row"[\s\S]*?Number of openings[\s\S]*?<div class="text">(\d+)<\/div>/i)
  const numberOfOpenings = openingsMatch ? openingsMatch[1] : null

  // Who can apply
  let whoCanApply: string | null = null
  const whoMatch = html.match(/class="who_can_apply"[\s\S]*?<div class="text-container"[^>]*>([\s\S]*?)<\/div>/i)
  if (whoMatch) {
    whoCanApply = clean(whoMatch[1].replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
  }

  return {
    id,
    title,
    company,
    location,
    date: null,
    salary,
    description,
    skills,
    perks,
    numberOfOpenings,
    whoCanApply,
    url: url || `${BASE_URL}/job/detail/${id}`,
  }
}

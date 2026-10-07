// Data source: Naukri.com public job listings across India.
// No authentication required. Zero runtime dependencies.
// Personal use only.

export const BASE_URL = "https://www.naukri.com"

/**
 * Parse Naukri's relative posting labels ("30+ Days Ago", "Few Hours Ago",
 * "Just Now") to a millisecond timestamp. "+" caps at the shown number;
 * unrecognised text returns NaN and callers keep the card.
 */
export function parsePostedAgo(text: string | null): number {
  if (!text) return NaN
  const t = text.trim().toLowerCase()
  if (t === "just now") return Date.now()
  const m = t.match(/(\d+)\+?\s*(minute|hour|day|week|month)s?\s+ago/)
  if (!m) return NaN
  const n = parseInt(m[1], 10)
  const unitMs: Record<string, number> = {
    minute: 60_000,
    hour: 3_600_000,
    day: 86_400_000,
    week: 604_800_000,
    month: 2_592_000_000,
  }
  return Date.now() - n * unitMs[m[2]]
}

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

/** Fetch HTML with exponential backoff on 429/5xx. Returns "" on a 404. */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 4
  let delay = 600
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
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
  experience?: string | null
  salary?: string | null
  date: string | null
  url: string
}

export interface JobDetail extends JobCard {
  description: string | null
  skills: string[]
  role?: string | null
  industry?: string | null
  functionalArea?: string | null
  employmentType?: string | null
  education?: string | null
  companyDetails?: string | null
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

/** Slugify query string for URL paths. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Deterministic non-crypto hash (djb2, hex). Used ONLY to mint stable
 * fallback IDs when a listing carries no numeric ID — Math.random() here
 * used to break dedup and detail round-trips across runs.
 */
export function stableHash(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
  }
  return h.toString(16).padStart(8, "0")
}

/**
 * Parse Naukri search results page.
 * Supports modern cust-job-tuple / srp-jobtuple-wrapper structure and legacy article wrappers.
 */
export function parseJobCards(html: string): JobCard[] {
  const results: JobCard[] = []

  // Check for JSON embedded in __NEXT_DATA__ or window.__INITIAL_STATE__ if present
  const stateMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
  if (stateMatch) {
    try {
      const data = JSON.parse(stateMatch[1])
      const jobList = data?.props?.pageProps?.initialState?.searchResult?.jobDetails || []
      for (const item of jobList) {
        if (!item.jobId && !item.jobTitle) continue
        const title = item.title || item.jobTitle || "Untitled Role"
        const company = item.companyName || null
        results.push({
          id: String(
            item.jobId ||
              item.groupId ||
              item.staticUrl ||
              `fallback-${stableHash(`${title}|${company || ""}`)}`,
          ),
          title,
          company,
          location: Array.isArray(item.placeholders)
            ? item.placeholders.find((p: any) => p.type === "location")?.label || null
            : item.location || null,
          experience: Array.isArray(item.placeholders)
            ? item.placeholders.find((p: any) => p.type === "experience")?.label || null
            : item.experience || null,
          salary: Array.isArray(item.placeholders)
            ? item.placeholders.find((p: any) => p.type === "salary")?.label || null
            : item.salary || null,
          date: item.createdDate || item.footerPlaceholderLabel || null,
          url: item.jdURL ? (item.jdURL.startsWith("http") ? item.jdURL : `${BASE_URL}${item.jdURL}`) : "",
        })
      }
      if (results.length > 0) return results
    } catch {
      // Fallback to HTML scraping
    }
  }

  // HTML splitting strategy on job tuple containers
  let chunks = html.split(/(?:class="[^"]*(?:srp-jobtuple-wrapper|cust-job-tuple|jobTuple)[^"]*")/i).slice(1)
  if (chunks.length === 0) {
    chunks = html.split(/<article\s+class="jobTuple"/i).slice(1)
  }

  for (const chunk of chunks) {
    // Title & URL
    const titleMatch =
      chunk.match(/<a[^>]*class="[^"]*title[^"]*"[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/i) ||
      chunk.match(/<a[^>]*href=['"]([^'"]+)['"][^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ||
      chunk.match(/<a[^>]*href=['"]([^'"]*job-listings-[^'"]+)['"][^>]*>([\s\S]*?)<\/a>/i)

    if (!titleMatch) continue

    const rawUrl = titleMatch[1]
    const title = clean(titleMatch[2])
    if (!title) continue

    const url = rawUrl.startsWith("http") ? rawUrl : `${BASE_URL}${rawUrl}`

    // Extract ID: numeric job IDs round-trip into detail; otherwise a
    // deterministic slug+hash (stable across runs, unlike random values).
    let id = ""
    const idAttrMatch = chunk.match(/data-job-id=['"]([^'"]+)['"]/i)
    if (idAttrMatch) {
      id = idAttrMatch[1]
    } else {
      const idFromUrl = url.match(/job-listings-.*?(\d{6,})/i) || url.match(/-(\d+)(?:\?|$)/i)
      id = idFromUrl
        ? idFromUrl[1]
        : `${slugify(title).slice(0, 30)}-${stableHash(`${title}|${url}`)}`
    }

    // Company
    const compMatch =
      chunk.match(/class="[^"]*comp-name[^"]*"[^>]*title=['"]([^'"]+)['"]/i) ||
      chunk.match(/class="[^"]*comp-name[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ||
      chunk.match(/class="[^"]*subTitle[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ||
      chunk.match(/class="[^"]*companyInfo[^"]*"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)
    const company = compMatch ? clean(compMatch[1]) || null : null

    // Experience
    const expMatch =
      chunk.match(/class="[^"]*exp-wrap[^"]*"[^>]*title=['"]([^'"]+)['"]/i) ||
      chunk.match(/class="[^"]*expwdth[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i) ||
      chunk.match(/title="([0-9\-\+]+\s*(?:Yrs|Years|yrs|years))"/i) ||
      chunk.match(/<span[^>]*class="[^"]*experience[^"]*"[^>]*>([\s\S]*?)<\/span>/i)
    const experience = expMatch ? clean(expMatch[1]) || null : null

    // Salary
    const salMatch =
      chunk.match(/class="[^"]*sal-wrap[^"]*"[^>]*title=['"]([^'"]+)['"]/i) ||
      chunk.match(/title="([0-9\-\.,]+\s*(?:Lacs|LPA|PA|P\.A\.|Lac))"/i) ||
      chunk.match(/<span[^>]*class="[^"]*salary[^"]*"[^>]*>([\s\S]*?)<\/span>/i) ||
      chunk.match(/class="[^"]*ni-job-tuple-icon-salary[^"]*"[\s\S]*?<span>([\s\S]*?)<\/span>/i)
    const salary = salMatch ? clean(salMatch[1]) || null : null

    // Location
    const locMatch =
      chunk.match(/class="[^"]*loc-wrap[^"]*"[^>]*title=['"]([^'"]+)['"]/i) ||
      chunk.match(/class="[^"]*locwdth[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i) ||
      chunk.match(/<span[^>]*class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\/span>/i)
    const location = locMatch ? clean(locMatch[1]) || null : null

    // Date
    const dateMatch =
      chunk.match(/class="[^"]*job-post-day[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i) ||
      chunk.match(/class="[^"]*date[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i)
    const date = dateMatch ? clean(dateMatch[1]) || null : null

    results.push({
      id,
      title,
      company,
      location,
      experience,
      salary,
      date,
      url,
    })
  }

  return results
}

/**
 * Parse a Naukri job detail page into structured data.
 */
export function parseJobDetail(html: string, url: string, id: string): JobDetail {
  // Title
  const titleMatch =
    html.match(/<h1[^>]*class="[^"]*jd-header-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const title = titleMatch ? clean(titleMatch[1]) : "Job Detail"

  // Company
  const compMatch =
    html.match(/class="[^"]*jd-header-comp-name[^"]*"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) ||
    html.match(/class="[^"]*jd-header-comp-name[^"]*"[^>]*>([\s\S]*?)<\/(?:div|a)>/i) ||
    html.match(/class="[^"]*company-name[^"]*"[^>]*>([\s\S]*?)<\/(?:div|a)>/i)
  const company = compMatch ? clean(compMatch[1]) || null : null

  // Location
  const locMatch =
    html.match(/class="[^"]*location[^"]*"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) ||
    html.match(/class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i) ||
    html.match(/class="[^"]*loc[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i)
  const location = locMatch ? clean(locMatch[1]) || null : null

  // Experience
  const expMatch =
    html.match(/class="[^"]*exp[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i) ||
    html.match(/(\d+\s*-\s*\d+\s*(?:years|yrs))/i)
  const experience = expMatch ? clean(expMatch[1]) || null : null

  // Salary
  const salMatch =
    html.match(/class="[^"]*salary[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i) ||
    html.match(/([0-9\-\.,]+\s*(?:Lacs|LPA|PA|P\.A\.|Lac))/i)
  const salary = salMatch ? clean(salMatch[1]) || null : null

  // Description
  const descMatch =
    html.match(/<section[^>]*class="[^"]*job-desc[^"]*"[^>]*>([\s\S]*?)<\/section>/i) ||
    html.match(/class="[^"]*dang-inner-html[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
    html.match(/class="[^"]*clearboth description[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
  const description = descMatch ? clean(descMatch[1]) || null : null

  // Key Skills
  const skills: string[] = []
  const skillsSection =
    html.match(/class="[^"]*key-skill[^"]*"[^>]*>([\s\S]*?)<\/section>/i) ||
    html.match(/class="[^"]*key-skills[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
  if (skillsSection) {
    const chipMatches = skillsSection[1].matchAll(/<(?:a|span)[^>]*class="[^"]*chip[^"]*"[^>]*>([\s\S]*?)<\/(?:a|span)>/gi)
    for (const m of chipMatches) {
      const skillText = clean(m[1])
      if (skillText && !skills.includes(skillText)) skills.push(skillText)
    }
  }

  // Role / Functional Area
  const roleMatch = html.match(/<span[^>]*>Role:?<\/span>\s*<span>([\s\S]*?)<\/span>/i)
  const role = roleMatch ? clean(roleMatch[1]) || null : null

  const industryMatch = html.match(/<span[^>]*>Industry Type:?<\/span>\s*<span>([\s\S]*?)<\/span>/i)
  const industry = industryMatch ? clean(industryMatch[1]) || null : null

  const functionalAreaMatch = html.match(/<span[^>]*>Functional Area:?<\/span>\s*<span>([\s\S]*?)<\/span>/i)
  const functionalArea = functionalAreaMatch ? clean(functionalAreaMatch[1]) || null : null

  const employmentTypeMatch = html.match(/<span[^>]*>Employment Type:?<\/span>\s*<span>([\s\S]*?)<\/span>/i)
  const employmentType = employmentTypeMatch ? clean(employmentTypeMatch[1]) || null : null

  const educationMatch = html.match(/<span[^>]*>Education:?<\/span>\s*<span>([\s\S]*?)<\/span>/i)
  const education = educationMatch ? clean(educationMatch[1]) || null : null

  return {
    id,
    title,
    company,
    location,
    experience,
    salary,
    date: null,
    url,
    description,
    skills,
    role,
    industry,
    functionalArea,
    employmentType,
    education,
  }
}

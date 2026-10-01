// Shared helpers for weworkremotely-cli: XML parsing, RSS fetching, backoff, and error formatting.

export const BASE_URL = "https://weworkremotely.com"
export const MAIN_RSS = "https://weworkremotely.com/remote-jobs.rss"
export const USER_AGENT = "Mozilla/5.0 (compatible; weworkremotely-cli/1.0)"

export const CATEGORY_MAP: Record<string, string> = {
  "full-stack": "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss",
  "fullstack": "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss",
  "remote-full-stack-programming-jobs": "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss",
  "front-end": "https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss",
  "frontend": "https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss",
  "remote-front-end-programming-jobs": "https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss",
  "back-end": "https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss",
  "backend": "https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss",
  "remote-back-end-programming-jobs": "https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss",
  "devops": "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
  "sysadmin": "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
  "devops-sysadmin": "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
  "remote-devops-sysadmin-jobs": "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
  "design": "https://weworkremotely.com/categories/remote-design-jobs.rss",
  "remote-design-jobs": "https://weworkremotely.com/categories/remote-design-jobs.rss",
  "product": "https://weworkremotely.com/categories/remote-product-jobs.rss",
  "remote-product-jobs": "https://weworkremotely.com/categories/remote-product-jobs.rss",
  "management": "https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss",
  "finance": "https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss",
  "management-finance": "https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss",
  "remote-management-and-finance-jobs": "https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss",
  "support": "https://weworkremotely.com/categories/remote-customer-support-jobs.rss",
  "customer-support": "https://weworkremotely.com/categories/remote-customer-support-jobs.rss",
  "remote-customer-support-jobs": "https://weworkremotely.com/categories/remote-customer-support-jobs.rss",
  "sales": "https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss",
  "marketing": "https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss",
  "sales-marketing": "https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss",
  "remote-sales-and-marketing-jobs": "https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss",
  "other": "https://weworkremotely.com/categories/all-other-remote-jobs.rss",
  "all-other": "https://weworkremotely.com/categories/all-other-remote-jobs.rss",
  "all-other-remote-jobs": "https://weworkremotely.com/categories/all-other-remote-jobs.rss",
}

export interface WWRJob {
  id: string
  title: string
  company: string
  location: string
  date: string
  url: string
  salary: string | null
  category?: string
  jobType?: string
  tags: string[]
  description?: string
}

export function writeError(message: string, code: string): void {
  process.stderr.write(
    JSON.stringify({
      error: message,
      code,
    }) + "\n",
  )
}

export function decodeHtmlEntities(str: string): string {
  if (!str) return ""
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
}

export function stripHtmlTags(html: string): string {
  if (!html) return ""
  let text = decodeHtmlEntities(html)
  text = text
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")

  text = decodeHtmlEntities(text)
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export async function fetchWithBackoff(
  url: string,
  maxRetries = 4,
  initialDelay = 500,
): Promise<Response | null> {
  let delay = initialDelay
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/rss+xml, application/xml, text/xml, */*",
        },
      })

      if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
        if (attempt < maxRetries) {
          const jitter = Math.random() * 200
          await new Promise((r) => setTimeout(r, delay + jitter))
          delay *= 2
          continue
        }
      }

      return res
    } catch (err) {
      if (attempt < maxRetries) {
        const jitter = Math.random() * 200
        await new Promise((r) => setTimeout(r, delay + jitter))
        delay *= 2
        continue
      }
      throw err
    }
  }
  return null
}

function extractTagContent(itemXml: string, tag: string): string {
  const match = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))
  return match ? match[1].trim() : ""
}

export function parseWWRItem(itemXml: string): WWRJob | null {
  const rawTitle = extractTagContent(itemXml, "title")
  if (!rawTitle) return null

  const decodedRawTitle = decodeHtmlEntities(rawTitle)
  const colonIndex = decodedRawTitle.indexOf(":")
  let company = ""
  let title = decodedRawTitle

  if (colonIndex > -1) {
    company = decodedRawTitle.slice(0, colonIndex).trim()
    title = decodedRawTitle.slice(colonIndex + 1).trim()
  }

  const link = extractTagContent(itemXml, "link") || extractTagContent(itemXml, "guid")
  if (!link) return null

  // Extract ID or slug from URL
  let id = link
  const urlMatch = link.match(/remote-jobs\/([a-zA-Z0-9_-]+)/)
  if (urlMatch) {
    id = urlMatch[1]
  }

  const region = decodeHtmlEntities(extractTagContent(itemXml, "region"))
  const country = decodeHtmlEntities(extractTagContent(itemXml, "country"))
  const state = decodeHtmlEntities(extractTagContent(itemXml, "state"))

  // Format clean location string
  let location = region || "Worldwide"
  if (country && country !== region) {
    if (location === "Worldwide" || location === "Anywhere in the World") {
      location = country
    } else {
      location = `${location} (${country})`
    }
  }
  if (state && !location.includes(state)) {
    location = `${location}, ${state}`
  }

  const category = decodeHtmlEntities(extractTagContent(itemXml, "category")) || undefined
  const jobType = decodeHtmlEntities(extractTagContent(itemXml, "type")) || undefined
  const rawSkills = extractTagContent(itemXml, "skills")
  const tags: string[] = []

  if (rawSkills) {
    const cleaned = decodeHtmlEntities(rawSkills)
      .replace(/\band\b/gi, ",")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    for (const tag of cleaned) {
      if (!tags.includes(tag)) tags.push(tag)
    }
  }

  const pubDate = extractTagContent(itemXml, "pubDate")
  let date = pubDate
  if (pubDate) {
    const parsed = new Date(pubDate)
    if (!isNaN(parsed.getTime())) {
      date = parsed.toISOString()
    }
  }

  const rawDescription = extractTagContent(itemXml, "description")
  const description = rawDescription ? stripHtmlTags(rawDescription) : undefined

  return {
    id,
    title,
    company: company || "Unknown",
    location,
    date,
    url: link,
    salary: null,
    category,
    jobType,
    tags,
    description,
  }
}

export async function fetchWWRFeed(category?: string): Promise<WWRJob[]> {
  let targetUrl = MAIN_RSS
  if (category) {
    const lower = category.toLowerCase().trim()
    const mapped = CATEGORY_MAP[lower]
    if (mapped) {
      targetUrl = mapped
    }
  }

  const res = await fetchWithBackoff(targetUrl)
  if (!res || !res.ok) {
    throw new Error(`Failed to fetch We Work Remotely feed: HTTP ${res?.status || "network error"}`)
  }

  const xml = await res.text()
  const rawItems = xml.split("<item>").slice(1)
  const jobs: WWRJob[] = []

  for (const raw of rawItems) {
    const itemXml = "<item>" + raw
    const job = parseWWRItem(itemXml)
    if (job) {
      jobs.push(job)
    }
  }

  return jobs
}

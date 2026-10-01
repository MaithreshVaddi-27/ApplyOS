// Helpers for wellfound-cli: fetching with backoff, Next.js Apollo state parsing, JSON-LD extraction, sanitization.

export const BASE_URL = "https://wellfound.com"
const USER_AGENT = "Mozilla/5.0 (compatible; wellfound-cli/1.0)"

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  salary: string | null
  remote: boolean
  experienceMin?: number | null
}

export interface JobDetail {
  id: string
  url: string
  title: string
  company: string | null
  location: string | null
  salary: string | null
  employmentType: string | null
  datePosted: string | null
  description: string
  skills?: string[]
}

export function writeError(message: string, code: string): void {
  process.stderr.write(JSON.stringify({ error: message, code }) + "\n")
}

export async function fetchWithBackoff(url: string, retries = 3): Promise<Response> {
  let attempt = 0
  let delay = 300

  while (true) {
    attempt++
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      })

      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        if (attempt >= retries) return res
        const jitter = Math.random() * 200
        await new Promise((resolve) => setTimeout(resolve, delay + jitter))
        delay *= 2
        continue
      }

      return res
    } catch (e) {
      if (attempt >= retries) throw e
      await new Promise((resolve) => setTimeout(resolve, delay))
      delay *= 2
    }
  }
}

export function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
}

export function stripHtmlTags(raw: string): string {
  return decodeHtmlEntities(
    raw
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li>/gi, "• ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function slugifyRole(query?: string): string {
  if (!query) return "software-engineer"
  const q = query.toLowerCase().trim()

  if (q.includes("software") || q.includes("developer") || q.includes("programmer") || q.includes("coder")) {
    return "software-engineer"
  }
  if (q.includes("data") && (q.includes("sci") || q.includes("analyst"))) {
    return "data-scientist"
  }
  if (q.includes("front") || q.includes("react") || q.includes("vue") || q.includes("ui") || q.includes("web")) {
    return "frontend-engineer"
  }
  if (q.includes("back") || q.includes("node") || q.includes("api") || q.includes("golang") || q.includes("java")) {
    return "backend-engineer"
  }
  if (q.includes("full") || q.includes("stack") || q.includes("fullstack")) {
    return "full-stack-engineer"
  }
  if (q.includes("prod") || q.includes("pm") || q.includes("owner")) {
    return "product-manager"
  }
  if (q.includes("devops") || q.includes("cloud") || q.includes("infra") || q.includes("sre")) {
    return "devops-engineer"
  }
  if (q.includes("ai") || q.includes("ml") || q.includes("machine") || q.includes("learning")) {
    return "machine-learning-engineer"
  }
  if (q.includes("mobile") || q.includes("ios") || q.includes("android") || q.includes("flutter")) {
    return "mobile-engineer"
  }
  if (q.includes("design") || q.includes("ux")) {
    return "designer"
  }

  return q.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "software-engineer"
}

export function slugifyLocation(loc?: string): string {
  if (!loc) return "india"
  const l = loc.toLowerCase().trim()

  if (l.includes("bangalore") || l.includes("bengaluru")) return "bangalore"
  if (l.includes("mumbai") || l.includes("bombay")) return "mumbai"
  if (l.includes("pune")) return "pune"
  if (l.includes("hyderabad")) return "hyderabad"
  if (l.includes("delhi") || l.includes("ncr") || l.includes("gurgaon") || l.includes("noida")) return "india"
  if (l.includes("chennai") || l.includes("kolkata")) return "india"
  if (l.includes("us") || l.includes("united states") || l.includes("america")) return "united-states"
  if (l.includes("remote")) return "india"

  return l.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "india"
}

interface ApolloJobListing {
  __typename: "JobListingSearchResult"
  id: string
  title: string
  slug: string
  description?: string
  jobType?: string
  liveStartAt?: number
  locationNames?: string[]
  remote?: boolean
  compensation?: string
  yearsExperienceMin?: number | null
}

interface ApolloStartup {
  __typename: "StartupResult"
  id: string
  name: string
  slug: string
  highlightedJobListings?: Array<{
    __ref?: string
  }>
}

export function parseNextDataJobs(html: string): JobCard[] {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!match) return []

  try {
    const json = JSON.parse(match[1])
    const apolloData = json.props?.pageProps?.apolloState?.data || {}

    const startups = Object.values(apolloData).filter(
      (v): v is ApolloStartup => (v as { __typename?: string }).__typename === "StartupResult",
    )

    const jobToCompany = new Map<string, string>()
    for (const s of startups) {
      for (const jobRef of s.highlightedJobListings || []) {
        const id = jobRef.__ref?.replace("JobListingSearchResult:", "")
        if (id) {
          jobToCompany.set(id, s.name)
        }
      }
    }

    const jobResults = Object.values(apolloData).filter(
      (v): v is ApolloJobListing => (v as { __typename?: string }).__typename === "JobListingSearchResult",
    )

    return jobResults.map((j) => {
      const fullId = j.slug ? `${j.id}-${j.slug}` : j.id
      const company = jobToCompany.get(j.id) || null
      const loc = j.locationNames && j.locationNames.length > 0 ? j.locationNames.join(", ") : "Remote"

      let date: string | null = null
      if (j.liveStartAt) {
        const d = new Date(j.liveStartAt * 1000)
        if (!isNaN(d.getTime())) {
          date = d.toISOString().split("T")[0]
        }
      }

      return {
        id: fullId,
        title: j.title,
        company,
        location: loc,
        date,
        url: `${BASE_URL}/jobs/${fullId}`,
        salary: j.compensation || null,
        remote: Boolean(j.remote),
        experienceMin: j.yearsExperienceMin,
      }
    })
  } catch {
    return []
  }
}

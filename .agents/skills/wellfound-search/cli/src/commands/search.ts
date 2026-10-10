import {
  BASE_URL,
  fetchWithBackoff,
  parseNextDataJobs,
  slugifyLocation,
  slugifyRole,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  experience?: number      // minimum years of experience
  salary?: number        // minimum salary in USD
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

export function buildSearchUrls(opts: SearchOpts): string[] {
  const roleSlug = slugifyRole(opts.query)
  const locSlug = slugifyLocation(opts.location)

  const urls: string[] = []

  if (opts.location) {
    // "remote" has its own hub (wellfound.com/remote) — the /role/l/ shape
    // 303-redirects for it, so query the hub instead of a country page.
    if (locSlug === "remote") {
      urls.push(`${BASE_URL}/remote`)
      urls.push(`${BASE_URL}/role/${roleSlug}`)
    } else {
      urls.push(`${BASE_URL}/role/l/${roleSlug}/${locSlug}`)
      urls.push(`${BASE_URL}/location/${locSlug}`)
    }
  } else if (opts.query) {
    urls.push(`${BASE_URL}/role/l/${roleSlug}/india`)
    urls.push(`${BASE_URL}/role/${roleSlug}`)
  } else {
    urls.push(`${BASE_URL}/location/india`)
    urls.push(`${BASE_URL}/role/software-engineer`)
  }

  return urls
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const id = c.id.slice(0, 18).padEnd(18)
    const title = (c.title || "").slice(0, 38).padEnd(38)
    const company = (c.company || "—").slice(0, 22).padEnd(22)
    const loc = (c.location || "—").slice(0, 20).padEnd(20)
    const date = c.date || "—"
    return `${id} ${title} ${company} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(18) +
    " " +
    "TITLE".padEnd(38) +
    " " +
    "COMPANY".padEnd(22) +
    " " +
    "LOCATION".padEnd(20) +
    " POSTED"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

/** Client-side keyword/location filters. A filter that matches nothing yields
 *  nothing — never the unfiltered board (P-B3: silent drop misrepresents results). */
export function applyWellfoundFilters(cards: JobCard[], opts: SearchOpts): JobCard[] {
  let out = cards

  if (opts.query) {
    const qLower = opts.query.toLowerCase().trim()
    const queryWords = qLower.split(/\s+/).filter(Boolean)
    out = out.filter((c) => {
      const fullText = `${c.title} ${c.company || ""} ${c.id}`.toLowerCase()
      return queryWords.some((w) => fullText.includes(w))
    })
  }

  if (opts.location) {
    const locLower = opts.location.toLowerCase().trim()
    out = out.filter((c) => c.location && c.location.toLowerCase().includes(locLower))
  }

  return out
}

export async function runSearch(opts: SearchOpts): Promise<number> {  try {
    const urls = buildSearchUrls(opts)
    let cards: JobCard[] = []

    for (const url of urls) {
      const res = await fetchWithBackoff(url)
      if (res.ok) {
        const html = await res.text()
        const parsed = parseNextDataJobs(html)
        if (parsed.length > 0) {
          cards = parsed
          break
        }
      }
    }

    cards = applyWellfoundFilters(cards, opts)

    // Client-side experience filtering
    if (opts.experience !== undefined) {
      const minYears = opts.experience
      const experienceFiltered = cards.filter(card => {
        // Keep if no experience info or if experience meets minimum
        if (card.experienceMin === null || card.experienceMin === undefined) return true
        return card.experienceMin >= minYears
      })
      cards = experienceFiltered
    }

    // Client-side salary filtering
    if (opts.salary !== undefined) {
      const minSalary = opts.salary
      const salaryFiltered = cards.filter(card => {
        // Keep if no salary info or if salary meets minimum
        if (!card.salary) return true
        try {
          // Extract numeric value from salary string (e.g., "$120,000" or "$80k - $120k")
          const salaryMatch = card.salary.match(/[\d,]+/g)
          if (!salaryMatch) return true

          // Take the first number found (minimum salary)
          const salaryNum = parseFloat(salaryMatch[0].replace(/,/g, ''))

          // Handle k suffix (e.g., "80k" -> 80000)
          if (card.salary.toLowerCase().includes('k')) {
            return salaryNum * 1000 >= minSalary
          }

          return salaryNum >= minSalary
        } catch (e) {
          // If parsing fails, keep the card
          return true
        }
      })

      cards = salaryFiltered
    }

    if (opts.limit !== undefined && opts.limit >= 0) {
      cards = cards.slice(0, opts.limit)
    }

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.date || "—"}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          {
            meta: {
              count: cards.length,
              page: opts.page,
            },
            results: cards,
          },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}

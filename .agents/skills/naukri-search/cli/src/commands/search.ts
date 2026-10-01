import {
  BASE_URL,
  htmlFetch,
  parseJobCards,
  slugify,
  writeError,
  type JobCard,
  type JobDetail,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  experience?: number      // minimum years of experience
  salary?: string          // salary range in LPA (e.g. "6-10")
  jobage?: number          // posted within N days
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

export function buildSearchUrl(opts: SearchOpts): string {
  const basePath = "/job/"
  let query = ""

  // Build query parameters
  const params = new URLSearchParams()

  if (opts.query) {
    params.set("keyword", opts.query)
  }

  if (opts.location) {
    params.set("location", opts.location)
  }

  // Experience filtering - Naukri uses experience parameter
  if (opts.experience !== undefined) {
    params.set("experience", String(opts.experience))
  }

  // Salary filtering - Naukri uses salary parameter in lakhs
  if (opts.salary !== undefined) {
    params.set("salary", opts.salary)
  }

  if (params.toString()) {
    query = "?" + params.toString()
  }

  // Add pagination
  if (opts.page > 1) {
    if (query) {
      query += "&"
    } else {
      query = "?"
    }
    query += "pageNo=" + String(opts.page)
  }

  return `${BASE_URL}${basePath}${query}`
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 40).padEnd(40)
    const company = (c.company || "—").slice(0, 24).padEnd(24)
    const loc = (c.location || "—").slice(0, 20).padEnd(20)
    const exp = (c.experience || "—").slice(0, 10).padEnd(10)
    const sal = (c.salary || "—").slice(0, 15).padEnd(15)
    return `${c.id.slice(0, 18).padEnd(18)} ${title} ${company} ${loc} ${exp} ${sal}`
  })
  const header =
    "ID".padEnd(18) +
    " " +
    "TITLE".padEnd(40) +
    " " +
    "COMPANY".padEnd(24) +
    " " +
    "LOCATION".padEnd(20) +
    " " +
    "EXP".padEnd(10) +
    " " +
    "SALARY (LPA)".padEnd(15)
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const url = buildSearchUrl(opts)
    const html = await htmlFetch(url)
    if (!html) {
      writeError(
        `search page came back empty (HTTP 404) at ${url} — Naukri's search URL shape may have changed (see url-reference.md)`,
        "SEARCH_FAILED",
      )
      return 1
    }
    let cards = parseJobCards(html)
    if (cards.length === 0 && /_next\/static|__NEXT_DATA__|__next/i.test(html)) {
      // Naukri server-renders nothing for server-side fetches: the SRP is a
      // JS shell and the JSON API is recaptcha-gated by IP. An empty result
      // here means "could not read", never "no jobs exist" — fail loudly so
      // /scrape falls back to site:naukri.com queries instead of reporting
      // an empty board.
      writeError(
        "Naukri served a JS application shell with no server-rendered postings (bot-gating from server IPs, or a query with no matches) — retry from a residential IP, use `detail` on a known posting URL, or fall back to WebSearch `site:naukri.com` queries",
        "SEARCH_BLOCKED",
      )
      return 1
    }

    // Client-side experience filtering (fallback if server-side doesn't work)
    if (opts.experience !== undefined) {
      const minYears = opts.experience
      const experienceFiltered = cards.filter(card => {
        // Try to extract experience from card if available
        if (!card.experience) return true // Keep if no experience info
        try {
          // Parse experience like "2-5 years", "3+ years", "Fresher"
          const expStr = card.experience.toLowerCase()
          if (expStr.includes("fresher") || expStr.includes("0")) {
            return minYears === 0
          }
          // Extract numbers from experience string
          const numMatch = expStr.match(/(\d+)/)
          if (numMatch) {
            const minExp = parseInt(numMatch[1])
            return minExp >= minYears
          }
          return true // If we can't parse, keep it
        } catch (e) {
          return true // If parsing fails, keep the card
        }
      })

      if (experienceFiltered.length > 0) {
        cards = experienceFiltered
      }
    }

    // Client-side salary filtering (fallback if server-side doesn't work)
    if (opts.salary !== undefined) {
      const wantedRange = opts.salary
      const salaryFiltered = cards.filter(card => {
        if (!card.salary) return true // Keep if no salary info
        try {
          // Parse salary like "6-10 LPA", "15-25 LPA", "Not Disclosed"
          const salStr = card.salary.toLowerCase()
          if (salStr.includes("not disclosed") || salStr.includes("confidential")) {
            return true // Keep if salary not disclosed
          }

          // Extract numbers from salary string (assuming LPA format)
          const numMatches = salStr.match(/(\d+(?:\.\d+)?)/g)
          if (numMatches && numMatches.length >= 2) {
            const minSal = parseFloat(numMatches[0])
            const maxSal = parseFloat(numMatches[1])

            // Parse user's salary range (e.g., "6-10")
            const userRange = wantedRange.split("-")
            if (userRange.length === 2) {
              const userMin = parseFloat(userRange[0])
              const userMax = parseFloat(userRange[1])

              // Check if there's overlap between ranges
              return !(maxSal < userMin || minSal > userMax)
            }
          }
          return true // If we can't parse, keep it
        } catch (e) {
          return true // If parsing fails, keep the card
        }
      })

      if (salaryFiltered.length > 0) {
        cards = salaryFiltered
      }
    }

    // Client-side jobage filtering
    if (opts.jobage !== undefined) {
      // Filter by date - Naukri shows posting dates
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - opts.jobage)

      const filtered = cards.filter(card => {
        if (!card.date) return true  // Keep if no date info
        try {
          // Try to parse various date formats Naukri might use
          const postedDate = new Date(card.date)
          return postedDate >= cutoffDate
        } catch (e) {
          // If date parsing fails, keep the card (don't filter out)
          return true
        }
      })

      if (filtered.length > 0) {
        cards = filtered
      }
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
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.date || "—"}\n  Experience: ${c.experience || "—"} · Salary: ${c.salary || "—"}\n  id: ${c.id}\n  ${c.url}`,
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
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
  type?: "jobs" | "internships"
  experience?: number  // years of experience
  salary?: string      // salary range in LPA
  jobage?: number      // posted within N days
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

export function buildSearchUrl(opts: SearchOpts): string {
  const section = opts.type === "internships" ? "internships" : "jobs"
  let path = `/${section}/`

  const qSlug = opts.query ? slugify(opts.query) : ""
  const lSlug = opts.location ? slugify(opts.location) : ""

  if (qSlug && lSlug) {
    path = `/${section}/${qSlug}-${section === "jobs" ? "jobs" : "internships"}-in-${lSlug}/`
  } else if (qSlug) {
    path = `/${section}/keywords-${qSlug}/`
  } else if (lSlug) {
    path = `/${section}/${section === "jobs" ? "jobs" : "internships"}-in-${lSlug}/`
  }

  if (opts.page > 1) {
    path += `page-${opts.page}/`
  }

  return `${BASE_URL}${path}`
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 40).padEnd(40)
    const company = (c.company || "—").slice(0, 24).padEnd(24)
    const loc = (c.location || "—").slice(0, 20).padEnd(20)
    const date = c.date || "—"
    return `${c.id.slice(0, 18).padEnd(18)} ${title} ${company} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(18) +
    " " +
    "TITLE".padEnd(40) +
    " " +
    "COMPANY".padEnd(24) +
    " " +
    "LOCATION".padEnd(20) +
    " POSTED"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const url = buildSearchUrl(opts)
    const html = await htmlFetch(url)
    let cards = parseJobCards(html)

    // Optional client-side location filtering if server didn't filter
    if (opts.location) {
      const locNorm = opts.location.toLowerCase().trim()
      const filtered = cards.filter((c) => c.location && c.location.toLowerCase().includes(locNorm))
      if (filtered.length > 0) {
        cards = filtered
      }
    }

    // Client-side jobage filtering
    if (opts.jobage !== undefined) {
      // Filter by date - Internshala shows posting dates
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - opts.jobage)

      const filtered = cards.filter(card => {
        if (!card.date) return true  // Keep if no date info
        try {
          // Try to parse various date formats Internshala might use
          const postedDate = new Date(card.date.replace(/-/g, '/'))
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

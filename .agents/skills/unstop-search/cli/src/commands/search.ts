import {
  API_URL,
  fetchWithBackoff,
  parseOpportunityCard,
  salaryToLpaRange,
  writeError,
  type JobCard,
  type UnstopOpportunityItem,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  type?: "jobs" | "internships"
  salary?: string      // salary range in LPA
  jobage?: number      // posted within N days
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

export function buildSearchApiUrl(opts: SearchOpts): string {
  const params = new URLSearchParams()
  params.set("opportunity", opts.type === "internships" ? "internships" : "jobs")
  params.set("page", String(opts.page))

  const searchTerms: string[] = []
  if (opts.query) searchTerms.push(opts.query)
  if (opts.location) searchTerms.push(opts.location)

  if (searchTerms.length > 0) {
    params.set("searchTerm", searchTerms.join(" "))
  }

  return `${API_URL}?${params.toString()}`
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const id = c.id.padEnd(10)
    const title = (c.title || "").slice(0, 38).padEnd(38)
    const company = (c.company || "—").slice(0, 24).padEnd(24)
    const loc = (c.location || "—").slice(0, 20).padEnd(20)
    const date = c.date || "—"
    return `${id} ${title} ${company} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(10) +
    " " +
    "TITLE".padEnd(38) +
    " " +
    "COMPANY".padEnd(24) +
    " " +
    "LOCATION".padEnd(20) +
    " POSTED"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const url = buildSearchApiUrl(opts)
    const res = await fetchWithBackoff(url)

    if (!res.ok) {
      writeError(`Unstop search API responded with status ${res.status}`, "API_ERROR")
      return 1
    }

    const payload = (await res.json()) as {
      data?: {
        data?: UnstopOpportunityItem[]
        total?: number
        current_page?: number
      }
    }

    const rawItems = payload.data?.data || []
    let cards = rawItems.map(parseOpportunityCard)

    // Optional client-side location refinement if requested
    if (opts.location) {
      const locNorm = opts.location.toLowerCase().trim()
      const filtered = cards.filter((c) => c.location && c.location.toLowerCase().includes(locNorm))
      if (filtered.length > 0) {
        cards = filtered
      }
    }

    // Client-side salary filtering — both sides in LPA (see salaryToLpaRange:
    // cards mix monthly INR and annual figures; raw comparison never filtered).
    if (opts.salary !== undefined) {
      const [minLpa, maxLpa] = opts.salary.split("-").map(parseFloat)
      const salaryFiltered = cards.filter((card) => {
        if (!card.salary) return true // Keep if no salary info
        const range = salaryToLpaRange(card.salary)
        if (!range) return true
        // Overlap test: keep the card when the ranges intersect.
        return (
          (isNaN(minLpa) || range[1] >= minLpa) &&
          (isNaN(maxLpa) || range[0] <= maxLpa)
        )
      })

      cards = salaryFiltered
    }

    // Client-side jobage filtering
    if (opts.jobage !== undefined) {
      // Filter by date - Unstop shows posting dates in updated_at
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - opts.jobage)

      const filtered = cards.filter(card => {
        if (!card.date) return true  // Keep if no date info
        const t = new Date(card.date).getTime() // new Date() never throws — check isNaN
        if (Number.isNaN(t)) return true
        return t >= cutoffDate.getTime()
      })

      cards = filtered
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
              total: payload.data?.total ?? cards.length,
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

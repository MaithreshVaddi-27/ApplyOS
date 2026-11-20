// Implementation of `unstop-cli search`
//
// The query building, the filtering and the parsing live in the provider SDK.
// This file is the surface: it turns flags into a request, and rows into the
// output shape the portal-skill contract defines.

import { unstopProvider, writeError, type UnstopRow } from "../helpers.js"

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

/** One card, in the shape the portal-skill contract's search result uses. */
interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  salary: string | null
  type: string | null
  /** Full-time / part-time / flexible (jobDetail.timing), so remote & part-time internships filter without a detail fetch. */
  employmentType: string | null
  /** Remote / hybrid / on-site (jobDetail.type). */
  workplaceType: string | null
}

/** One board row, in the shape the contract's search result uses. */
function toCard(r: UnstopRow): JobCard {
  return {
    id: r.id,
    // A posting the board did not title is called "Untitled". The CLI has
    // always done that, and the SDK carries the board's own title - empty
    // when the board stated none - so the placeholder is applied here.
    title: r.title || "Untitled",
    company: r.company,
    location: r.location,
    date: r.date,
    url: r.url,
    salary: r.salary ?? null,
    type: r.type,
    employmentType: r.employmentType,
    workplaceType: r.workplaceType,
  }
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
  let cards: JobCard[]
  let page: number
  let total: number
  try {
    const result = await unstopProvider.search({
      query: opts.query,
      location: opts.location,
      jobAgeDays: opts.jobage,
      page: opts.page,
      limit: opts.limit,
      extra: {
        opportunity: opts.type,
        salary_lpa: opts.salary,
      },
    })
    // The CLI's `--limit` is a cap on what it EMITS, and `--limit 0` emits
    // nothing. The SDK's `0` means "no cap", so the cap is applied here. The
    // two conventions are translated at the surface, and neither the CLI nor
    // the engine has to change.
    cards = (opts.limit === undefined ? result.rows : result.rows.slice(0, opts.limit)).map(toCard)
    page = result.page
    total = result.total
  } catch (e: any) {
    // This CLI has always reported a failed search as SEARCH_FAILED, and a
    // non-OK answer from the board as API_ERROR. The surface translates, so
    // the codes a consumer has always seen do not change.
    const code = e?.code === "http" ? "API_ERROR" : "SEARCH_FAILED"
    writeError(e?.message || "failed to search Unstop", code)
    return 1
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
            page,
            total,
          },
          results: cards,
        },
        null,
        2,
      ) + "\n",
    )
  }
  return 0
}

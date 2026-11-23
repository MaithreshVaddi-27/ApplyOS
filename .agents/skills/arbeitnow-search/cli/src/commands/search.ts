// Implementation of `arbeitnow-cli search [flags]`
//
// The fetching, parsing and filtering live in the provider SDK. This file is
// the surface: it turns flags into a request, pages the result, and emits the
// output shape the portal-skill contract defines.

import { arbeitnowProvider, writeError, type ArbeitnowRow } from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  remote?: boolean
  jobage?: number
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
  remote: boolean
  tags: string[]
  jobTypes: string[]
}

function toCard(r: ArbeitnowRow): JobCard {
  return {
    id: r.id,
    title: r.title,
    company: r.company,
    location: r.location,
    date: r.date,
    url: r.url,
    remote: r.remote,
    tags: r.tags,
    jobTypes: r.jobTypes,
  }
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const idW = Math.max(4, ...cards.map((c) => c.id.length))
  const titleW = Math.max(5, ...cards.map((c) => c.title.length))
  const companyW = Math.max(7, ...cards.map((c) => (c.company ?? "").length))
  const locW = Math.max(8, ...cards.map((c) => (c.location ?? "").length))
  const row = (cells: string[]) => cells.map((c, i) => c.slice(0, [idW, titleW, companyW, locW][i]).padEnd([idW, titleW, companyW, locW][i])).join("  ")
  const header = row(["ID", "TITLE", "COMPANY", "LOCATION"])
  return [header, "-".repeat(header.length), ...cards.map((c) => row([c.id, c.title, c.company ?? "", c.location ?? ""]))].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const page = await arbeitnowProvider.search({
      query: opts.query,
      location: opts.location,
      jobAgeDays: opts.jobage,
      page: opts.page,
      limit: opts.limit,
      extra: { remote: opts.remote },
    })
    const cards = page.rows.map(toCard)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company ?? "—"} · ${c.location ?? "—"}${c.remote ? " · remote" : ""} · ${c.date ?? "—"}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          { meta: { count: cards.length, page: page.page, total: page.total }, results: cards },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e: any) {
    const code = e?.code === "http" ? "API_ERROR" : "FETCH_ERROR"
    writeError(e?.message || "failed to fetch listings from Arbeitnow", code)
    return 1
  }
}

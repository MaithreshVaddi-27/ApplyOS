// Implementation of `freehire-cli search`
//
// The query building, the paging and the parsing live in the provider SDK.
// This file is the surface: it turns flags into a request, and rows into the
// output shape the portal-skill contract defines.
//
// The agent variant of the job search: the same query, ranking, and facets as
// the web's /jobs/search, but each hit carries the posting's full description
// instead of the search index's truncated preview - so a run reads every
// result without a follow-up `detail` per hit.

import {
  freehireProvider,
  writeError,
  type FreehireDescriptionFormat,
  type FreehireRow,
} from "../helpers.js"

export type DescriptionFormat = FreehireDescriptionFormat

export const DESCRIPTION_FORMATS: DescriptionFormat[] = ["markdown", "text", "html"]

export interface SearchOpts {
  query?: string
  jobage: number
  page: number
  limit: number
  format: "json" | "table" | "plain"
  descriptionFormat: DescriptionFormat
  // Hydrate full description bodies (the documented default). False keeps a
  // discovery pass cheap: bodies are ~73% of a default search payload, and
  // /scrape pre-filters by title before reading bodies anyway.
  includeDescription?: boolean
  // Experience and salary filters
  experience?: number // minimum years of experience
  salary?: number // minimum salary in USD
  // Facet filters (already parsed into value lists; empty means unset).
  regions: string[]
  countries: string[]
  cities: string[]
  seniority: string[]
  category: string[]
  skills: string[]
  company?: string
  workMode?: string // work_mode facet: remote | hybrid | onsite
  // Arbitrary facet escape hatch: param -> values, for the long tail of the vocabulary.
  facets: Record<string, string[]>
}

/** The request the SDK takes. The board's own parameters ride in `extra`. */
function toRequest(opts: SearchOpts) {
  return {
    query: opts.query,
    jobAgeDays: opts.jobage,
    page: opts.page,
    limit: opts.limit,
    extra: {
      include_description: opts.includeDescription,
      description_format: opts.descriptionFormat,
      experience_min: opts.experience,
      salary_min: opts.salary,
      work_mode: opts.workMode,
      company_slug: opts.company,
      regions: opts.regions,
      countries: opts.countries,
      cities: opts.cities,
      seniority: opts.seniority,
      category: opts.category,
      skills: opts.skills,
      ...opts.facets,
    },
  }
}

/**
 * The date portion (YYYY-MM-DD) of an ISO timestamp, or "—" when absent.
 */
function shortDate(date: string | null): string {
  return date ? date.slice(0, 10) : "—"
}

/**
 * One posting, in the shape the portal-skill contract's search result uses.
 *
 * The extra facet fields are a permitted superset. The board's `id` is its
 * public slug - the thing `detail <slug>` consumes.
 */
interface JobResult {
  id: string
  title: string
  company: string | null
  company_slug: string | null
  location: string | null
  date: string | null
  url: string
  work_mode: string | null
  regions: string[]
  countries: string[]
  skills: string[]
  description: string | null
}

function toResult(r: FreehireRow): JobResult {
  return {
    id: r.id,
    title: r.title,
    company: r.company,
    company_slug: r.company_slug,
    location: r.location,
    date: r.date,
    url: r.url,
    work_mode: r.work_mode,
    regions: r.regions,
    countries: r.countries,
    skills: r.skills,
    description: r.description ?? null,
  }
}

// Table columns: header, width, and the cell value. The SLUG column is sized to
// the longest slug so it is never truncated — a cut slug can't be looked up in
// `detail`; the fixed-width columns truncate for scanning.
interface Column {
  header: string
  width: number
  cell: (r: FreehireRow) => string
}

function renderTable(rows: JobResult[]): string {
  if (rows.length === 0) return "No results."
  const columns: Column[] = [
    { header: "SLUG", width: Math.max(4, ...rows.map((r) => r.id.length)), cell: (r) => r.id },
    { header: "TITLE", width: 38, cell: (r) => r.title },
    { header: "COMPANY", width: 22, cell: (r) => r.company ?? "—" },
    { header: "LOCATION", width: 20, cell: (r) => r.location ?? "—" },
    { header: "DATE", width: 10, cell: (r) => shortDate(r.date) },
  ]
  const row = (cells: string[]) => cells.map((c, i) => c.slice(0, columns[i].width).padEnd(columns[i].width)).join("  ")

  const header = row(columns.map((c) => c.header))
  const body = rows.map((r) => row(columns.map((c) => c.cell(r))))
  return [header, "-".repeat(header.length), ...body].join("\n")
}

function renderPlain(rows: JobResult[]): string {
  if (rows.length === 0) return "No results."
  const block = (r: JobResult) =>
    [
      r.title,
      `  ${r.company ?? "—"} · ${r.location ?? "—"} · ${shortDate(r.date)}`,
      `  slug: ${r.id}`,
      `  ${r.url}`,
    ].join("\n")
  return rows.map(block).join("\n\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const page = await freehireProvider.search(toRequest(opts))
    const rows = page.rows.map(toResult)

    if (opts.format === "table") {
      process.stdout.write(renderTable(rows) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(renderPlain(rows) + "\n")
    } else {
      process.stdout.write(
        JSON.stringify(
          { meta: { count: rows.length, page: page.page, total: page.total }, results: rows },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e) {
    // This CLI has always reported a failed search as SEARCH_FAILED.
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}

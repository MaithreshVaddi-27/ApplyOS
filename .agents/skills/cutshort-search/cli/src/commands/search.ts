import {
  BASE_URL,
  extractNextData,
  fetchText,
  pageDataFor,
  stripHtmlTags,
  toIsoDate,
  writeError,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  category?: string
  location?: string
  remote?: boolean
  jobage?: number
  limit?: number
  format: "json" | "table" | "plain"
}

export function buildCategoryUrl(opts: SearchOpts): string {
  const category = (opts.category ?? (opts.query ? `${slugify(opts.query)}-jobs` : "")).replace(/^\/+|\/+$/g, "")
  if (!category) {
    throw Object.assign(new Error("search needs a --category slug or a --query to derive one"), { code: "NO_CATEGORY" })
  }
  return `${BASE_URL}/jobs/${category}`
}

export function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

export interface NormalizedJob {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  salary?: string | null
  experience?: string | null
  remoteType?: string | null
  skills?: string[]
}

/** Extract the jobs array from a category page's NEXT_DATA payload. Never guesses a shape. */
export function parseCategoryPage(html: string): { jobs: NormalizedJob[]; liveJobCount: number | null } {
  const pageData = pageDataFor(extractNextData(html), "jobListData")
  if (!pageData || !Array.isArray(pageData.jobs)) return { jobs: [], liveJobCount: null }
  const jobs = (pageData.jobs as Record<string, unknown>[]).map(normalizeJob)
  const live = typeof pageData.liveJobCount === "number" ? pageData.liveJobCount : null
  return { jobs, liveJobCount: live }
}

export function normalizeJob(j: Record<string, unknown>): NormalizedJob {
  const facts = (j.jobFactSummary ?? {}) as Record<string, unknown>
  const exp = j.expRange as { min?: number; max?: number } | undefined
  const locations = Array.isArray(j.locations) ? (j.locations as string[]).join(", ") : null
  return {
    id: String(j._id ?? ""),
    title: (j.headline as string) || (facts.roleTitle as string) || "Untitled Role",
    company: ((j.companyDetails as { name?: string } | undefined)?.name ?? null) || null,
    // Search records carry locationsText; detail records carry the locations
    // array and jobFactSummary.locations — fall through in that order.
    location:
      (j.locationsText as string) ||
      (facts.locations as string) ||
      locations ||
      null,
    date: toIsoDate(facts.postedDate),
    url: (j.publicUrl as string) || "",
    salary: (j.salaryRangeText as string) || null,
    experience:
      typeof exp?.min === "number" && typeof exp?.max === "number"
        ? `${exp.min} - ${exp.max} yrs`
        : null,
    remoteType: (j.remoteType as string) || null,
    skills: Array.isArray(j.allSkills) ? (j.allSkills as string[]).slice(0, 10) : [],
  }
}

export function isRemoteFriendly(job: NormalizedJob): boolean {
  // Observed values: "remote_not_okay" for onsite/hybrid; remote boards read
  // remote_okay / remote_temporarily (never invented — matched defensively).
  return typeof job.remoteType === "string" && job.remoteType.startsWith("remote") && job.remoteType !== "remote_not_okay"
}

export function filterJobs(jobs: NormalizedJob[], opts: SearchOpts): NormalizedJob[] {
  let out = jobs
  if (opts.query) {
    const q = opts.query.toLowerCase()
    out = out.filter((j) =>
      `${j.title} ${j.company ?? ""} ${(j.skills ?? []).join(" ")}`.toLowerCase().includes(q),
    )
  }
  if (opts.location) {
    const loc = opts.location.toLowerCase()
    out = out.filter((j) => (j.location ?? "").toLowerCase().includes(loc))
  }
  if (opts.remote) {
    out = out.filter(isRemoteFriendly)
  }
  if (opts.jobage !== undefined) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - opts.jobage)
    // Undated rows pass: absence is not staleness.
    out = out.filter((j) => (j.date ? new Date(j.date) >= cutoff : true))
  }
  return out
}

function renderTable(jobs: NormalizedJob[]): string {
  if (jobs.length === 0) return "No results."
  const rows = jobs.map((j) =>
    [
      j.id.slice(0, 24).padEnd(24),
      j.title.slice(0, 38).padEnd(38),
      (j.company ?? "—").slice(0, 18).padEnd(18),
      (j.location ?? "—").slice(0, 20).padEnd(20),
      (j.date ?? "—").padEnd(10),
    ].join(" "),
  )
  const header =
    "ID".padEnd(24) + " " + "TITLE".padEnd(38) + " " + "COMPANY".padEnd(18) + " " + "LOCATION".padEnd(20) + " " + "DATE".padEnd(10)
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const url = buildCategoryUrl(opts)
    const html = await fetchText(url)
    if (!html) {
      writeError(`category page not found: ${url} — check the category slug (e.g. reactjs-jobs)`, "NOT_FOUND")
      return 1
    }
    const { jobs, liveJobCount } = parseCategoryPage(html)
    if (jobs.length === 0) {
      // Distinguish "empty page" from "parser lost the payload" loudly.
      writeError(
        "no jobs parsed from the category page — the page markup may have drifted (see url-reference.md)",
        "PARSE_EMPTY",
      )
      return 1
    }
    const filtered = filterJobs(jobs, opts).slice(0, opts.limit ?? jobs.length)
    if (opts.format === "table") {
      process.stdout.write(renderTable(filtered) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        filtered
          .map(
            (j) =>
              `${j.title}\n  ${j.company ?? "—"} · ${j.location ?? "—"} · ${j.date ?? "—"} · ${j.experience ?? "—"} · ${j.salary ?? "—"}\n  ${j.skills?.join(", ") ?? ""}\n  ${j.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          { meta: { count: filtered.length, category: (opts.category ?? slugify(opts.query ?? "") + "-jobs"), liveJobCount }, results: filtered },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e) {
    const code = (e as { code?: string }).code
    writeError(e instanceof Error ? e.message : String(e), typeof code === "string" ? code : "SEARCH_FAILED")
    return 1
  }
}

export { stripHtmlTags, toIsoDate }

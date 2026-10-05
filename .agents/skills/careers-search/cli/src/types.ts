// Shared types for the company-careers search CLI.
// One contract for every connector: fetch a company's public job board,
// normalize to the portal-skill search-output contract (title, company,
// location, date, url — always present), let the caller filter client-side.

export type BoardKind =
  | "amazon"
  | "salesforce"
  | "greenhouse"
  | "lever"
  | "ashby"
  | "smartrecruiters"
  | "workday"
  | "eightfold"

/** The normalized posting every connector must produce. */
export interface NormalizedJob {
  /** Board-local identifier used to rebuild the posting URL. */
  id: string
  title: string
  /** The employer whose careers site this is — never the ATS vendor. */
  company: string
  location: string
  /** ISO date (YYYY-MM-DD) when known, else null. Never invented. */
  date: string | null
  /** Absolute URL that resolves to the posting. */
  url: string
  description?: string
  /** Which board produced this row. */
  board: BoardKind
  /** The board slug / tenant identifier for the connector. */
  slug: string
}

/** One configured company board in companies.ts. */
export interface CompanyBoard {
  company: string
  board: BoardKind
  /** Connector-specific tenant id: greenhouse slug, workday tenant/site, amazon query params, etc. */
  slug: string
  /** Optional careers-site base URL, used by URL detection and detail rebuilds. */
  careersUrl?: string
  /** Optional region hint for display/filtering (e.g. "india", "global"). */
  region?: string
  /** Optional category hint for display (e.g. "mega-cap", "india-product", "gcc", "startup"). */
  category?: string
}

/** Options for a search run, translated from CLI flags. */
export interface SearchOpts {
  query?: string
  location?: string
  board?: BoardKind
  company?: string
  category?: string
  region?: string
  jobage?: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
  /** Hard per-company fetch cap. */
  maxPages?: number
  /** Posting type filter: jobs (full-time) | internships | all (default). */
  type?: "jobs" | "internships" | "all"
  /** Candidate stage: student defaults to internships; remote-global defaults to remote-only rows. */
  stage?: "student" | "fresher" | "experienced" | "remote-global"
}

/** The search-output contract (see .claude/skills/job-scraper/SKILL.md Step 2). */
export interface SearchResult {
  meta: {
    count: number
    page: number
    total: number
    /** True when either a --max-pages fetch cap or the --limit display cap cut results short. */
    truncated?: boolean
    boards: Array<{ board: BoardKind; company: string; count: number; ok: boolean; error?: string }>
  }
  results: NormalizedJob[]
}

/** A connector fetches and normalizes postings for one company board. */
export type Connector = (
  board: CompanyBoard,
  opts: { query?: string; maxPages: number },
) => Promise<NormalizedJob[]>

export function writeError(message: string, code: string): void {
  process.stderr.write(JSON.stringify({ error: message, code }) + "\n")
}

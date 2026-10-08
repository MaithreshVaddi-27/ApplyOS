// Origin: clean-room 2026-10-07, derived from public ATS JSON shapes. Author: OpenCode agent.
// Core contracts for ApplyOS Standalone. Every adapter speaks this language.

/** One job/internship row. `postedDate` is null when the source omits it — never invented. */
export interface JobPosting {
  id: string;
  title: string;
  company: string;
  location: string;
  /** ISO date (YYYY-MM-DD) or null when the source provides none. */
  postedDate: string | null;
  url: string;
  /** Which adapter produced this row, e.g. "greenhouse" or "naukri". */
  portal: string;
  /** How the row was obtained: live adapter call vs search-index fallback. */
  source: "adapter" | "fallback";
}

/** Per-source run notes merged into every search response. */
export interface SourceNote {
  portal: string;
  ok: boolean;
  /** True when this source hit its page cap and may hold more rows. */
  truncated?: boolean;
  error?: string;
}

export interface SearchMeta {
  total: number;
  truncated: boolean;
  notes: SourceNote[];
  /** Milliseconds the merged search took. Feeds the speed SLO. */
  elapsedMs: number;
}

export interface SearchOptions {
  query?: string;
  location?: string;
  limit?: number;
  /** Maximum rows old a posting may be (days). Older rows are flagged, not dropped. */
  maxAgeDays?: number;
  signal?: AbortSignal;
}

/** Lifecycle stages selecting portal sets and ranker weights. */
export type CandidateStage = "student" | "fresher" | "experienced" | "remote-global";

// Origin: clean-room 2026-11-13, Phase 4 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// The provider contract.
//
// One implementation per job board, behind one typed interface, exposed
// through two surfaces: the provider CLI that `/scrape` calls, and the engine
// that `applyos scrape` calls. The two surfaces used to carry their own
// parser for the same board, and they had drifted - different URLs, different
// id formats, different User-Agents, different ideas about what an absent
// location means.
//
// This module is the shape both surfaces agree on.
//
// The SDK has NO runtime dependencies. That is deliberate: it has to be
// importable from the engine workspace and from a provider CLI's own
// folder, and a dependency on the engine's core package would tie the CLIs
// to the engine's build.

/** The candidate stages, as the framework defines them. */
export type CandidateStage = "student" | "fresher" | "experienced" | "remote-global";

/** A posting, as the board states it. */
export interface ProviderRow {
  /** The board's own id. Stable within the board. */
  id: string;
  /** The board's own slug, when it has one. */
  slug?: string;
  title: string;
  company: string;
  /**
   * The posting's place, or null when the board states none.
   *
   * null is load-bearing: it is the difference between "the board did not say"
   * and "the board said nothing", and the difference between a real place and
   * a fabricated one. A surface that wants an empty string asks for it
   * explicitly rather than receiving one by accident.
   */
  location: string | null;
  /** The board's own date string, exactly as it gave it. */
  date: string | null;
  /** The posting's canonical URL. */
  url: string;
  /** The posting's description, if the board carries one. */
  description?: string;
  /** A display salary, if the board carries one. */
  salary?: string;
  /** The board's tags. */
  tags?: string[];
  /** Where to apply, when it differs from `url`. */
  applyUrl?: string;
}

/** What a caller asks for. Every field is optional. */
export interface SearchRequest {
  /** Keywords. A provider decides how to match them. */
  query?: string;
  /** A place. A provider decides how to match it. */
  location?: string;
  /** A board-specific category. */
  tag?: string;
  /** The minimum salary the caller will accept, in the board's currency. */
  salaryMin?: number;
  /** The oldest posting the caller will accept, in days. 0 means no limit. */
  jobAgeDays?: number;
  /** 1-indexed. */
  page?: number;
  /** The most rows the caller wants. 0 means no cap. */
  limit?: number;
  /** A hint about the candidate's stage, for boards that filter by it. */
  stage?: CandidateStage;
}

/** One page of results. */
export interface SearchPage<R extends ProviderRow = ProviderRow> {
  /** The rows on this page. */
  rows: R[];
  /** How many rows matched before paging. */
  total: number;
  /** The page that was returned, 1-indexed. */
  page: number;
  /** True when the source held more rows than this page carries. */
  truncated: boolean;
  /** Non-fatal notes: retries taken, a partial parse, a soft-200 response. */
  notes?: string[];
}

/** One posting, in full. */
export type PostingDetail<R extends ProviderRow = ProviderRow> = R & {
  /** The full text, verbatim. Never summarised. */
  description: string;
};

/** What kind of surface a board is. */
export type ProviderKind = "board" | "ats" | "aggregator";

/**
 * Every board implements this.
 *
 * A provider fetches and parses. It does not format, paginate for a
 * particular surface, or decide what a verdict is.
 */
export interface Provider<R extends ProviderRow = ProviderRow> {
  /** A stable identifier, e.g. "remoteok". Matches the registry key. */
  readonly id: string;
  /** The semver of this implementation, not of the board. */
  readonly version: string;
  readonly kind: ProviderKind;
  /** A human-readable name for run notes. */
  readonly displayName: string;
  /** The credential this provider needs, if any. */
  readonly requiresCredential?: { readonly envVar: string; readonly service: string };
  /** The URLs a caller may fetch, for the robots gate. */
  readonly seedUrls: readonly string[];

  /** List postings. */
  search(req: SearchRequest): Promise<SearchPage<R>>;
  /** Fetch one posting in full. */
  detail(ref: string): Promise<PostingDetail<R>>;
}

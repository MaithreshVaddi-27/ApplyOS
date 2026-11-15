// Origin: clean-room 2026-11-14, Phase 4 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// Remotive, implemented once.
//
// This replaces two parsers: the one in the remotive-search CLI and the one
// in applyos/packages/portals.
//
// The behaviour reproduced here is the CLI's, because the CLI is the surface
// `/scrape` uses and therefore the one a candidate sees.
//
// **Remotive's public endpoint ignores its query parameters.** Verified live
// against `https://remotive.com/api/remote-jobs` on 2026-11-14: the feed
// answered 16 postings for `?search=python`, for `?search=python&limit=3`, and
// for no parameters at all. Every filter is therefore applied client-side,
// which is what the CLI has always done.
//
// The engine's retired adapter believed the opposite - it sent `search=` and
// relied on the board to filter, so its results were never filtered at all.
// The engine now matches the way the CLI does.
//
// Two deliberate differences from the old CLI:
//
//   - An absent location, company or date is `null`, not an empty string. The
//     portal-skill contract (ADR-0006) requires it, and "Unknown" is not a
//     company.
//   - The User-Agent is `applyos/0.1 (personal use)`. The CLI sent a Chrome
//     UA to impersonate a browser; the 2026-10-09 audit recorded that
//     convention as a regression.

import { ProviderError } from "./errors.js";
import { providerFetch } from "./fetch.js";
import { decodeHtmlEntities } from "./text.js";
import type { PostingDetail, Provider, ProviderRow, SearchPage, SearchRequest } from "./types.js";

export const REMOTIVE_BASE_URL = "https://remotive.com";
export const REMOTIVE_API_URL = "https://remotive.com/api/remote-jobs";

/**
 * Remotive's own HTML-to-text rule.
 *
 * The SDK's shared `stripHtmlTags` is RemoteOK's, and the two boards'
 * descriptions do not flatten the same way: Remotive keeps a blank line
 * where a paragraph ends and drops a heading's text differently. A
 * description is read by the gates and checked by the Grounding Audit, so
 * its text must not change shape in a migration.
 */
export function stripRemotiveHtml(html: string): string {
  if (!html) return "";
  return decodeHtmlEntities(
    html
      .replace(/<br\s*[\/]?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

/** The shape of one row in the feed. */
export interface RemotiveRawJob {
  id: number | string;
  /** The board's own url. It states one for every posting today. */
  url?: string;
  title: string;
  company_name: string;
  company_logo?: string;
  company_logo_url?: string;
  category?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
}

/** One posting from the feed, in the SDK's neutral shape. */
export interface RemotiveRow extends ProviderRow {
  /** The board's own category, or null when it stated none. */
  category: string | null;
  /** The board's own job type, or null when it stated none. */
  jobType: string | null;
  tags: string[];
}

/**
 * Map the feed's rows to the SDK's neutral shape.
 *
 * A row with no id or no title is not a posting, and is dropped.
 */
export function mapRemotive(jobs: RemotiveRawJob[]): RemotiveRow[] {
  const out: RemotiveRow[] = [];
  for (const j of jobs) {
    if (!j || !j.id || !j.title) continue;
    out.push({
      id: String(j.id),
      title: decodeHtmlEntities(j.title || ""),
      company: decodeHtmlEntities(j.company_name || "").trim() || null,
      // No location claimed when the feed carries none: "Worldwide" was
      // invented here once - empty string, never a made-up place.
      location:
        j.candidate_required_location && j.candidate_required_location.trim()
          ? j.candidate_required_location.trim()
          : null,
      date: j.publication_date || null,
      url: j.url || `${REMOTIVE_BASE_URL}/remote-jobs/${j.id}`,
      salary: j.salary && j.salary.trim() ? j.salary.trim() : null,
      category: j.category || null,
      jobType: j.job_type || null,
      tags: Array.isArray(j.tags) ? j.tags : [],
      description: j.description ? stripRemotiveHtml(j.description) : undefined,
    });
  }
  return out;
}

/**
 * The board's query parameters.
 *
 * Remotive's endpoint accepts these, but ignores them today (see the file
 * header). They travel anyway: a board that starts honouring them would
 * narrow the feed, and the client-side filters below would still apply on
 * top, so the results would not change.
 */
function buildQuery(opts: {
  search?: string;
  category?: string;
  location?: string;
  company?: string;
}): string {
  const params = new URLSearchParams();
  if (opts.search) params.set("search", opts.search);
  if (opts.category) params.set("category", opts.category);
  if (opts.location) params.set("candidate_required_location", opts.location);
  if (opts.company) params.set("company_name", opts.company);
  const q = params.toString();
  return q ? `${REMOTIVE_API_URL}?${q}` : REMOTIVE_API_URL;
}

/** Fetch the feed and map it. */
export async function fetchRemotiveJobs(
  opts: {
    search?: string;
    category?: string;
    location?: string;
    company?: string;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<RemotiveRow[]> {
  let payload: unknown;
  try {
    const res = await providerFetch(buildQuery(opts), { fetchImpl: opts.fetchImpl });
    if (!res.ok) {
      throw new ProviderError("http", `HTTP ${res.status} for ${REMOTIVE_API_URL}`, {
        retryable: res.status === 429 || (res.status >= 500 && res.status <= 599),
      });
    }
    payload = await res.json();
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError("network", e instanceof Error ? e.message : String(e), { cause: e });
  }
  const data = payload as { jobs?: RemotiveRawJob[] } | null;
  if (!data || !Array.isArray(data.jobs)) {
    // The feed did not have the shape it is documented to have. That is a
    // parse failure, not an empty board: an empty board reads as "no jobs",
    // and a broken feed must not read that way.
    throw new ProviderError("parse", "the Remotive feed did not carry a jobs array");
  }
  return mapRemotive(data.jobs);
}

/**
 * Keyword match: the query appears anywhere in the fields the board shows.
 *
 * The whole query is one substring, not a list of words. A board's own search
 * matches the phrase, and matching word-by-word would find postings the
 * board does not consider a match.
 */
function matchesQuery(row: RemotiveRow, query: string): boolean {
  const q = query.toLowerCase();
  return (
    row.title.toLowerCase().includes(q) ||
    (row.company ?? "").toLowerCase().includes(q) ||
    (row.category ?? "").toLowerCase().includes(q) ||
    row.tags.some((t) => t.toLowerCase().includes(q)) ||
    (row.description ?? "").toLowerCase().includes(q)
  );
}

/** Category match: hyphens and spaces are not differences. */
function matchesCategory(row: RemotiveRow, category: string): boolean {
  const wanted = category.toLowerCase().replace(/[-\s]/g, "");
  if (!row.category) return false;
  return row.category.toLowerCase().replace(/[-\s]/g, "").includes(wanted);
}

/** Salary match: the first number in the board's own salary text. */
function matchesSalary(row: RemotiveRow, min: number): boolean {
  if (!row.salary) return true;
  const match = row.salary.match(/[\d,]+/g);
  if (!match) return true;
  let value = parseFloat(match[0].replace(/,/g, ""));
  if (row.salary.toLowerCase().includes("k")) value *= 1000;
  if (Number.isNaN(value)) return true;
  return value >= min;
}

/** Age match: a posting with no date, or an unparseable one, is kept. */
function matchesAge(row: RemotiveRow, jobAgeDays: number): boolean {
  if (!jobAgeDays || jobAgeDays <= 0) return true;
  if (!row.date) return true;
  const posted = Date.parse(row.date);
  if (Number.isNaN(posted)) return true;
  return Date.now() - posted <= jobAgeDays * 24 * 60 * 60 * 1000;
}

/** Apply every filter a request asks for. */
export function filterRemotive(rows: RemotiveRow[], req: SearchRequest): RemotiveRow[] {
  let out = rows;
  if (req.query) out = out.filter((j) => matchesQuery(j, req.query as string));
  if (req.location) {
    const loc = req.location.toLowerCase();
    out = out.filter((j) => (j.location ?? "").toLowerCase().includes(loc));
  }
  const category = req.extra?.category;
  if (typeof category === "string" && category) {
    out = out.filter((j) => matchesCategory(j, category));
  }
  if (req.tag) {
    const tagQ = req.tag.toLowerCase();
    out = out.filter((j) => j.tags.some((t) => t.toLowerCase().includes(tagQ)));
  }
  if (req.salaryMin !== undefined) {
    out = out.filter((j) => matchesSalary(j, req.salaryMin as number));
  }
  if (req.jobAgeDays !== undefined) {
    out = out.filter((j) => matchesAge(j, req.jobAgeDays as number));
  }
  return out;
}

/**
 * The numeric id a reference carries.
 *
 * Exact matching only. An earlier version fell back to a url's numeric
 * tail, which turned a search for "123" into the "...-5123" posting. The only
 * fallback is a dash-anchored numeric url tail, and only when exactly one
 * posting carries it.
 */
export function extractRemotiveId(idOrUrl: string): string {
  const trimmed = idOrUrl.trim();
  const match = trimmed.match(/(\d+)$/) || trimmed.match(/remote-jobs\/.*-(\d+)/);
  return match ? match[1] : trimmed;
}

/** Find one posting by id or url. */
export function matchRemotiveJob(
  rows: RemotiveRow[],
  searchId: string,
  extractedId: string,
): RemotiveRow | undefined {
  const exact = rows.find((j) => j.id === searchId || j.id === extractedId || j.url === searchId);
  if (exact) return exact;
  if (!extractedId) return undefined;
  const candidates = rows.filter((j) => j.url.replace(/\/+$/, "").endsWith(`-${extractedId}`));
  return candidates.length === 1 ? candidates[0] : undefined;
}

export interface RemotiveOptions {
  /**
   * The fetch to use. Defaults to the global fetch.
   *
   * Every provider is CONSTRUCTED with its dependencies rather than
   * hard-wiring the network, so a test can bind a fixture and never reach
   * the real board. The exported singleton below is the production one.
   */
  fetchImpl?: typeof fetch;
}

/** A provider bound to a specific fetch. */
export function createRemotiveProvider(options: RemotiveOptions = {}): Provider<RemotiveRow> {
  const fetchImpl = options.fetchImpl;
  return {
    id: "remotive",
    version: "1.0.0",
    kind: "aggregator",
    displayName: "Remotive",
    seedUrls: [REMOTIVE_API_URL],

    async search(req: SearchRequest): Promise<SearchPage<RemotiveRow>> {
      const category = req.extra?.category;
      const company = req.extra?.company;
      const jobs = await fetchRemotiveJobs({
        search: req.query,
        category: typeof category === "string" ? category : undefined,
        location: req.location,
        company: typeof company === "string" ? company : undefined,
        fetchImpl,
      });
      const filtered = filterRemotive(jobs, req);
      const page = Math.max(1, req.page ?? 1);
      const limit = req.limit === undefined ? 20 : req.limit;
      const start = (page - 1) * limit;
      const rows = limit === 0 ? filtered : filtered.slice(start, start + limit);
      return {
        rows,
        total: filtered.length,
        page,
        truncated: filtered.length > start + rows.length,
      };
    },

    async detail(ref: string): Promise<PostingDetail<RemotiveRow>> {
      const wanted = ref.trim();
      const extracted = extractRemotiveId(wanted);
      const jobs = await fetchRemotiveJobs({ fetchImpl });
      const found = matchRemotiveJob(jobs, wanted, extracted);
      if (!found) {
        throw new ProviderError("not-found", `listing not found: ${ref}`);
      }
      return found;
    },
  };
}

/** The production provider. A test binds its own with `createRemotiveProvider`. */
export const remotiveProvider: Provider<RemotiveRow> = createRemotiveProvider();

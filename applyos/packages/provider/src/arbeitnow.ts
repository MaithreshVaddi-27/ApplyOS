// Origin: clean-room 2026-11-22, Phase 4 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// Arbeitnow, implemented once.
//
// This board was engine-only: `applyos/packages/portals/src/arbeitnow.ts` was its only
// implementation, and it is the surface `/scrape` could not reach. Phase 4.6 gives it a provider
// CLI, which needs the board's facts in one place first.
//
// **The board has no search.** `https://www.arbeitnow.com/api/job-board-api` answers one JSON
// document - `{data, links, meta}` with 300 postings - and ignores any query parameter. Every
// filter is therefore applied client-side, exactly as the retired adapter did.
//
// **The board's date is a unix timestamp in seconds**, not an ISO string (verified live on
// 2026-11-22: every one of the 300 rows carries a number). The retired adapter already knew
// this; a reader that assumes ISO would read 1970-01-21.
//
// **The place and the remote flag are separate facts.** A row carries `location` (a string, empty
// when the board states none) and `remote` (a boolean). 280 of the 300 rows carry a location, 14
// carry `remote: true`, and 20 carry neither. The retired adapter turned `remote: true` with no
// location into the invented place "Remote"; the SDK says null, which is what the board said.
//
// The behaviour reproduced here is the retired engine adapter's, because that is the only
// implementation that existed.

import { ProviderError } from "./errors.js";
import { providerFetch } from "./fetch.js";
import { asText, stripHtmlTags } from "./text.js";
import type { PostingDetail, Provider, ProviderRow, SearchPage, SearchRequest } from "./types.js";

export const ARBEITNOW_API_URL = "https://www.arbeitnow.com/api/job-board-api";

/** One posting as the board states it. */
export interface ArbeitnowRawJob {
  slug?: string;
  company_name?: string;
  title?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  location?: string;
  /** Unix seconds. The board sends a number; an ISO string would be a different board. */
  created_at?: string | number;
  tags?: string[];
  job_types?: string[];
}

/** One posting from the board, in the SDK's neutral shape. */
export interface ArbeitnowRow extends ProviderRow {
  /** The board's own remote flag. */
  remote: boolean;
  /** The board's own tags. */
  tags: string[];
  /** The board's own job types (Full-Time, Contract, ...). */
  jobTypes: string[];
  /** The board's own creation timestamp, verbatim. */
  createdAt: number | null;
}

/** The calendar day of the board's unix-seconds timestamp, or null when it states none. */
export function arbeitnowDate(createdAt?: string | number): string | null {
  if (typeof createdAt === "number" && Number.isFinite(createdAt)) {
    const d = new Date(createdAt * 1000);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const raw = typeof createdAt === "string" ? createdAt.slice(0, 10) : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

/**
 * The posting's place, or null when the board states none.
 *
 * The board sends an empty string when it states no place. `remote: true` is a separate fact and
 * is NOT a place: the retired adapter turned it into the invented string "Remote".
 */
export function arbeitnowLocation(job: ArbeitnowRawJob): string | null {
  return asText(job.location).trim() || null;
}

/**
 * The posting's body, as text. Null when the board states none.
 *
 * The board's `description` field is HTML, and no board-specific flattening rule has been
 * established for it, so the SDK's shared rule applies.
 */
export function arbeitnowDescription(job: ArbeitnowRawJob): string | null {
  const raw = asText(job.description).trim();
  if (!raw) return null;
  return stripHtmlTags(raw) || null;
}

/**
 * Map one posting to the SDK's neutral shape.
 *
 * A row with no slug or no url is not a posting, and is dropped.
 */
export function parseArbeitnowJob(job: ArbeitnowRawJob): ArbeitnowRow | null {
  if (!job || !job.slug || !job.url) return null;
  const createdAt =
    typeof job.created_at === "number" && Number.isFinite(job.created_at) ? job.created_at : null;
  return {
    id: asText(job.slug).trim(),
    title: asText(job.title).trim(),
    company: asText(job.company_name).trim() || null,
    location: arbeitnowLocation(job),
    date: arbeitnowDate(job.created_at),
    url: asText(job.url).trim(),
    description: arbeitnowDescription(job),
    tags: Array.isArray(job.tags) ? job.tags.map((t) => String(t).trim()).filter(Boolean) : [],
    jobTypes: Array.isArray(job.job_types)
      ? job.job_types.map((t) => String(t).trim()).filter(Boolean)
      : [],
    remote: job.remote === true,
    createdAt,
  };
}

/** The board's envelope. */
interface ArbeitnowEnvelope {
  data?: ArbeitnowRawJob[];
}

/** Fetch the board's postings. */
async function fetchArbeitnow(
  options: { fetchImpl?: typeof fetch; attempts?: number; timeoutMs?: number } = {},
): Promise<ArbeitnowRow[]> {
  let res;
  try {
    res = await providerFetch(ARBEITNOW_API_URL, {
      headers: { Accept: "application/json" },
      attempts: options.attempts ?? 2,
      timeoutMs: options.timeoutMs ?? 20000,
      fetchImpl: options.fetchImpl,
    });
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError("network", `could not reach the Arbeitnow API (${e instanceof Error ? e.message : String(e)})`, {
      cause: e,
    });
  }
  if (!res.ok) {
    throw new ProviderError("http", `the Arbeitnow API answered HTTP ${res.status}`, {
      retryable: res.status === 429 || (res.status >= 500 && res.status <= 599),
    });
  }
  let payload: ArbeitnowEnvelope | null;
  try {
    payload = (await res.json()) as ArbeitnowEnvelope;
  } catch (e) {
    throw new ProviderError("parse", "the Arbeitnow API did not answer with JSON", { cause: e });
  }
  if (!payload || !Array.isArray(payload.data)) {
    // The board did not answer with the shape it is documented to have. That is a parse failure,
    // not an empty board: an empty board reads as `data: []`.
    throw new ProviderError("parse", "the Arbeitnow API did not carry a data array");
  }
  return payload.data
    .map((job) => parseArbeitnowJob(job))
    .filter((row): row is ArbeitnowRow => row !== null);
}

/**
 * Apply the client-side filters, in the order the retired adapter applied them.
 *
 * The board has no search, so the query matches the title and the company - the same fields the
 * retired adapter matched. A place filter and a remote filter are honoured when a caller asks for
 * them.
 */
export function filterArbeitnow(rows: ArbeitnowRow[], req: SearchRequest, now: Date = new Date()): ArbeitnowRow[] {
  let out = rows;
  const q = req.query?.toLowerCase();
  if (q) {
    out = out.filter((j) => `${j.title} ${j.company ?? ""}`.toLowerCase().includes(q));
  }
  if (req.location) {
    const loc = req.location.toLowerCase();
    out = out.filter((j) => (j.location ?? "").toLowerCase().includes(loc));
  }
  const remote = req.extra?.remote;
  if (remote === true) out = out.filter((j) => j.remote);
  if (remote === false) out = out.filter((j) => !j.remote);
  if (req.jobAgeDays !== undefined && req.jobAgeDays > 0) {
    const cutoff = now.getTime() - req.jobAgeDays * 24 * 60 * 60 * 1000;
    out = out.filter((j) => {
      if (!j.date) return true; // The board did not say: keep it.
      const parsed = Date.parse(j.date);
      return isNaN(parsed) || parsed >= cutoff;
    });
  }
  return out;
}

/** The slug a reference carries. */
export function extractArbeitnowSlug(ref: string): string {
  const trimmed = ref.trim();
  const match = trimmed.match(/\/([a-zA-Z0-9_-]+)$/);
  return match ? match[1] : trimmed;
}

export interface ArbeitnowOptions {
  /**
   * The fetch to use. Defaults to the global fetch.
   *
   * Every provider is CONSTRUCTED with its dependencies rather than hard-wiring the network, so
   * a test can bind a fixture and never reach the real board. The exported singleton below is
   * the production one.
   */
  fetchImpl?: typeof fetch;
  /** The retry budget and per-attempt timeout. Defaults to the engine's shared policy. */
  attempts?: number;
  timeoutMs?: number;
  /** The clock, so a test can pin the age filter. */
  now?: () => Date;
}

/** A provider bound to a specific fetch. */
export function createArbeitnowProvider(options: ArbeitnowOptions = {}): Provider<ArbeitnowRow> {
  const now = options.now ?? (() => new Date());
  return {
    id: "arbeitnow",
    version: "1.0.0",
    kind: "aggregator",
    displayName: "Arbeitnow",
    seedUrls: [ARBEITNOW_API_URL],

    async search(req: SearchRequest): Promise<SearchPage<ArbeitnowRow>> {
      const jobs = await fetchArbeitnow(options);
      const matched = filterArbeitnow(jobs, req, now());

      const page = Math.max(1, req.page ?? 1);
      const limit = req.limit === undefined ? 20 : req.limit;
      const start = limit === 0 ? 0 : (page - 1) * limit;
      const rows = limit === 0 ? matched : matched.slice(start, start + limit);

      return {
        rows,
        total: matched.length,
        page,
        truncated: matched.length > start + rows.length,
      };
    },

    async detail(ref: string): Promise<PostingDetail<ArbeitnowRow>> {
      const slug = extractArbeitnowSlug(ref);
      const jobs = await fetchArbeitnow(options);
      const found = jobs.find((j) => j.id === slug);
      if (!found) {
        // Exact matching only. A posting that is not in the board's 300 most recent is not a
        // posting this board can show, and the honest answer is not-found - never a near miss.
        throw new ProviderError("not-found", `listing not found: ${ref}`);
      }
      return found;
    },
  };
}

/** The production provider. A test binds its own with `createArbeitnowProvider`. */
export const arbeitnowProvider: Provider<ArbeitnowRow> = createArbeitnowProvider();

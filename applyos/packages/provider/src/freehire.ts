// Origin: clean-room 2026-11-16, Phase 4 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// Freehire, implemented once.
//
// This replaces two parsers: the one in the freehire-search CLI and the one in
// applyos/packages/portals. They disagreed about the endpoint, and only one of
// them worked: the CLI asks for `/api/v1/agent/jobs/search`, while the engine
// adapter asked for `/api/jobs`, which answers 404 on every scrape.
//
// The behaviour reproduced here is the CLI's, because the CLI is the surface
// `/scrape` uses and therefore the one a candidate sees.
//
// Freehire is a personal project maintained best-effort, so its politeness
// differs from the shared policy and is preserved here rather than normalised:
// a 429 or a 5xx is retried seven times with a capped backoff, while a
// connection failure fails fast - an outage should degrade this source quickly
// rather than hold the caller.

import { ProviderError } from "./errors.js";
import { providerFetch } from "./fetch.js";
import { asText, decodeHtmlEntities } from "./text.js";
import type { PostingDetail, Provider, ProviderRow, SearchPage, SearchRequest } from "./types.js";

/** The hosted service. A self-hosted instance is pointed at by its own base URL. */
export const FREEHIRE_DEFAULT_BASE_URL = "https://freehire.me";

/**
 * The agent search endpoint.
 *
 * It is the *agent* variant of the board's job search: the same query,
 * ranking and facets as the web's `/jobs/search`, but each hit carries the
 * posting's full description instead of the search index's truncated preview.
 */
export const FREEHIRE_SEARCH_PATH = "/api/v1/agent/jobs/search";

/** The board's own endpoint for one posting. */
export const FREEHIRE_DETAIL_PATH = "/api/v1/jobs";

/** How the API renders each result's full description. */
export type FreehireDescriptionFormat = "markdown" | "text" | "html";

/** The shared API response envelope. */
export interface FreehireEnvelope<T> {
  data: T;
  meta?: { total?: number; limit?: number; offset?: number };
  error?: string;
}

/** A freehire job - the fields this skill reads (the wire shape carries more). */
export interface FreehireRawJob {
  /** The board's own public slug - the thing `detail <slug>` consumes. */
  public_slug?: string;
  /** A legacy id field. The board does not send it; some older shapes did. */
  id?: string | number;
  source?: string;
  external_id?: string;
  url?: string;
  title?: string;
  company?: string;
  company_slug?: string;
  location?: string;
  description?: string;
  skills?: string[];
  work_mode?: string;
  regions?: string[];
  countries?: string[];
  cities?: string[];
  /** The board's own posting date. */
  posted_at?: string | null;
  /** A legacy date field. The board does not send it; some older shapes did. */
  date?: string | null;
  created_at?: string | null;
  /**
   * Always present in the wire shape (an unenriched job serializes it as
   * `{}`); the individual fields are what may be absent.
   */
  enrichment?: {
    seniority?: string;
    category?: string;
    employment_type?: string;
    salary_min?: number;
    salary_max?: number;
    salary_currency?: string;
  };
}

/** One posting from the feed, in the SDK's neutral shape. */
export interface FreehireRow extends ProviderRow {
  /** The board's own company slug, or null when it stated none. */
  company_slug: string | null;
  /** The board's own work mode, or null when it stated none. */
  work_mode: string | null;
  regions: string[];
  countries: string[];
  skills: string[];
}

/** One posting from the board's own endpoint, in full. */
export interface FreehireDetailRow extends FreehireRow {
  cities: string[];
  seniority: string | null;
  category: string | null;
  employment_type: string | null;
  /** A display salary line, or null when the board stated none. */
  salary: string | null;
}

/** The base URL of the board. A self-hosted instance is pointed at by its own. */
export function freehireBaseUrl(env: Record<string, string | undefined> = {}): string {
  const raw = (env.FREEHIRE_API_URL ?? "").trim();
  return (raw || FREEHIRE_DEFAULT_BASE_URL).replace(/\/+$/, "");
}

/**
 * Strip a freehire description's HTML into readable prose.
 *
 * Block and line-break tags become newlines, entities are decoded, tags are
 * removed. Null for empty input.
 */
export function cleanFreehireHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n");
  const text = decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

/** A human-readable salary line from the enrichment fields, or null when absent. */
export function formatFreehireSalary(e: FreehireRawJob["enrichment"]): string | null {
  if (!e) return null;
  if (e.salary_min == null && e.salary_max == null) return null;
  const cur = e.salary_currency ? `${e.salary_currency} ` : "";
  if (e.salary_min != null && e.salary_max != null) return `${cur}${e.salary_min}–${e.salary_max}`;
  return `${cur}${e.salary_min ?? e.salary_max}`;
}

/** Extract a freehire public slug from a bare slug or a /jobs/<slug> URL. */
export function normalizeFreehireSlug(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/\/jobs\/([^/?#]+)/);
  if (m) return m[1];
  // A bare slug: lowercase alphanumerics and hyphens (no path/scheme).
  if (/^[a-z0-9][a-z0-9-]*$/i.test(trimmed)) return trimmed;
  return null;
}

/** One posting, in the shape the contract's search result uses. */
export function toFreehireRow(j: FreehireRawJob): FreehireRow {
  // The board's own string, kept as it was sent. The engine's surface trims
  // what it wants trimmed; the CLI shows what the board said.
  const company = asText(j.company);
  return {
    id: j.public_slug ?? (j.id !== undefined ? String(j.id) : ""),
    title: j.title ?? "",
    company: company || null,
    company_slug: j.company_slug || null,
    location: j.location || null,
    work_mode: j.work_mode || null,
    regions: j.regions ?? [],
    countries: j.countries ?? [],
    skills: j.skills ?? [],
    date: j.posted_at ?? j.date ?? null,
    url: j.url ?? "",
    description: j.description || null,
  };
}

/** One posting, in full: the search row plus the enrichment and a cleaned body. */
export function toFreehireDetail(j: FreehireRawJob): FreehireDetailRow {
  const e = j.enrichment ?? {};
  return {
    ...toFreehireRow(j),
    cities: j.cities ?? [],
    seniority: e.seniority || null,
    category: e.category || null,
    employment_type: e.employment_type || null,
    salary: formatFreehireSalary(e),
    description: cleanFreehireHtml(j.description),
  };
}

/**
 * The board's query parameters.
 *
 * The common flags map to the board's own vocabulary; `extra` carries the
 * facets a board has and the common flags do not.
 */
export function buildFreehireQuery(req: SearchRequest): URLSearchParams {
  const p = new URLSearchParams();
  const extra = req.extra ?? {};

  if (req.query) p.set("q", req.query);
  p.set("limit", String(req.limit === undefined ? 25 : req.limit));
  p.set("offset", String((Math.max(1, req.page ?? 1) - 1) * (req.limit === undefined ? 25 : req.limit)));
  p.set("semantic_ratio", "0"); // keyword search; the semantic index is opt-in

  // The agent endpoint serves the index's truncated preview unless asked to
  // rehydrate each hit from the database, so both params travel together -
  // unless the caller opted out of hydration entirely.
  const hydrate = extra.include_description !== false;
  p.set("include_description", hydrate ? "true" : "false");
  if (hydrate) {
    p.set("description_format", String(extra.description_format ?? "markdown"));
  }
  if (req.jobAgeDays && req.jobAgeDays < 9999) {
    p.set("posted_within_days", String(req.jobAgeDays));
  }
  const workMode = extra.work_mode;
  if (typeof workMode === "string" && workMode) p.set("work_mode", workMode);
  const company = extra.company_slug ?? extra.company;
  if (typeof company === "string" && company) p.set("company_slug", company);
  const experience = extra.experience_min ?? extra.experience;
  if (typeof experience === "number") p.set("experience_min", String(experience));
  const salary = extra.salary_min ?? req.salaryMin;
  if (typeof salary === "number") p.set("salary_min", String(salary));

  // Named facets and the generic escape hatch append the same way; values are
  // already split into lists, so each becomes one repeated query param.
  const facets: Array<[string, unknown]> = [
    ["regions", extra.regions],
    ["countries", extra.countries],
    ["cities", extra.cities],
    ["seniority", extra.seniority],
    ["category", extra.category],
    ["skills", extra.skills],
  ];
  for (const [param, value] of facets) {
    if (!Array.isArray(value)) continue;
    for (const v of value) if (v !== undefined && v !== null) p.append(param, String(v));
  }
  // Anything else the caller wants goes straight through, as a repeated param
  // per value.
  for (const [param, value] of Object.entries(extra)) {
    if (param in FREEHIRE_RESERVED) continue;
    if (Array.isArray(value)) {
      for (const v of value) if (v !== undefined && v !== null) p.append(param, String(v));
    } else if (value !== undefined && value !== null) {
      p.append(param, String(value));
    }
  }
  return p;
}

/** The extras the query builder handles itself. */
const FREEHIRE_RESERVED: Record<string, true> = {
  include_description: true,
  description_format: true,
  work_mode: true,
  company_slug: true,
  company: true,
  experience_min: true,
  experience: true,
  salary_min: true,
  regions: true,
  countries: true,
  cities: true,
  seniority: true,
  category: true,
  skills: true,
};

export interface FreehireOptions {
  /**
   * The fetch to use. Defaults to the global fetch.
   *
   * Every provider is CONSTRUCTED with its dependencies rather than
   * hard-wiring the network, so a test can bind a fixture and never reach
   * the real board. The exported singleton below is the production one.
   */
  fetchImpl?: typeof fetch;
  /** The board's base URL. Defaults to the hosted service. */
  baseUrl?: string;
  /** The environment a self-hosted instance is named in. */
  env?: Record<string, string | undefined>;
  /** The injected sleep, so a test can avoid real waiting. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * GET a JSON envelope from the board.
 *
 * A 404 is returned as null: the caller decides whether it means "no such
 * posting" or "this instance predates the agent search endpoint", and the two
 * are different facts.
 */
export async function freehireGet<T>(
  path: string,
  options: FreehireOptions,
): Promise<FreehireEnvelope<T> | null> {
  const url = `${options.baseUrl ?? freehireBaseUrl(options.env)}${path}`;
  const attempts = 7;
  let delay = 500;

  for (let attempt = 0; attempt < attempts; attempt++) {
    let response: Response;
    try {
      response = (await providerFetch(url, {
        headers: { Accept: "application/json" },
        attempts: 1,
        retryOnNetworkFailure: false,
        fetchImpl: options.fetchImpl,
        sleep: options.sleep,
      })) as unknown as Response;
    } catch (e) {
      // The connection is refused now. Waiting to find out that it will be
      // refused again is slower, not safer.
      throw new ProviderError(
        "network",
        `could not reach the freehire API at ${options.baseUrl ?? freehireBaseUrl(options.env)} (${e instanceof Error ? e.message : String(e)})`,
        { cause: e },
      );
    }

    if (response.status === 429 || response.status >= 500) {
      if (attempt === attempts - 1) {
        throw new ProviderError(
          "http",
          `freehire API request failed: ${response.status} ${response.statusText}`,
          { retryable: true },
        );
      }
      await (options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms))))(
        delay + Math.floor(Math.random() * 500),
      );
      delay = Math.min(delay * 2, 8000);
      continue;
    }
    if (response.status === 404) return null;

    // Read the body once, tolerantly: an error response's JSON gives us its
    // `error` message; a 2xx must parse (a malformed one is surfaced, not
    // swallowed).
    const body = (await response.json().catch(() => null)) as FreehireEnvelope<T> | null;
    if (!response.ok) {
      throw new ProviderError(
        "http",
        body?.error || `freehire API request failed: ${response.status} ${response.statusText}`,
        { retryable: response.status >= 500 },
      );
    }
    if (!body) {
      throw new ProviderError("parse", "freehire API returned an unparseable response body");
    }
    return body;
  }
  throw new ProviderError("http", "freehire API request failed after retries", { retryable: true });
}

/** A provider bound to a specific fetch. */
export function createFreehireProvider(options: FreehireOptions = {}): Provider<FreehireRow> {
  const baseUrl = options.baseUrl ?? freehireBaseUrl(options.env);

  return {
    id: "freehire",
    version: "1.0.0",
    kind: "aggregator",
    displayName: "Freehire",
    seedUrls: [`${baseUrl}${FREEHIRE_SEARCH_PATH}`],

    async search(req: SearchRequest): Promise<SearchPage<FreehireRow>> {
      const query = buildFreehireQuery(req).toString();
      const env = await freehireGet<FreehireRawJob[]>(`${FREEHIRE_SEARCH_PATH}?${query}`, {
        ...options,
        baseUrl,
      });
      if (!env) {
        // A 404 here is a missing endpoint, not a missing job: a freehire
        // instance older than the agent search surface answers that way, and
        // reporting it as an empty result set would hide the misconfiguration
        // behind plausible output.
        throw new ProviderError(
          "not-found",
          `${FREEHIRE_SEARCH_PATH} not found - this freehire instance predates the agent search endpoint; upgrade it or unset FREEHIRE_API_URL to use the hosted API`,
        );
      }
      let rows = (env.data ?? []).map(toFreehireRow);
      // The API currently returns description bodies regardless of
      // include_description=false (verified live 2026-08-19), and the cost
      // this flag exists to avoid is the ~73% of CLI output the bodies occupy
      // in agent context - so the lean mode strips them client-side either way.
      if (req.extra?.include_description === false) {
        rows = rows.map((r) => ({ ...r, description: null }));
      }
      const total = env.meta?.total ?? rows.length;
      const page = Math.max(1, req.page ?? 1);
      const limit = req.limit === undefined ? 25 : req.limit;
      const start = (page - 1) * limit;
      // The board pages server-side, so the rows it sent ARE the page. Slicing
      // them again would drop the second page entirely.
      return {
        rows,
        total,
        page,
        truncated: total > start + rows.length,
      };
    },

    async detail(ref: string): Promise<PostingDetail<FreehireDetailRow>> {
      const slug = normalizeFreehireSlug(ref);
      if (!slug) {
        throw new ProviderError("unsupported", `could not parse a freehire slug from "${ref}"`);
      }
      const env = await freehireGet<FreehireRawJob>(
        `${FREEHIRE_DETAIL_PATH}/${encodeURIComponent(slug)}`,
        { ...options, baseUrl },
      );
      if (!env) {
        throw new ProviderError("not-found", "job not found");
      }
      return toFreehireDetail(env.data);
    },
  };
}

/** The production provider. A test binds its own with `createFreehireProvider`. */
export const freehireProvider: Provider<FreehireRow> = createFreehireProvider();

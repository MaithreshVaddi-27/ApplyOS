// Origin: clean-room 2026-11-23, Phase 4.7 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// Greenhouse, implemented once.
//
// Phase 4.7 reconciles the two ATS implementations: `careers-search`'s connector set and
// `applyos/packages/company-scraper`'s connector set. They reached the same boards through two
// parsers with different shapes. This is the first connector on the SDK, and the engine's
// Greenhouse adapter is the first surface over it.
//
// An ATS connector is not a board singleton: the endpoint carries a TENANT (a board slug), so the
// provider is constructed with its tenant. `createGreenhouseProvider({ slug, company })` is the
// board; `greenhouseProvider` would not make sense without one.
//
// The behaviour reproduced here is the engine connector's, which is the implementation the parity
// fixtures were captured from.

import { ProviderError } from "./errors.js";
import { providerFetch } from "./fetch.js";
import { stripAtsHtml } from "./text.js";
import type { PostingDetail, Provider, ProviderRow, SearchPage, SearchRequest } from "./types.js";

/** The Greenhouse boards API base. */
export const GREENHOUSE_API_BASE = "https://boards-api.greenhouse.io/v1/boards";

/** The listing for one tenant. */
export function greenhouseListUrl(slug: string): string {
  return `${GREENHOUSE_API_BASE}/${encodeURIComponent(slug)}/jobs?content=false`;
}

/** One listing page. `content=true` is the CLI's row convention. */
export function greenhousePageUrl(slug: string, offset = 0, withContent = false): string {
  return `${GREENHOUSE_API_BASE}/${encodeURIComponent(slug)}/jobs?content=${withContent ? "true" : "false"}&offset=${offset}`;
}

/** One posting by id, with its body. */
export function greenhouseDetailUrl(slug: string, id: string): string {
  return `${GREENHOUSE_API_BASE}/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(id)}?content=true`;
}

/** One listing response, as the board states it. */
export interface GreenhouseFeed {
  jobs?: RawGreenhouseJob[];
  meta?: { total?: number };
}

/** Fetch one listing page. The paging policy belongs to each surface. */
export async function fetchGreenhouseJobs(
  slug: string,
  offset = 0,
  withContent = false,
  fetchImpl?: typeof fetch,
): Promise<GreenhouseFeed> {
  return greenhouseGet<GreenhouseFeed>(greenhousePageUrl(slug, offset, withContent), { slug, fetchImpl });
}

/** Fetch one posting with its raw body, for a surface's own text rule. */
export async function fetchGreenhousePayload(
  slug: string,
  id: string,
  fetchImpl?: typeof fetch,
): Promise<{ title?: string; content?: string }> {
  return greenhouseGet<{ title?: string; content?: string }>(greenhouseDetailUrl(slug, id), { slug, fetchImpl }, true);
}

/** One posting as Greenhouse states it. */
export interface RawGreenhouseJob {
  id: number | string;
  title?: string;
  absolute_url?: string;
  location?: { name?: string };
  updated_at?: string;
  content?: string;
}

/** One posting, in the SDK's neutral shape. */
export interface GreenhouseRow extends ProviderRow {
  /** The tenant's own board slug, which the engine needs for its namespaced id. */
  slug: string;
}

/** Map one Greenhouse posting, or null when it has no id. */
export function mapGreenhouseJob(slug: string, job: RawGreenhouseJob): GreenhouseRow | null {
  if (!job || job.id === undefined || job.id === null) return null;
  return {
    id: String(job.id),
    title: (job.title ?? "Untitled").trim(),
    company: null,
    location: (job.location?.name ?? "").trim() || null,
    date: job.updated_at || null,
    url: job.absolute_url ?? "",
    description: job.content ? stripAtsHtml(job.content) : null,
    slug,
  };
}

/** Map a listing. */
export function mapGreenhouseJobs(slug: string, jobs: RawGreenhouseJob[]): GreenhouseRow[] {
  return jobs
    .map((j) => mapGreenhouseJob(slug, j))
    .filter((row): row is GreenhouseRow => row !== null);
}

/**
 * Apply the board's client-side query: the title and the place, as the engine
 * connector has always done. Greenhouse has no search endpoint.
 */
export function filterGreenhouse(rows: GreenhouseRow[], req: SearchRequest): GreenhouseRow[] {
  const q = req.query?.toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => `${row.title} ${row.location ?? ""}`.toLowerCase().includes(q));
}

async function greenhouseGet<T>(
  url: string,
  options: GreenhouseOptions,
  notFoundIsMissing = false,
): Promise<T> {
  let res;
  try {
    res = await providerFetch(url, {
      headers: { Accept: "application/json" },
      fetchImpl: options.fetchImpl,
    });
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError("network", `could not reach the Greenhouse board (${e instanceof Error ? e.message : String(e)})`, { cause: e });
  }
  if (res.status === 404 && notFoundIsMissing) {
    throw new ProviderError("not-found", "Greenhouse posting not found");
  }
  if (!res.ok) {
    throw new ProviderError("http", `the Greenhouse board answered HTTP ${res.status}`, {
      retryable: res.status === 429 || (res.status >= 500 && res.status <= 599),
    });
  }
  try {
    return (await res.json()) as T;
  } catch (e) {
    throw new ProviderError("parse", "the Greenhouse board did not answer with JSON", { cause: e });
  }
}

export interface GreenhouseOptions {
  /** The tenant's board slug, e.g. "groww". */
  slug: string;
  /** The display name, when the tenant's slug is not the employer's name. */
  company?: string;
  fetchImpl?: typeof fetch;
}

/** A Greenhouse connector bound to one tenant. */
export function createGreenhouseProvider(options: GreenhouseOptions): Provider<GreenhouseRow> {
  const slug = options.slug;
  const company = (options.company ?? slug).trim();

  return {
    id: "greenhouse",
    version: "1.0.0",
    kind: "ats",
    displayName: `Greenhouse: ${company}`,
    seedUrls: [greenhouseListUrl(slug)],

    async search(req: SearchRequest): Promise<SearchPage<GreenhouseRow>> {
      const payload = await greenhouseGet<{ jobs?: RawGreenhouseJob[] }>(
        greenhouseListUrl(slug),
        options,
      );
      if (!payload || !Array.isArray(payload.jobs)) {
        throw new ProviderError("parse", "the Greenhouse listing did not carry a jobs array");
      }
      const all = mapGreenhouseJobs(slug, payload.jobs);
      const matched = filterGreenhouse(all, req);
      const limit = req.limit ?? 20;
      const page = Math.max(1, req.page ?? 1);
      const start = limit === 0 ? 0 : (page - 1) * limit;
      const rows = limit === 0 ? matched : matched.slice(start, start + limit);
      const cap = limit === 0 ? matched.length : Math.min(start + rows.length, matched.length);
      return {
        rows: rows.map((r) => ({ ...r, company })),
        total: matched.length,
        page,
        truncated: matched.length > cap,
      };
    },

    async detail(ref: string): Promise<PostingDetail<GreenhouseRow>> {
      const job = await greenhouseGet<RawGreenhouseJob>(greenhouseDetailUrl(slug, ref), options, true);
      const row = mapGreenhouseJob(slug, job);
      if (!row) throw new ProviderError("not-found", `Greenhouse posting not found: ${slug}/${ref}`);
      return { ...row, company };
    },
  };
}

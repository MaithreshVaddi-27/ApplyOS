// Origin: clean-room 2026-11-24, Phase 4.7 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// Eightfold, implemented once.
//
// Phase 4.7, stage six. The careers-search connector was the only
// implementation. Its public tenants have no DNS A records (verified
// 2026-10-01), so the parity oracle is the retired connector's own output over
// a captured payload. The board is retained as code so a working tenant can be
// added with one registry line. Pagination follows `start`/`num` off `count`
// and `total`, never a flag.
import { ProviderError } from "./errors.js";
import { providerFetch } from "./fetch.js";
import { asText, stripHtmlTags } from "./text.js";
import type { PostingDetail, Provider, ProviderRow, SearchPage, SearchRequest } from "./types.js";

/** One posting as Eightfold states it. */
export interface RawEightfoldPosting {
  id?: string;
  name?: string;
  location?: string | null;
  canonicalPositionUrl?: string;
  date_published?: string | null;
  sc_city?: string;
  sc_category?: string | null;
  description?: string;
}

/** One posting, in the SDK's neutral shape. */
export interface EightfoldRow extends ProviderRow {
  slug: string;
  category: string | null;
}

/** One listing response. */
export interface EightfoldFeed {
  count?: number;
  total?: number;
  positions?: RawEightfoldPosting[];
}

/** The listing URL for one tenant. */
export function eightfoldListUrl(slug: string, start: number, num = 100, query = ""): string {
  const params = new URLSearchParams({ domain: `${slug}.ai`, start: String(start), num: String(num) });
  if (query) params.set("query", query);
  return `https://${slug}.eightfold.ai/api/apply/v2/jobs?${params}`;
}

/** The detail URL for one posting. */
export function eightfoldDetailUrl(slug: string, id: string): string {
  return `https://${slug}.eightfold.ai/api/apply/v2/jobs/${encodeURIComponent(id)}?domain=${encodeURIComponent(`${slug}.ai`)}`;
}

/** ISO date from a string, or null. Never invents. */
export function eightfoldDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

/** Map one posting. */
export function mapEightfoldJob(slug: string, p: RawEightfoldPosting): EightfoldRow | null {
  if (!p || !p.id) return null;
  const id = String(p.id);
  return {
    id,
    title: asText(p.name, "Untitled").trim(),
    company: null,
    location: asText(p.location ?? p.sc_city).trim() || null,
    date: eightfoldDate(p.date_published),
    url: asText(p.canonicalPositionUrl) || `https://${slug}.eightfold.ai/careers/${id}`,
    description: p.description ? stripHtmlTags(p.description) : null,
    category: p.sc_category ?? null,
    slug,
  };
}

/** Map a listing. */
export function mapEightfoldJobs(slug: string, postings: RawEightfoldPosting[]): EightfoldRow[] {
  return postings.map((p) => mapEightfoldJob(slug, p)).filter((row): row is EightfoldRow => row !== null);
}

async function eightfoldFetch<T>(url: string, fetchImpl?: typeof fetch): Promise<T> {
  let res;
  try {
    res = await providerFetch(url, { headers: { Accept: "application/json" }, fetchImpl });
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError("network", `could not reach the Eightfold board (${e instanceof Error ? e.message : String(e)})`, { cause: e });
  }
  if (!res.ok) {
    throw new ProviderError("http", `the Eightfold board answered HTTP ${res.status}`, {
      retryable: res.status === 429 || (res.status >= 500 && res.status <= 599),
    });
  }
  try {
    return (await res.json()) as T;
  } catch (e) {
    throw new ProviderError("parse", "the Eightfold board did not answer with JSON", { cause: e });
  }
}

/** Fetch one listing page. */
export async function fetchEightfoldPage(
  slug: string,
  start: number,
  query = "",
  fetchImpl?: typeof fetch,
): Promise<EightfoldFeed> {
  return eightfoldFetch<EightfoldFeed>(eightfoldListUrl(slug, start, 100, query), fetchImpl);
}

/** Fetch one posting with its raw body. */
export async function fetchEightfoldJobPayload(
  slug: string,
  id: string,
  fetchImpl?: typeof fetch,
): Promise<{ position?: RawEightfoldPosting }> {
  return eightfoldFetch<{ position?: RawEightfoldPosting }>(eightfoldDetailUrl(slug, id), fetchImpl);
}

/** The CLI's detail string: name — place, blank line, body. */
export function eightfoldBody(p: RawEightfoldPosting): string {
  const body = p.description ? stripHtmlTags(p.description) : "(no description returned)";
  return `${asText(p.name, "Posting")}${p.location ? ` — ${p.location}` : ""}\n\n${body}`;
}

export interface EightfoldOptions {
  slug: string;
  company?: string;
  fetchImpl?: typeof fetch;
}

/** An Eightfold connector bound to one tenant. */
export function createEightfoldProvider(options: EightfoldOptions): Provider<EightfoldRow> {
  const slug = options.slug;
  const company = (options.company ?? slug).trim();
  return {
    id: "eightfold",
    version: "1.0.0",
    kind: "ats",
    displayName: `Eightfold: ${company}`,
    seedUrls: [eightfoldListUrl(slug, 0)],

    async search(req: SearchRequest): Promise<SearchPage<EightfoldRow>> {
      const feed = await fetchEightfoldPage(slug, 0, req.query ?? "", options.fetchImpl);
      const rows = mapEightfoldJobs(slug, feed.positions ?? []);
      const limit = req.limit ?? 20;
      const page = Math.max(1, req.page ?? 1);
      const start = limit === 0 ? 0 : (page - 1) * limit;
      const sliced = limit === 0 ? rows : rows.slice(start, start + limit);
      return {
        rows: sliced.map((r) => ({ ...r, company })),
        total: feed.total ?? rows.length,
        page,
        truncated: rows.length > start + sliced.length,
      };
    },

    async detail(ref: string): Promise<PostingDetail<EightfoldRow>> {
      const payload = await fetchEightfoldJobPayload(slug, ref, options.fetchImpl);
      const p = payload?.position;
      if (!p) throw new ProviderError("not-found", `eightfold job ${ref} not found (shape may have changed)`);
      const row = mapEightfoldJob(slug, p);
      if (!row) throw new ProviderError("not-found", `eightfold job ${ref} not found (shape may have changed)`);
      return { ...row, company, description: p.description ? stripHtmlTags(p.description) : "(no description returned)" };
    },
  };
}

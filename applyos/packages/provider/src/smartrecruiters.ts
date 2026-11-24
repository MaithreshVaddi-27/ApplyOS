// Origin: clean-room 2026-11-24, Phase 4.7 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// SmartRecruiters, implemented once.
//
// Phase 4.7, stage three. The engine connector is the implementation the parity
// fixtures were captured from. An ATS connector is constructed with its tenant.
//
// Two quirks are preserved because the board has them: `jobAd.sections` ships as
// an array on some tenants and a keyed object on others, and the listing is
// paged with an offset while reporting a separate `totalFound`.
import { ProviderError } from "./errors.js";
import { providerFetch } from "./fetch.js";
import { asText, stripAtsHtml } from "./text.js";
import type { PostingDetail, Provider, ProviderRow, SearchPage, SearchRequest } from "./types.js";

/** One listing page. */
export function srListUrl(slug: string, offset: number, perPage = 50): string {
  return `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings?limit=${perPage}&offset=${offset}`;
}

/** One posting by id. */
export function srDetailUrl(slug: string, id: string): string {
  return `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings/${encodeURIComponent(id)}`;
}

/** One posting as SmartRecruiters states it. */
export interface RawSmartRecruitersPosting {
  id: string;
  name?: string;
  location?: { city?: string; country?: string };
  releasedDate?: string;
  ref?: string;
}

/** One posting, in the SDK's neutral shape. */
export interface SmartRecruitersRow extends ProviderRow {
  slug: string;
}

/** Map one posting. The id comes from the API slug, never the display name. */
export function mapSmartRecruitersJob(slug: string, p: RawSmartRecruitersPosting): SmartRecruitersRow | null {
  if (!p || !p.id) return null;
  const city = p.location?.city ?? "";
  const country = p.location?.country ?? "";
  const loc = [city, country].filter(Boolean).join(", ") || null;
  return {
    id: String(p.id),
    title: (p.name ?? "Untitled").trim(),
    company: null,
    location: loc,
    date: p.releasedDate ? p.releasedDate.slice(0, 10) : null,
    url: `https://jobs.smartrecruiters.com/${encodeURIComponent(slug)}/${encodeURIComponent(String(p.id))}`,
    slug,
  };
}

/** Map a listing. */
export function mapSmartRecruitersJobs(slug: string, postings: RawSmartRecruitersPosting[]): SmartRecruitersRow[] {
  return postings
    .map((p) => mapSmartRecruitersJob(slug, p))
    .filter((row): row is SmartRecruitersRow => row !== null);
}

/**
 * Assemble the description from `jobAd.sections`, which ships as an array on
 * some tenants and a keyed object on others (observed live on Freshworks).
 */
export function srSections(jobAd: {
  sections?: { title?: string; text?: string }[] | Record<string, { title?: string; text?: string }>;
} | undefined): string {
  const raw = jobAd?.sections;
  const list = Array.isArray(raw) ? raw : Object.values(raw ?? {});
  return list
    .map((s) => `${s.title ?? ""}\n${stripAtsHtml(s.text ?? "")}`.trim())
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 4000);
}

/** The board's client-side query: the name and the city. */
export function filterSmartRecruiters(rows: SmartRecruitersRow[], req: SearchRequest): SmartRecruitersRow[] {
  const q = req.query?.toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    const city = row.location?.split(",")[0] ?? "";
    return `${row.title} ${city}`.toLowerCase().includes(q);
  });
}

async function srGet(url: string, options: SmartRecruitersOptions): Promise<unknown> {
  let res;
  try {
    res = await providerFetch(url, {
      headers: { Accept: "application/json" },
      fetchImpl: options.fetchImpl,
    });
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError("network", `could not reach the SmartRecruiters board (${e instanceof Error ? e.message : String(e)})`, { cause: e });
  }
  if (res.status === 404) throw new ProviderError("not-found", "SmartRecruiters posting not found");
  if (!res.ok) {
    throw new ProviderError("http", `the SmartRecruiters board answered HTTP ${res.status}`, {
      retryable: res.status === 429 || (res.status >= 500 && res.status <= 599),
    });
  }
  try {
    return await res.json();
  } catch (e) {
    throw new ProviderError("parse", "the SmartRecruiters board did not answer with JSON", { cause: e });
  }
}

export interface SmartRecruitersOptions {
  /** The tenant's board slug. */
  slug: string;
  /** The display name. */
  company?: string;
  fetchImpl?: typeof fetch;
}

/** A SmartRecruiters connector bound to one tenant. */
export function createSmartRecruitersProvider(options: SmartRecruitersOptions): Provider<SmartRecruitersRow> {
  const slug = options.slug;
  const company = (options.company ?? slug).trim();

  return {
    id: "smartrecruiters",
    version: "1.0.0",
    kind: "ats",
    displayName: `SmartRecruiters: ${company}`,
    seedUrls: [srListUrl(slug, 0)],

    async search(req: SearchRequest): Promise<SearchPage<SmartRecruitersRow>> {
      const perPage = 50;
      const requested = req.extra?.maxPages;
      const pages = requested === 0 ? 4 : Math.max(1, typeof requested === "number" ? requested : 1);
      const all: RawSmartRecruitersPosting[] = [];
      let pageTruncated = false;

      for (let page = 0; page < pages; page++) {
        const body = (await srGet(srListUrl(slug, page * perPage, perPage), options)) as {
          content?: RawSmartRecruitersPosting[];
          totalFound?: number;
        };
        const chunk = Array.isArray(body?.content) ? body.content : [];
        all.push(...chunk);
        if (chunk.length < perPage) break;
        if (page === pages - 1 && (body.totalFound ?? 0) > all.length) pageTruncated = true;
      }

      const rows = filterSmartRecruiters(mapSmartRecruitersJobs(slug, all), req);
      const limit = req.limit ?? 20;
      const page = Math.max(1, req.page ?? 1);
      const start = limit === 0 ? 0 : (page - 1) * limit;
      const sliced = limit === 0 ? rows : rows.slice(start, start + limit);
      const cap = limit === 0 ? rows.length : Math.min(start + sliced.length, rows.length);
      return {
        rows: sliced.map((r) => ({ ...r, company })),
        total: rows.length,
        page,
        truncated: pageTruncated || rows.length > cap,
      };
    },

    async detail(ref: string): Promise<PostingDetail<SmartRecruitersRow>> {
      const raw = (await srGet(srDetailUrl(slug, ref), options)) as RawSmartRecruitersPosting & {
        jobAd?: { sections?: { title?: string; text?: string }[] | Record<string, { title?: string; text?: string }> };
      };
      const row = mapSmartRecruitersJob(slug, raw);
      if (!row || !raw.name) throw new ProviderError("not-found", `SmartRecruiters posting not found: ${slug}/${ref}`);
      return { ...row, company, description: srSections(raw.jobAd) };
    },
  };
}

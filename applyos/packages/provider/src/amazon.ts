// Origin: clean-room 2026-11-24, Phase 4.7 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// Amazon, implemented once.
//
// Phase 4.7, stage five — the last engine connector. Amazon's public
// `search.json` has no detail endpoint: the detail lookup is another search
// whose text is the id, followed by an exact-id match in the returned page.
// That quirk is kept here, because it is the board's contract.
//
// Two conventions are the board's own and are preserved: the request always
// asks for the server's full 100-row page and the caller's limit is applied
// client-side, so `truncated` can also flag a possibly-fuller server page.
import { ProviderError } from "./errors.js";
import { providerFetch } from "./fetch.js";
import { asText, stripAtsHtml } from "./text.js";
import type { PostingDetail, Provider, ProviderRow, SearchPage, SearchRequest } from "./types.js";

/** The server caps a page at 100 postings. */
export const AMAZON_RESULT_LIMIT = 100;
/** The board's only company name, on every row. */
export const AMAZON_COMPANY = "Amazon";

/** One posting as the search response states it. */
export interface RawAmazonJob {
  id: string | number;
  title: string;
  location?: string;
  posting_date?: string;
  job_path?: string;
  description?: string;
  qualifications?: string;
}

/** One posting, in the SDK's neutral shape. */
export interface AmazonRow extends ProviderRow {}

/** Lenient ISO-ish parse: feeds carry ISO dates, invalid ones become null. */
export function amazonDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

/** Map one posting. An absent place or date stays null. */
export function mapAmazonJob(j: RawAmazonJob): AmazonRow {
  const id = String(j.id ?? "");
  const path = j.job_path ? String(j.job_path) : `/en/jobs/${id}`;
  return {
    id,
    title: asText(j.title, "Untitled").trim(),
    company: AMAZON_COMPANY,
    location: (asText(j.location) ?? "").trim() || null,
    date: amazonDate(j.posting_date),
    url: `https://www.amazon.jobs${path}`,
  };
}

/** Map a listing. */
export function mapAmazonJobs(jobs: RawAmazonJob[]): AmazonRow[] {
  return jobs.map(mapAmazonJob);
}

/** One search URL. `country` is a search-time preference, not a tenant. */
export function amazonSearchUrl(query: string, country = "IND", resultLimit = AMAZON_RESULT_LIMIT): string {
  const params = new URLSearchParams({
    base_query: query,
    country,
    offset: "0",
    result_limit: String(resultLimit),
    sort: "recent",
  });
  return `https://www.amazon.jobs/en/search.json?${params}`;
}

/** The detail lookup is a text search for the id, with a small page. */
export function amazonDetailUrl(id: string): string {
  return `https://www.amazon.jobs/en/search.json?${new URLSearchParams({ base_query: id, result_limit: "10" })}`;
}

/** Assemble the body: description first, qualifications after a blank line. */
export function amazonDescription(j: RawAmazonJob): string {
  return stripAtsHtml(`${j.description ?? ""}\n\n${j.qualifications ?? ""}`.trim()).slice(0, 4000);
}

/** Exact-id match inside a detail search page. */
export function findAmazonJob(jobs: RawAmazonJob[], id: string): RawAmazonJob | null {
  return jobs.find((j) => String(j.id) === id) ?? null;
}

async function amazonFetch(url: string, options: AmazonOptions): Promise<any> {
  let res;
  try {
    res = await providerFetch(url, { headers: { Accept: "application/json" }, fetchImpl: options.fetchImpl });
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError("network", `could not reach the Amazon board (${e instanceof Error ? e.message : String(e)})`, { cause: e });
  }
  if (!res.ok) {
    throw new ProviderError("http", `the Amazon board answered HTTP ${res.status}`, {
      retryable: res.status === 429 || (res.status >= 500 && res.status <= 599),
    });
  }
  try {
    return await res.json();
  } catch (e) {
    throw new ProviderError("parse", "the Amazon board did not answer with JSON", { cause: e });
  }
}

export interface AmazonOptions {
  /** Default market. The engine may override it per search. */
  country?: string;
  fetchImpl?: typeof fetch;
}

/** The Amazon connector. */
export function createAmazonProvider(options: AmazonOptions = {}): Provider<AmazonRow> {
  return {
    id: "amazon",
    version: "1.0.0",
    kind: "ats",
    displayName: "Amazon Jobs",
    seedUrls: [amazonSearchUrl("", options.country ?? "IND")],

    async search(req: SearchRequest): Promise<SearchPage<AmazonRow>> {
      const country = (req.extra?.country as string | undefined) ?? options.country ?? "IND";
      const json = await amazonFetch(amazonSearchUrl(req.query ?? "", country), options);
      const raw = Array.isArray(json?.jobs) ? (json.jobs as RawAmazonJob[]) : [];
      const rows = mapAmazonJobs(raw);
      const limit = req.limit ?? 20;
      const page = Math.max(1, req.page ?? 1);
      const start = limit === 0 ? 0 : (page - 1) * limit;
      const sliced = limit === 0 ? rows : rows.slice(start, start + limit);
      return {
        rows: sliced,
        total: typeof json?.hits === "number" ? json.hits : rows.length,
        page,
        // The board's own two signals: something was sliced away, or the
        // server page was full and may therefore hold more.
        truncated: rows.length > start + sliced.length || rows.length >= AMAZON_RESULT_LIMIT,
      };
    },

    async detail(ref: string): Promise<PostingDetail<AmazonRow>> {
      const json = await amazonFetch(amazonDetailUrl(ref), options);
      const raw = Array.isArray(json?.jobs) ? (json.jobs as RawAmazonJob[]) : [];
      const j = findAmazonJob(raw, ref);
      if (!j) throw new ProviderError("not-found", `amazon posting not found: ${ref}`);
      return { ...mapAmazonJob(j), description: amazonDescription(j) };
    },
  };
}

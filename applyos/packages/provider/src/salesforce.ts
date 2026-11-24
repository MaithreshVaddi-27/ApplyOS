// Origin: clean-room 2026-11-24, Phase 4.7 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// Salesforce (Phenom People widgets), implemented once.
//
// Phase 4.7, stage six. The careers-search connector was the only
// implementation. The widgets endpoint answered 503 during capture, so the
// parity oracle is the retired connector's own output over a captured payload.
// Its detail page is client-rendered: the body is scraped from server HTML when
// it carries more than 200 characters, otherwise the long-standing fallback
// text is shown. Both rules live here.
import { ProviderError } from "./errors.js";
import { providerFetch } from "./fetch.js";
import { asText, stripHtmlTags } from "./text.js";
import type { PostingDetail, Provider, ProviderRow, SearchPage, SearchRequest } from "./types.js";

/** The Phenom widgets endpoint behind careers.salesforce.com. */
export const SALESFORCE_WIDGET_URL = "https://salesforce.my.site.com/tpAppTK__JobSearch";

/** One posting as the widgets endpoint states it. */
export interface RawSalesforceJob {
  id: string;
  name?: string;
  location?: string | null;
  postedDate?: string | null;
  ts?: string;
  category?: string | null;
}

/** One posting, in the SDK's neutral shape. */
export interface SalesforceRow extends ProviderRow {
  category: string | null;
}

/** ISO date from a string, or null. Never invents. */
export function salesforceDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

/** Map one posting. */
export function mapSalesforceJob(p: RawSalesforceJob): SalesforceRow | null {
  if (!p || !p.id) return null;
  const id = String(p.id);
  return {
    id,
    title: asText(p.name, "Untitled").trim(),
    company: null,
    location: asText(p.location).trim() || null,
    date: salesforceDate(p.postedDate ?? p.ts),
    url: `https://careers.salesforce.com/en/jobs/${id}/`,
    category: p.category ?? null,
  };
}

/** Map a listing. */
export function mapSalesforceJobs(postings: RawSalesforceJob[]): SalesforceRow[] {
  return postings.map(mapSalesforceJob).filter((row): row is SalesforceRow => row !== null);
}

/** The board's client-side query: title and place. */
export function filterSalesforce(rows: SalesforceRow[], req: SearchRequest): SalesforceRow[] {
  const q = req.query?.toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => `${row.title} ${row.location ?? ""}`.toLowerCase().includes(q));
}

/** One widgets response, as the board states it. */
export interface SalesforceFeed {
  data?: {
    jobs?: (RawSalesforceJob & { ts?: string })[];
    count?: number;
    totalcount?: number;
    widgetSettings?: { id?: string };
  };
}

/** Fetch one widgets page. */
export async function fetchSalesforcePage(
  query: string,
  page: number,
  fetchImpl?: typeof fetch,
): Promise<SalesforceFeed> {
  let res;
  try {
    res = await providerFetch(SALESFORCE_WIDGET_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: "https://careers.salesforce.com/en/jobs/",
      },
      body: JSON.stringify({
        query,
        keywords: query,
        locationOption: "2",
        sortBy: "POSTED_DATE",
        page,
        limit: 20,
        widgetFilter: ["locationMappingFilter"],
        widget: "JobSearchResults",
        locale: "en",
        locationMappings: [],
      }),
      fetchImpl,
    });
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError("network", `could not reach the Salesforce board (${e instanceof Error ? e.message : String(e)})`, { cause: e });
  }
  if (!res.ok) {
    throw new ProviderError("http", `the Salesforce board answered HTTP ${res.status}`, {
      retryable: res.status === 429 || (res.status >= 500 && res.status <= 599),
    });
  }
  try {
    return (await res.json()) as SalesforceFeed;
  } catch (e) {
    throw new ProviderError("parse", "the Salesforce board did not answer with JSON", { cause: e });
  }
}

/** Fetch the server-rendered HTML of one posting. */
export async function fetchSalesforceDetailHtml(id: string, fetchImpl?: typeof fetch): Promise<string> {
  const url = `https://careers.salesforce.com/en/jobs/${encodeURIComponent(id)}/`;
  let res;
  try {
    res = await providerFetch(url, { headers: { Accept: "text/html,application/xhtml+xml" }, fetchImpl });
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError("network", `could not reach the Salesforce board (${e instanceof Error ? e.message : String(e)})`, { cause: e });
  }
  if (!res.ok) throw new ProviderError("http", `the Salesforce board answered HTTP ${res.status}`);
  return res.text();
}

/** The detail string: a JD block when it is substantial, else the fallback. */
export function salesforceDetailText(id: string, html: string): string {
  const match = html.match(/<div[^>]*(?:class|id)="[^"]*(?:job-?description|jd)[^"]*"[^>]*>([\s\S]{0,60000}?)<\/div>/i);
  if (match) {
    const text = stripHtmlTags(match[1]);
    if (text.length > 200) return text;
  }
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? `Salesforce posting ${id}`;
  return `${asText(title, `Salesforce posting ${id}`).trim()}\n\n(Salesforce's detail page is client-rendered; open the URL to read the full posting. Search output carries enough for fit evaluation.)`;
}

export interface SalesforceOptions {
  company?: string;
  fetchImpl?: typeof fetch;
}

/** The Salesforce connector. */
export function createSalesforceProvider(options: SalesforceOptions = {}): Provider<SalesforceRow> {
  const company = (options.company ?? "Salesforce").trim();
  return {
    id: "salesforce",
    version: "1.0.0",
    kind: "ats",
    displayName: "Salesforce Careers",
    seedUrls: [SALESFORCE_WIDGET_URL],

    async search(req: SearchRequest): Promise<SearchPage<SalesforceRow>> {
      const rows = filterSalesforce(mapSalesforceJobs((await fetchSalesforcePage(req.query ?? "", 1, options.fetchImpl)).data?.jobs ?? []), req);
      const limit = req.limit ?? 20;
      const page = Math.max(1, req.page ?? 1);
      const start = limit === 0 ? 0 : (page - 1) * limit;
      const sliced = limit === 0 ? rows : rows.slice(start, start + limit);
      return {
        rows: sliced.map((r) => ({ ...r, company })),
        total: rows.length,
        page,
        truncated: rows.length > start + sliced.length,
      };
    },

    async detail(ref: string): Promise<PostingDetail<SalesforceRow>> {
      const html = await fetchSalesforceDetailHtml(ref, options.fetchImpl);
      const row = mapSalesforceJob({ id: ref });
      if (!row) throw new ProviderError("not-found", `Salesforce posting not found: ${ref}`);
      return { ...row, company, description: salesforceDetailText(ref, html) };
    },
  };
}

// Origin: clean-room 2026-11-24, Phase 4.7 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// Workday, implemented once.
//
// Phase 4.7, stage four. The engine connector is the implementation the parity
// fixtures were captured from, with one deliberate fix: the board caps a page
// at 20 postings and answers 400 to 25 or 50 (verified live on 2026-11-24).
// The retired connector asked for 50 whenever its limit was 0 - and the
// engine's scrape always calls it with a limit above 20 - so the Workday
// source 400'd on every scrape. The SDK caps the board-side request at the
// value the board accepts.
//
// Workday is the one ATS board that searches with a POST body, which is why
// `providerFetch` gained optional method and body.
import { ProviderError } from "./errors.js";
import { providerFetch } from "./fetch.js";
import { asText, stripAtsHtml } from "./text.js";
import type { PostingDetail, Provider, ProviderRow, SearchPage, SearchRequest } from "./types.js";

/** The largest page the board accepts. Verified live: 20 is OK, 25 and 50 are 400. */
export const WORKDAY_MAX_PAGE = 20;

/** One posting as the search response states it. */
export interface RawWorkdayPosting {
  title?: string;
  externalPath?: string;
  bulletinId?: string;
  locationsText?: string;
  postedOn?: string;
}

/** One posting, in the SDK's neutral shape. */
export interface WorkdayRow extends ProviderRow {
  tenant: string;
  /** The board's own reference: externalPath, bulletinId, or an encoded title. */
  ref: string;
}

/** Parse "Posted 5 Days Ago"; ISO dates pass through; anything else is null. */
export function workdayDate(postedOn: string | undefined, nowMs: number = Date.now()): string | null {
  if (!postedOn) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(postedOn)) return postedOn.slice(0, 10);
  const m = postedOn.match(/(\d+)\s+day/i);
  if (m) return new Date(nowMs - Number(m[1]) * 86_400_000).toISOString().slice(0, 10);
  return null;
}

/** Map one search posting. */
export function mapWorkdayPosting(tenant: string, p: RawWorkdayPosting, nowMs?: number): WorkdayRow | null {
  if (!p || typeof p !== "object") return null;
  const ref = p.externalPath ?? p.bulletinId ?? encodeURIComponent(p.title ?? "untitled");
  return {
    id: ref,
    title: (p.title ?? "Untitled").trim(),
    company: null,
    location: (p.locationsText ?? "").trim() || null,
    date: workdayDate(p.postedOn, nowMs),
    url: `https://${tenant}.myworkdayjobs.com/en-US/${ref}`,
    ref,
    tenant,
  };
}

/** Map a search listing. */
export function mapWorkdayPostings(tenant: string, postings: RawWorkdayPosting[], nowMs?: number): WorkdayRow[] {
  return postings
    .map((p) => mapWorkdayPosting(tenant, p, nowMs))
    .filter((row): row is WorkdayRow => row !== null);
}

/**
 * The detail path: a full posting URL sheds its origin and `/en-US/{site}`;
 * a bare ref gains a leading slash.
 */
export function workdayDetailPath(ref: string, site: string): string {
  if (/^https?:\/\//i.test(ref)) {
    const safeSite = site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const path = ref
      .replace(/^https?:\/\/[^/]+/i, "")
      .replace(new RegExp(`^/en-US/${safeSite}`, "i"), "");
    return path.startsWith("/") ? path : `/${path}`;
  }
  return ref.startsWith("/") ? ref : `/${ref}`;
}

/** One posting in full, as the board states it. */
export interface RawWorkdayDetail {
  title?: string;
  jobDescription?: string;
  location?: string;
  postedOn?: string;
  startDate?: string;
  timeType?: string;
}

/**
 * Map a detail response.
 *
 * The detail url carries the instance and the site; the search url does not.
 * That asymmetry is the board's own shape, kept here rather than normalised.
 */
export function mapWorkdayDetail(
  tenant: string,
  instance: string,
  site: string,
  ref: string,
  info: RawWorkdayDetail | undefined,
  nowMs?: number,
): { row: WorkdayRow; description: string } | null {
  if (!info) return null;
  const path = workdayDetailPath(ref, site);
  const cleanRef = path.replace(/^\//, "");
  return {
    row: {
      id: cleanRef,
      title: (asText(info.title) ?? "Untitled").trim() || "Untitled",
      company: null,
      location: (info.location ?? "").trim() || null,
      date: workdayDate(info.postedOn ?? info.startDate, nowMs),
      url: `https://${tenant}.${instance}.myworkdayjobs.com/en-US/${site}${path}`,
      ref: cleanRef,
      tenant,
    },
    description: stripAtsHtml(info.jobDescription ?? "").slice(0, 4000) || "(no description returned)",
  };
}

async function workdayFetch(url: string, init: { method?: string; body?: string; headers?: Record<string, string> }, options: WorkdayOptions): Promise<unknown> {
  let res;
  try {
    res = await providerFetch(url, { ...init, fetchImpl: options.fetchImpl });
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError("network", `could not reach the Workday board (${e instanceof Error ? e.message : String(e)})`, { cause: e });
  }
  if (res.status === 404) throw new ProviderError("not-found", "Workday posting not found");
  if (!res.ok) {
    throw new ProviderError("http", `the Workday board answered HTTP ${res.status}`, {
      retryable: res.status === 429 || (res.status >= 500 && res.status <= 599),
    });
  }
  try {
    return await res.json();
  } catch (e) {
    throw new ProviderError("parse", "the Workday board did not answer with JSON", { cause: e });
  }
}

export interface WorkdayOptions {
  tenant: string;
  site: string;
  instance?: string;
  company?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

/** Search URL for one tenant. */
export function workdaySearchUrl(target: { tenant: string; site: string; instance?: string }): string {
  const instance = target.instance ?? "wd3";
  return `https://${target.tenant}.${instance}.myworkdayjobs.com/wday/cxs/${target.tenant}/${target.site}/jobs`;
}

/** A Workday connector bound to one tenant. */
export function createWorkdayProvider(options: WorkdayOptions): Provider<WorkdayRow> {
  const tenant = options.tenant;
  const site = options.site;
  const instance = options.instance ?? "wd3";
  const company = (options.company ?? tenant).trim();
  const now = options.now ?? (() => new Date());
  const searchUrl = workdaySearchUrl({ tenant, site, instance });

  return {
    id: "workday",
    version: "1.0.0",
    kind: "ats",
    displayName: `Workday: ${company}`,
    seedUrls: [searchUrl],

    async search(req: SearchRequest): Promise<SearchPage<WorkdayRow>> {
      const page = Math.max(1, req.page ?? 1);
      // The board rejects a page above 20, so every request asks for at most
      // that. Workday pages server-side: the offset travels in the POST body
      // and the rows it answers ARE the page. Slicing them again would drop
      // page 2 entirely.
      const boardLimit = req.limit === undefined || req.limit === 0
        ? WORKDAY_MAX_PAGE
        : Math.min(req.limit, WORKDAY_MAX_PAGE);
      const offset = (page - 1) * boardLimit;
      const json = await workdayFetch(
        searchUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            appliedFacets: {},
            limit: boardLimit,
            offset,
            searchText: req.query ?? "",
          }),
        },
        options,
      );
      const body = json as { jobPostings?: RawWorkdayPosting[] };
      const postings = Array.isArray(body?.jobPostings) ? body.jobPostings : [];
      const mapped = mapWorkdayPostings(tenant, postings, now().getTime());
      // The board honours limit and offset. A stand-in may over-return, so cap
      // the page to what the caller asked for before handing it back.
      const callerLimit = req.limit ?? 20;
      const rows = callerLimit === 0 ? mapped : mapped.slice(0, callerLimit);
      const total = (json as { total?: number })?.total ?? mapped.length;
      return {
        rows: rows.map((r) => ({ ...r, company })),
        total,
        page,
        truncated: total > offset + rows.length,
      };
    },

    async detail(ref: string): Promise<PostingDetail<WorkdayRow>> {
      const path = workdayDetailPath(ref, site);
      const url = `https://${tenant}.${instance}.myworkdayjobs.com/wday/cxs/${tenant}/${site}${path}`;
      const json = await workdayFetch(url, { headers: { Accept: "application/json" } }, options);
      const info = (json as { jobPostingInfo?: RawWorkdayDetail })?.jobPostingInfo;
      const mapped = mapWorkdayDetail(tenant, instance, site, ref, info, now().getTime());
      if (!mapped) throw new ProviderError("not-found", `Workday posting not found: ${ref}`);
      return { ...mapped.row, company, description: mapped.description };
    },
  };
}

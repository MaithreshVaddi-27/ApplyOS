// Origin: clean-room 2026-11-24, Phase 4.7 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// Ashby, implemented once.
//
// Phase 4.7, stage six. The board had only a careers-search connector; its
// public posting API 401s for the seeded tenants (verified 2026-11-24), so the
// parity oracle is the retired connector's own output over a captured payload.
// The endpoint, parsing and paging live here; each surface keeps its own row
// conventions (notably: the CLI calls a remote-only posting's place "Remote",
// while the SDK keeps the board's two facts separate).
import { ProviderError } from "./errors.js";
import { providerFetch } from "./fetch.js";
import { asText } from "./text.js";
import type { PostingDetail, Provider, ProviderRow, SearchPage, SearchRequest } from "./types.js";

/** One posting as Ashby states it. */
export interface RawAshbyPosting {
  id?: string;
  title?: string;
  location?: string;
  isRemote?: boolean;
  jobUrl?: string;
  publishedAt?: string;
  descriptionPlain?: string;
}

/** One posting, in the SDK's neutral shape. */
export interface AshbyRow extends ProviderRow {
  slug: string;
  /** The board's own remote flag, kept separate from the place. */
  remote: boolean;
}

/** The posting API for one tenant. */
export function ashbyBoardUrl(slug: string): string {
  return `https://api.ashbyhq.com/non-authed/posting-api/job-board/${encodeURIComponent(slug)}`;
}

/** ISO date from a string, or null. Never invents. */
export function ashbyDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

/** Map one posting. An absent place stays null even when the job is remote. */
export function mapAshbyJob(slug: string, p: RawAshbyPosting): AshbyRow | null {
  if (!p || !p.id) return null;
  const id = String(p.id);
  return {
    id,
    title: asText(p.title, "Untitled").trim(),
    company: null,
    location: asText(p.location).trim() || null,
    date: ashbyDate(p.publishedAt),
    url: asText(p.jobUrl) || `https://jobs.ashbyhq.com/${slug}/${id}`,
    description: p.descriptionPlain ? p.descriptionPlain.slice(0, 1200) : null,
    remote: p.isRemote === true,
    slug,
  };
}

/** Map a listing. */
export function mapAshbyJobs(slug: string, postings: RawAshbyPosting[]): AshbyRow[] {
  return postings.map((p) => mapAshbyJob(slug, p)).filter((row): row is AshbyRow => row !== null);
}

/** The board's client-side query: title, place and body. */
export function filterAshby(rows: AshbyRow[], req: SearchRequest): AshbyRow[] {
  const q = req.query?.toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => `${row.title} ${row.location ?? ""} ${row.description ?? ""}`.toLowerCase().includes(q));
}

async function ashbyFetch(slug: string, fetchImpl?: typeof fetch): Promise<RawAshbyPosting[]> {
  let res;
  try {
    res = await providerFetch(ashbyBoardUrl(slug), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      fetchImpl,
    });
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError("network", `could not reach the Ashby board (${e instanceof Error ? e.message : String(e)})`, { cause: e });
  }
  if (!res.ok) {
    throw new ProviderError("http", `the Ashby board answered HTTP ${res.status}`, {
      retryable: res.status === 429 || (res.status >= 500 && res.status <= 599),
    });
  }
  let payload: unknown;
  try {
    payload = await res.json();
  } catch (e) {
    throw new ProviderError("parse", "the Ashby board did not answer with JSON", { cause: e });
  }
  const jobs = (payload as { jobs?: unknown })?.jobs;
  if (!Array.isArray(jobs)) throw new ProviderError("parse", "the Ashby listing did not carry a job array");
  return jobs as RawAshbyPosting[];
}

/** Fetch one tenant's postings. */
export async function fetchAshbyPostings(slug: string, fetchImpl?: typeof fetch): Promise<RawAshbyPosting[]> {
  return ashbyFetch(slug, fetchImpl);
}

/** The CLI's detail body: title, blank line, plain-text body. */
export function ashbyBody(p: RawAshbyPosting): string {
  return `${asText(p.title, "Posting")}\n\n${asText(p.descriptionPlain) || "(no description returned)"}`;
}

export interface AshbyOptions {
  slug: string;
  company?: string;
  fetchImpl?: typeof fetch;
}

/** An Ashby connector bound to one tenant. */
export function createAshbyProvider(options: AshbyOptions): Provider<AshbyRow> {
  const slug = options.slug;
  const company = (options.company ?? slug).trim();
  return {
    id: "ashby",
    version: "1.0.0",
    kind: "ats",
    displayName: `Ashby: ${company}`,
    seedUrls: [ashbyBoardUrl(slug)],

    async search(req: SearchRequest): Promise<SearchPage<AshbyRow>> {
      const rows = filterAshby(mapAshbyJobs(slug, await ashbyFetch(slug, options.fetchImpl)), req);
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

    async detail(ref: string): Promise<PostingDetail<AshbyRow>> {
      const postings = await ashbyFetch(slug, options.fetchImpl);
      const p = postings.find((x) => String(x.id) === ref);
      if (!p) throw new ProviderError("not-found", `posting ${ref} not found on ashby board ${slug}`);
      const row = mapAshbyJob(slug, p);
      if (!row) throw new ProviderError("not-found", `posting ${ref} not found on ashby board ${slug}`);
      return { ...row, company, description: asText(p.descriptionPlain) || "(no description returned)" };
    },
  };
}

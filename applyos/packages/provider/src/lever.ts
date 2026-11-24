// Origin: clean-room 2026-11-23, Phase 4.7 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// Lever, implemented once.
//
// Phase 4.7, stage two. The engine's Lever connector is the implementation the
// parity fixtures were captured from. An ATS connector is constructed with its
// tenant, because the endpoint carries a board slug.
//
// Lever's list payload already carries each posting's body and its additional
// sections, so the detail lookup finds the posting in the list rather than
// making a second request - which is what the engine connector has always done.
import { ProviderError } from "./errors.js";
import { providerFetch } from "./fetch.js";
import { stripAtsHtml } from "./text.js";
import type { PostingDetail, Provider, ProviderRow, SearchPage, SearchRequest } from "./types.js";

/** The list for one tenant. */
export function leverListUrl(slug: string): string {
  return `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;
}

/** One posting as Lever states it. */
export interface RawLeverPosting {
  id: string;
  text?: string;
  hostedUrl?: string;
  categories?: { location?: string; team?: string; commitment?: string };
  description?: string;
  descriptionPlain?: string;
  lists?: { text: string; content: string }[];
  /** Unix milliseconds. */
  createdAt?: number;
}

/** One posting, in the SDK's neutral shape. */
export interface LeverRow extends ProviderRow {
  slug: string;
  /** The board's own commitment, or null when it stated none. */
  commitment: string | null;
}

/** Map one posting. */
export function mapLeverJob(slug: string, p: RawLeverPosting): LeverRow | null {
  if (!p || !p.id) return null;
  return {
    id: String(p.id),
    title: (p.text ?? "Untitled").trim(),
    company: null,
    location: (p.categories?.location ?? "").trim() || null,
    date: p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : null,
    url: p.hostedUrl ?? "",
    description: p.description ? stripAtsHtml(p.description) : null,
    commitment: p.categories?.commitment || null,
    slug,
  };
}

/** Map a listing. */
export function mapLeverJobs(slug: string, postings: RawLeverPosting[]): LeverRow[] {
  return postings
    .map((p) => mapLeverJob(slug, p))
    .filter((row): row is LeverRow => row !== null);
}

/**
 * Assemble the body: the posting's description, then its additional sections.
 *
 * The two 2000-character caps are the engine connector's own behaviour, kept
 * here so the board's text does not change shape in the migration.
 */
export function leverDescription(p: RawLeverPosting): string {
  const sections = (p.lists ?? [])
    .map((s) => `${s.text}\n${stripAtsHtml(s.content ?? "")}`)
    .join("\n\n");
  return (
    stripAtsHtml(p.description ?? "").slice(0, 2000) +
    (sections ? `\n\n${sections}`.slice(0, 2000) : "")
  );
}

/** The board's client-side query: title and place. */
export function filterLever(rows: LeverRow[], req: SearchRequest): LeverRow[] {
  const q = req.query?.toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => `${row.title} ${row.location ?? ""}`.toLowerCase().includes(q));
}

async function fetchLever(url: string, options: LeverOptions): Promise<RawLeverPosting[]> {
  let res;
  try {
    res = await providerFetch(url, {
      headers: { Accept: "application/json" },
      fetchImpl: options.fetchImpl,
    });
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError("network", `could not reach the Lever board (${e instanceof Error ? e.message : String(e)})`, { cause: e });
  }
  if (!res.ok) {
    throw new ProviderError("http", `the Lever board answered HTTP ${res.status}`, {
      retryable: res.status === 429 || (res.status >= 500 && res.status <= 599),
    });
  }
  let payload: unknown;
  try {
    payload = await res.json();
  } catch (e) {
    throw new ProviderError("parse", "the Lever board did not answer with JSON", { cause: e });
  }
  const list = Array.isArray(payload) ? payload : (payload as { data?: unknown[] })?.data;
  if (!Array.isArray(list)) {
    throw new ProviderError("parse", "the Lever listing did not carry a posting array");
  }
  return list as RawLeverPosting[];
}

/** Fetch one tenant's postings. The paging policy belongs to each surface. */
export async function fetchLeverPostings(slug: string, fetchImpl?: typeof fetch): Promise<RawLeverPosting[]> {
  return fetchLever(leverListUrl(slug), { slug, fetchImpl });
}

export interface LeverOptions {
  /** The tenant's board slug, e.g. "cred". */
  slug: string;
  /** The display name, when the tenant's slug is not the employer's name. */
  company?: string;
  fetchImpl?: typeof fetch;
}

/** A Lever connector bound to one tenant. */
export function createLeverProvider(options: LeverOptions): Provider<LeverRow> {
  const slug = options.slug;
  const company = (options.company ?? slug).trim();

  return {
    id: "lever",
    version: "1.0.0",
    kind: "ats",
    displayName: `Lever: ${company}`,
    seedUrls: [leverListUrl(slug)],

    async search(req: SearchRequest): Promise<SearchPage<LeverRow>> {
      const all = mapLeverJobs(slug, await fetchLever(leverListUrl(slug), options));
      const matched = filterLever(all, req);
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

    async detail(ref: string): Promise<PostingDetail<LeverRow>> {
      const postings = await fetchLever(leverListUrl(slug), options);
      const found = postings.find((p) => String(p.id) === ref);
      if (!found) throw new ProviderError("not-found", `Lever posting not found: ${slug}/${ref}`);
      const row = mapLeverJob(slug, found);
      if (!row) throw new ProviderError("not-found", `Lever posting not found: ${slug}/${ref}`);
      return { ...row, company, description: leverDescription(found) };
    },
  };
}

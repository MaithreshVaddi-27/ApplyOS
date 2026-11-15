// Origin: clean-room 2026-11-13, Phase 4 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// RemoteOK, implemented once.
//
// This replaces two parsers: the one in the remoteok-search CLI and the one
// in applyos/packages/portals. They disagreed - different URLs, different id
// formats, different User-Agents, and different ideas about what an absent
// location means.
//
// The behaviour reproduced here is the CLI's, because the CLI is the surface
// `/scrape` uses and therefore the one a candidate sees.
//
// Two deliberate differences from the old CLI:
//
//   - An absent location is `null`, not an empty string. The portal-skill
//     contract (ADR-0006) says a value the board did not state is null.
//   - A row with no usable url is dropped, not given a url built from its id.
//     The board states either a url or a slug; a url guessed from an id is a
//     guess, and a guessed url is a broken link.
//
// Both are recorded in ADR-0008's implementation record.

import { ProviderError } from "./errors.js";
import { providerFetch, PROVIDER_UA } from "./fetch.js";
import { formatSalary, stripHtmlTags } from "./text.js";
import type { PostingDetail, Provider, ProviderRow, SearchPage, SearchRequest } from "./types.js";

export const REMOTEOK_BASE_URL = "https://remoteok.com";
export const REMOTEOK_API_URL = "https://remoteok.com/api";

/** The shape of one row in the feed. */
export interface RemoteOkRawJob {
  id?: string | number;
  slug?: string;
  epoch?: number;
  date?: string;
  company?: string;
  company_logo?: string;
  position?: string;
  tags?: string[];
  description?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  apply_url?: string;
  url?: string;
  original?: boolean;
}

/** One posting from the feed, in the SDK's neutral shape. */
export interface RemoteOkJob extends ProviderRow {
  /**
   * The board's slug.
   *
   * The feed always carries one, and `mapRemoteOk` emits `""` when it does
   * not, so a feed row's slug is always a string. It stays optional on the
   * type because a posting read from the board's own page carries none.
   */
  slug?: string;
}

/**
 * Map the feed's rows to the SDK's neutral shape.
 *
 * The feed's first row is legal/notice metadata rather than a posting, so it
 * is dropped by the same rule that drops any row without a position.
 */
export function mapRemoteOk(rows: RemoteOkRawJob[]): RemoteOkJob[] {
  const out: RemoteOkJob[] = [];
  for (const item of rows) {
    if (!item || item.id === undefined || item.id === null) continue;
    if (!item.position) continue;
    const id = String(item.id);
    const slug = typeof item.slug === "string" ? item.slug.trim() : "";
    // The url must be a string. A board that sends a number here has sent
    // something we cannot honestly represent, and casting it would put a
    // number in a url field. The board's own url pattern is
    // /remote-jobs/<slug>, so a slug is enough to state one; without either,
    // the row has no url we can stand behind.
    const stated = typeof item.url === "string" ? item.url.trim() : "";
    const url = stated || (slug ? `${REMOTEOK_BASE_URL}/remote-jobs/${slug}` : "");
    if (!url) continue;
    const location = item.location && item.location.trim() ? item.location.trim() : null;
    const job: RemoteOkJob = {
      id,
      slug,
      title: item.position || "",
      company: item.company || null,
      location,
      date: item.date || null,
      url,
      salary: formatSalary(item.salary_min, item.salary_max),
      tags: Array.isArray(item.tags) ? item.tags : [],
      description: item.description ? stripHtmlTags(item.description) : undefined,
      applyUrl: item.apply_url || url,
    };
    out.push(job);
  }
  return out;
}

/** Fetch the feed and map it. */
export async function fetchRemoteOkJobs(options: {
  fetchImpl?: typeof fetch;
} = {}): Promise<RemoteOkJob[]> {
  let payload: unknown;
  try {
    const res = await providerFetch(REMOTEOK_API_URL, { fetchImpl: options.fetchImpl });
    if (!res.ok) {
      throw new ProviderError("http", `HTTP ${res.status} for ${REMOTEOK_API_URL}`, {
        retryable: res.status === 429 || (res.status >= 500 && res.status <= 599),
      });
    }
    payload = await res.json();
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError("network", e instanceof Error ? e.message : String(e), { cause: e });
  }
  if (!Array.isArray(payload)) {
    throw new ProviderError("parse", "the RemoteOK feed did not return an array");
  }
  return mapRemoteOk(payload as RemoteOkRawJob[]);
}

/** Keyword match: every word must appear somewhere in the posting. */
function matchesQuery(job: RemoteOkJob, query: string): boolean {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = [
    job.title,
    job.company,
    job.location ?? "",
    ...(job.tags ?? []),
    job.description ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return words.every((w) => haystack.includes(w));
}

function matchesTag(job: RemoteOkJob, tag: string): boolean {
  const wanted = tag.toLowerCase().trim();
  return (job.tags ?? []).some((t) => t.toLowerCase().includes(wanted));
}

/**
 * Location match.
 *
 * A posting that says "worldwide" is kept for any location filter, and a
 * posting with no location at all is kept too - the board did not narrow it.
 */
function matchesLocation(job: RemoteOkJob, location: string): boolean {
  const wanted = location.toLowerCase().trim();
  if (wanted === "remote" || wanted === "any" || wanted === "all") return true;
  const loc = (job.location ?? "").toLowerCase();
  if (loc.includes("worldwide") || loc === "") return true;
  return loc.includes(wanted);
}

/** Salary match: a posting with no salary stated is kept. */
function matchesSalary(job: RemoteOkJob, min: number): boolean {
  if (min === undefined) return true;
  if (!job.salary) return true;
  const match = job.salary.match(/[\d,]+/g);
  if (!match) return true;
  let value = parseFloat(match[0].replace(/,/g, ""));
  if (job.salary.toLowerCase().includes("k")) value *= 1000;
  if (Number.isNaN(value)) return true;
  return value >= min;
}

/** Age match: a posting with no date, or an unparseable one, is kept. */
function matchesAge(job: RemoteOkJob, jobAgeDays: number): boolean {
  if (!jobAgeDays || jobAgeDays <= 0) return true;
  if (!job.date) return true;
  const posted = new Date(job.date).getTime();
  if (Number.isNaN(posted)) return true;
  return posted >= Date.now() - jobAgeDays * 24 * 60 * 60 * 1000;
}

/** Apply every filter a request asks for. */
export function filterRemoteOk(jobs: RemoteOkJob[], req: SearchRequest): RemoteOkJob[] {
  let out = jobs;
  if (req.query) out = out.filter((j) => matchesQuery(j, req.query as string));
  if (req.tag) out = out.filter((j) => matchesTag(j, req.tag as string));
  if (req.location) out = out.filter((j) => matchesLocation(j, req.location as string));
  if (req.salaryMin !== undefined) out = out.filter((j) => matchesSalary(j, req.salaryMin as number));
  if (req.jobAgeDays !== undefined) out = out.filter((j) => matchesAge(j, req.jobAgeDays as number));
  return out;
}

export interface RemoteOkOptions {
  /**
   * The fetch to use. Defaults to the global fetch.
   *
   * Every provider is CONSTRUCTED with its dependencies rather than
   * hard-wiring the network, so a test can bind a fixture and never reach
   * the real board. The exported singleton below is the production one.
   */
  fetchImpl?: typeof fetch;
}

/** A provider bound to a specific fetch. */
export function createRemoteOkProvider(options: RemoteOkOptions = {}): Provider<RemoteOkJob> {
  const fetchImpl = options.fetchImpl;
  return {
    id: "remoteok",
    version: "1.0.0",
    kind: "aggregator",
    displayName: "Remote OK",
    seedUrls: [REMOTEOK_API_URL],

    async search(req: SearchRequest): Promise<SearchPage<RemoteOkJob>> {
      const jobs = await fetchRemoteOkJobs({ fetchImpl });
      const filtered = filterRemoteOk(jobs, req);
      const page = Math.max(1, req.page ?? 1);
      // The SDK's limit contract (docs/design/provider-sdk.md §2.1): undefined
      // means the default page size, 0 means no cap, and a positive number
      // is the page size. Each surface translates its own convention into
      // this one before calling.
      const limit = req.limit === undefined ? 20 : req.limit;
      const start = (page - 1) * limit;
      const rows = limit === 0 ? filtered : filtered.slice(start, start + limit);
      return {
        rows,
        total: filtered.length,
        page,
        truncated: filtered.length > start + rows.length,
      };
    },

    /**
     * Look a posting up.
     *
     * The chain is the one the CLI has always used, and the order matters:
     *
     *   1. The feed. Fast, and it carries the whole row.
     *   2. The listing's own page. It carries a JSON-LD JobPosting block that
     *      the feed does not always carry - and it is the only route when the
     *      feed itself could not be read.
     *
     * A feed failure is therefore NOT fatal here: it falls through to the
     * page, exactly as the CLI has always done. Only a page that cannot be
     * read, or that carries no structured posting, ends the lookup.
     */
    async detail(ref: string): Promise<PostingDetail<RemoteOkJob>> {
      const wanted = ref.trim();
      const extracted = extractRemoteOkId(wanted);

      try {
        const jobs = await fetchRemoteOkJobs({ fetchImpl });
        const found = matchRemoteOkJob(jobs, wanted, extracted);
        if (found) {
          return { ...found, description: found.description ?? "" };
        }
      } catch {
        // The feed could not be read. The listing page may still answer.
      }

      const url = buildRemoteOkDetailUrl(wanted);
      let res;
      try {
        res = await providerFetch(url, { fetchImpl });
      } catch (e) {
        // The page could not be reached at all. That is a fetch failure, not
        // a missing posting - the two must not be reported as one thing.
        throw new ProviderError(
          "network",
          e instanceof Error ? e.message : String(e),
          { cause: e },
        );
      }
      if (!res.ok) {
        throw new ProviderError("not-found", `listing not found: ${ref}`);
      }
      const html = await res.text();
      const parsed = parseRemoteOkJsonLd(html, url, extracted);
      if (!parsed) {
        // No structured JobPosting schema: report a parse failure rather than
        // inventing a title, company, description, date, or location. A bare
        // <title> match is not a verified listing.
        throw new ProviderError("parse", `failed to parse listing data for: ${ref}`);
      }
      return parsed;
    },
  };
}

/** The URL of a listing's own page. */
export function buildRemoteOkDetailUrl(idOrUrl: string): string {
  const trimmed = idOrUrl.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) {
    return `${REMOTEOK_BASE_URL}${trimmed}`;
  }
  return `${REMOTEOK_BASE_URL}/remote-jobs/${trimmed}`;
}

/**
 * Read a listing's JSON-LD JobPosting block.
 *
 * Returns null when the page carries no structured data. Inventing a listing
 * from a <title> match is the failure this avoids.
 */
export function parseRemoteOkJsonLd(html: string, url: string, fallbackId: string): PostingDetail<RemoteOkJob> | null {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)];
  for (const s of scripts) {
    try {
      const json = JSON.parse(s[1]);
      if (json["@type"] !== "JobPosting") continue;
      const title = json.title || "";
      const company = json.hiringOrganization?.name || "";
      const description = json.description ? stripHtmlTags(json.description) : "";
      const date = json.datePosted || "";
      let salary: string | undefined;
      if (json.baseSalary?.value?.minValue || json.baseSalary?.value?.maxValue) {
        const min = json.baseSalary.value.minValue;
        const max = json.baseSalary.value.maxValue;
        const curr = json.baseSalary.currency || "$";
        salary = min === max ? `${curr}${min}` : `${curr}${min} - ${curr}${max}`;
      }
      return {
        id: fallbackId,
        title,
        company,
        location: null,
        date: date || null,
        url,
        salary,
        description,
      };
    } catch {
      // Continue to the next script.
    }
  }
  return null;
}

/** The production provider. A test binds its own with `createRemoteOkProvider`. */
export const remoteOkProvider: Provider<RemoteOkJob> = createRemoteOkProvider();

/**
 * The numeric id a reference carries.
 *
 * Exact matching only. An earlier version fell back to `url.endsWith(id)`,
 * which turned a search for "123" into the "...-dev-5123" posting. The only
 * fallback is a dash-anchored numeric url tail, and only when exactly one
 * posting carries it.
 */
export function extractRemoteOkId(idOrUrl: string): string {
  const trimmed = idOrUrl.trim();
  const match = trimmed.match(/\/remote-jobs\/(?:.*-)?(\d+)/) || trimmed.match(/(\d+)$/);
  return match ? match[1] : trimmed;
}

/** Find one posting by id, slug, or url. */
export function matchRemoteOkJob(
  jobs: RemoteOkJob[],
  searchId: string,
  extractedNum: string,
): RemoteOkJob | undefined {
  const exact = jobs.find(
    (j) =>
      j.id === searchId ||
      j.id === extractedNum ||
      (j.slug && j.slug === searchId) ||
      (j.url && j.url === searchId),
  );
  if (exact) return exact;
  if (!extractedNum) return undefined;
  const candidates = jobs.filter((j) => j.url && j.url.replace(/\/+$/, "").endsWith(`-${extractedNum}`));
  return candidates.length === 1 ? candidates[0] : undefined;
}

export { PROVIDER_UA };

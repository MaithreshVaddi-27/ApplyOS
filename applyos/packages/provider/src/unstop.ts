// Origin: clean-room 2026-11-16, Phase 4 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// Unstop, implemented once.
//
// This replaces two parsers: the one in the unstop-search CLI and the one in
// applyos/packages/portals. They used different endpoints, and the engine's
// was the wrong one for the job.
//
// **The board's two endpoints are not equivalent.** Verified live on
// 2026-11-16:
//
//   /api/public/opportunity/search-result?opportunity=<jobs|internships>
//     - the RICH listing. Carries `organisation`, `locations`, `jobDetail`
//       (salary, employment type, workplace type), `details`, `filters`,
//       `required_skills` and `updated_at`.
//     - Scoped to one listing: `opportunity=jobs` or `opportunity=internships`.
//     - `searchTerm` genuinely filters. `?searchTerm=python` answered with
//       671 matches where the unfiltered feed reported 10000.
//     - 10 rows per page.
//
//   /api/public/opportunity/search?search=&per_page=&page=
//     - the THIN listing. Carries `organisation`, `start_date`, `location`
//       and `public_url`, but no `jobDetail`, no `details`, no `updated_at`
//       and no `locations` array.
//     - Covers EVERY opportunity type at once: the first page held jobs,
//       workshops and competitions side by side.
//     - `per_page` is ignored (20 rows came back whatever was asked for).
//     - `search` does NOT filter. `?search=python` reported the same 323691
//       total as no query at all; it only reordered the results.
//
// The engine's retired adapter used the thin endpoint, which is why its rows
// had no location, no salary, and a RELATIVE url (`public_url` is a path, not
// a URL - the adapter never prefixed it with the board's host).
//
// The behaviour reproduced here is the CLI's, because the CLI is the surface
// `/scrape` uses and therefore the one a candidate sees.
//
// **Unstop's politeness differs from the shared policy, and is preserved.** The
// CLI gave a hung portal 15 seconds per attempt and three attempts before
// giving up, because `/scrape` must never hang on one board. The shared
// policy's 20 seconds and one retry are more generous than that.

import { ProviderError } from "./errors.js";
import { providerFetch } from "./fetch.js";
import { asText, decodeHtmlEntities } from "./text.js";
import type { PostingDetail, Provider, ProviderRow, SearchPage, SearchRequest } from "./types.js";

export const UNSTOP_BASE_URL = "https://unstop.com";

/** The rich listing endpoint. The thin one is not used by either surface. */
export const UNSTOP_SEARCH_PATH = "/api/public/opportunity/search-result";

/** The board's two listings. */
export type UnstopListing = "jobs" | "internships";

/** The board's own opportunity type, which is not the same as its listing. */
export type UnstopOpportunityType = "job" | "internship" | string;

/** The shape of one opportunity in the rich listing. */
export interface UnstopRawOpportunity {
  id: number | string;
  title?: string;
  /** A PATH, not a URL: "jobs/some-slug-1813094". */
  public_url?: string;
  type?: string;
  subtype?: string;
  updated_at?: string;
  end_date?: string;
  /** The posting body, as HTML. */
  details?: string;
  organisation?: { name?: string };
  locations?: Array<{ city?: string; state?: string; country?: string }>;
  jobDetail?: {
    min_salary?: number;
    max_salary?: number;
    currency?: string;
    type?: string;
    timing?: string;
    locations?: string[];
  };
  required_skills?: Array<{ skill?: string; skill_name?: string }>;
  filters?: Array<{ name?: string; type?: string }>;
}

/** One posting from the board, in the SDK's neutral shape. */
export interface UnstopRow extends ProviderRow {
  /** The board's own type: "jobs", "internships", "workshops", ... */
  type: string | null;
  /** Full-time / part-time / flexible (jobDetail.timing). */
  employmentType: string | null;
  /** Remote / hybrid / on-site (jobDetail.type). */
  workplaceType: string | null;
  /** The application deadline (end_date), or null when the board states none. */
  deadline: string | null;
  /** The board's own update timestamp, verbatim. */
  updatedAt: string | null;
  skills: string[];
  eligibility: string[];
}

/** One posting, in full. */
export interface UnstopDetailRow extends UnstopRow {
  /** The posting body, as text. The board's own words, never summarised. */
  description: string | null;
}

/**
 * Unstop's own HTML-to-text rule.
 *
 * The SDK's shared `stripHtmlTags` is RemoteOK's, and the two boards'
 * descriptions do not flatten the same way: Unstop turns a bare `<li>` into a
 * bullet and drops no other spacing. A description is read by the gates and
 * checked by the Grounding Audit, so its text must not change shape in a
 * migration.
 */
export function stripUnstopHtml(raw: string): string {
  if (!raw) return "";
  return decodeHtmlEntities(
    raw
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li>/gi, "• ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Normalize a card salary string to an [minLpa, maxLpa] range.
 *
 * Unstop cards mix monthly INR ("₹ 25,000 - 40,000") and annual LPA
 * ("6-8 LPA") figures; comparing raw numbers against the --salary LPA range
 * never filtered.
 *
 * Returns null when no usable figure exists (the caller keeps the card).
 */
export function salaryToLpaRange(salary: string): [number, number] | null {
  const nums = (salary.match(/[\d,]+(?:\.\d+)?/g) ?? [])
    .map((n) => parseFloat(n.replace(/,/g, "")))
    .filter((n) => !isNaN(n));
  if (nums.length === 0) return null;
  const s = salary.toLowerCase();
  const annualMarkers = /(lpa|lakh|per annum|per year|\/yr|\/year|annual|p\.?\s*a\.?)/;
  const monthlyMarkers = /(per month|\/month|monthly|p\.?\s*m\.?|stipend)/;
  // Shared rupee->LPA conversion: raw figures >1000 are rupees, small
  // numbers are already LPA (e.g. "6-8", "4.5").
  const toAnnualLpa = (v: number) => (v > 1000 ? v / 100000 : v);
  let min: number;
  let max: number;
  if (annualMarkers.test(s)) {
    // Annual figure: raw rupees (>1000) need /100000; small numbers are LPA already.
    min = toAnnualLpa(nums[0]);
    max = toAnnualLpa(nums.length > 1 ? nums[nums.length - 1] : nums[0]);
  } else if (monthlyMarkers.test(s)) {
    // Monthly INR only when an explicit month indicator is present:
    // annualize, then convert to LPA. A bare figure (even <₹5L) is an
    // annual amount - inferring monthly from magnitude misclassified
    // annual ₹ figures below ₹5,00,000 (P-M8).
    min = (nums[0] * 12) / 100000;
    max = ((nums.length > 1 ? nums[nums.length - 1] : nums[0]) * 12) / 100000;
  } else {
    // Unmarked figure: assume annual in the stated currency.
    min = toAnnualLpa(nums[0]);
    max = toAnnualLpa(nums.length > 1 ? nums[nums.length - 1] : nums[0]);
  }
  return [Math.min(min, max), Math.max(min, max)];
}

/** The board's own salary line for a card, or null when it states none. */
export function formatUnstopSalary(jobDetail?: UnstopRawOpportunity["jobDetail"]): string | null {
  if (!jobDetail) return null;
  const min = jobDetail.min_salary;
  const max = jobDetail.max_salary;
  const currencySymbol = jobDetail.currency === "fa-rupee" ? "₹" : jobDetail.currency || "";

  if (min && max) {
    if (min === max) {
      return `${currencySymbol} ${min.toLocaleString("en-IN")}`;
    }
    return `${currencySymbol} ${min.toLocaleString("en-IN")} - ${max.toLocaleString("en-IN")}`;
  }
  if (min) return `${currencySymbol} ${min.toLocaleString("en-IN")}`;
  if (max) return `${currencySymbol} ${max.toLocaleString("en-IN")}`;
  return null;
}

/**
 * The board's date, as YYYY-MM-DD.
 *
 * Unstop's listing carries no publication field - only `updated_at` (when the
 * listing last changed) and `end_date` (the application deadline, which is not
 * a posting date). `updated_at` is therefore what the posting's date is, and
 * an edit-bump can refresh it. Inventing a date would be worse (P-M16).
 *
 * The calendar day is the UTC one, because that is what the board's own
 * listing shows.
 */
export function unstopDate(updatedAt?: string): string | null {
  if (!updatedAt) return null;
  const d = new Date(updatedAt);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

/** The posting's place, or null when the board states none. */
export function unstopLocation(item: UnstopRawOpportunity): string | null {
  if (item.jobDetail?.locations && item.jobDetail.locations.length > 0) {
    return item.jobDetail.locations.join(", ");
  }
  if (item.locations && item.locations.length > 0) {
    const locNames = item.locations.map((l) => l.city || l.state || l.country).filter(Boolean);
    return locNames.length > 0 ? locNames.join(", ") : null;
  }
  return null;
}

/**
 * The posting's canonical URL.
 *
 * `public_url` is a PATH on this board ("jobs/some-slug-1813094"), so it has
 * to be joined with the board's host. The retired engine adapter used it raw,
 * and put a relative path into the pool. An absolute URL is left alone: the
 * board states one for some postings.
 */
export function unstopUrl(item: UnstopRawOpportunity): string {
  const id = String(item.id);
  const raw = item.public_url?.trim();
  if (raw && /^https?:\/\//i.test(raw)) return raw;
  const path = raw ? raw.replace(/^\/+/, "") : `jobs/${id}`;
  return `${UNSTOP_BASE_URL}/${path}`;
}

/**
 * Map one opportunity to the SDK's neutral shape.
 *
 * A row with no id is not referenceable, and is dropped: the old CLI turned
 * it into the id "undefined", which would have put `unstop:undefined` in the
 * pool.
 *
 * The title is the board's own string, verbatim - trailing spaces and all.
 * The board sends "Digital Officer " and the CLI has always shown exactly
 * that; trimming it here would change what a reader sees. A row the board
 * did not title carries an empty title, and each surface applies its own
 * rule to it: the CLI has always called such a row "Untitled", and the
 * engine has always dropped it.
 */
export function parseUnstopOpportunity(item: UnstopRawOpportunity): UnstopRow | null {
  if (!item || item.id === undefined || item.id === null || item.id === "") return null;
  return {
    id: String(item.id),
    title: asText(item.title),
    company: asText(item.organisation?.name) || null,
    location: unstopLocation(item),
    date: unstopDate(item.updated_at),
    url: unstopUrl(item),
    salary: formatUnstopSalary(item.jobDetail),
    type: item.type || item.subtype || "job",
    employmentType: item.jobDetail?.timing ?? null,
    workplaceType: item.jobDetail?.type ?? null,
    deadline: item.end_date ? item.end_date.split("T")[0] : null,
    updatedAt: item.updated_at ?? null,
    skills: (item.required_skills ?? [])
      .map((s) => s.skill_name || s.skill)
      .filter((s): s is string => Boolean(s)),
    eligibility: (item.filters ?? [])
      .filter((f) => f.type === "eligible")
      .map((f) => f.name)
      .filter((n): n is string => Boolean(n)),
  };
}

/** Map one opportunity to the SDK's neutral shape, in full. */
export function parseUnstopDetail(item: UnstopRawOpportunity): UnstopDetailRow | null {
  const row = parseUnstopOpportunity(item);
  if (!row) return null;
  return {
    ...row,
    description: item.details ? stripUnstopHtml(item.details) : null,
  };
}

/**
 * The numeric id a reference carries.
 *
 * Unstop slugs end with the opportunity id, so the last numeric segment is
 * the id. Preferring the LAST one matters: the first can grab digits from an
 * earlier path segment (".../team-111/finale-222" is 222, not 111) (P-M14).
 */
export function extractUnstopId(input: string): string {
  const trimmed = input.trim();
  const matches = [...trimmed.matchAll(/(\d+)(?:[/?#]|$)/g)];
  if (matches.length > 0) {
    return matches[matches.length - 1][1];
  }
  return trimmed;
}

/**
 * The board's query parameters.
 *
 * `opportunity` picks the listing, `page` picks the page, and `searchTerm`
 * is the board's own text search. The CLI sends the query and the location
 * together as one term, because that is how it has always searched, and the
 * location is then refined client-side on top.
 *
 * The page is sent only when the caller named one: the CLI's search always
 * does, and its lookup by id never did - the board's first page is the
 * default either way.
 */
export function buildUnstopQuery(req: SearchRequest): URLSearchParams {
  const p = new URLSearchParams();
  const listing = req.extra?.opportunity === "internships" ? "internships" : "jobs";
  p.set("opportunity", listing);
  if (req.page !== undefined) p.set("page", String(Math.max(1, req.page)));

  const terms: string[] = [];
  if (req.query) terms.push(req.query);
  if (req.location) terms.push(req.location);
  if (terms.length > 0) p.set("searchTerm", terms.join(" "));
  return p;
}

/** The board's page, as the board sent it. */
export interface UnstopEnvelope {
  data?: {
    data?: UnstopRawOpportunity[];
    total?: number;
    current_page?: number;
    per_page?: number;
  };
}

/**
 * Apply the client-side filters, in the order the CLI has always applied them.
 *
 * The board narrows by text; the location, salary and age filters are the
 * board's own extra fields, so they are applied here, on top.
 */
export function filterUnstop(rows: UnstopRow[], req: SearchRequest, now: Date): UnstopRow[] {
  let out = rows;

  // Optional client-side location refinement if requested. A filter that
  // matches nothing yields nothing: falling back to the unfiltered board
  // misrepresents the answer as "these are the roles in your city".
  if (req.location) {
    const locNorm = req.location.toLowerCase().trim();
    out = out.filter((c) => c.location && c.location.toLowerCase().includes(locNorm));
  }

  // Client-side salary filtering - both sides in LPA (see salaryToLpaRange:
  // cards mix monthly INR and annual figures; raw comparison never filtered).
  const salarySpec = unstopSalarySpec(req);
  if (salarySpec) {
    const [minLpa, maxLpa] = salarySpec;
    out = out.filter((card) => {
      if (!card.salary) return true; // Keep if no salary info
      const range = salaryToLpaRange(card.salary);
      if (!range) return true;
      // Overlap test: keep the card when the ranges intersect.
      return (
        (isNaN(minLpa) || range[1] >= minLpa) && (isNaN(maxLpa) || range[0] <= maxLpa)
      );
    });
  }

  // Client-side jobage filtering.
  if (req.jobAgeDays !== undefined) {
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - req.jobAgeDays);
    out = out.filter((card) => {
      if (!card.date) return true; // Keep if no date info
      const t = new Date(card.date).getTime(); // new Date() never throws - check isNaN
      if (Number.isNaN(t)) return true;
      return t >= cutoffDate.getTime();
    });
  }

  return out;
}

/**
 * The salary range a request asks for, in LPA.
 *
 * `extra.salary_lpa` is the board's own flag value: "6-10", or "6" for a
 * single figure. `salaryMin` is the common contract's minimum, and is
 * honoured when the board-specific range is absent.
 */
function unstopSalarySpec(req: SearchRequest): [number, number] | null {
  const raw = req.extra?.salary_lpa;
  if (typeof raw === "string" && raw.trim()) {
    const [min, max] = raw.split("-").map(parseFloat);
    return [isNaN(min) ? NaN : min, isNaN(max) ? NaN : max];
  }
  if (typeof req.salaryMin === "number") return [req.salaryMin, NaN];
  return null;
}

export interface UnstopOptions {
  /**
   * The fetch to use. Defaults to the global fetch.
   *
   * Every provider is CONSTRUCTED with its dependencies rather than
   * hard-wiring the network, so a test can bind a fixture and never reach
   * the real board. The exported singleton below is the production one.
   */
  fetchImpl?: typeof fetch;
  /**
   * The clock, so a test can pin the age filter.
   *
   * The age filter is the one part of a search whose result depends on
   * today, and a fixture that depends on today stops proving anything next
   * week.
   */
  now?: () => Date;
}

/** Fetch one page of the board's listing. */
async function fetchUnstopPage(
  req: SearchRequest,
  options: UnstopOptions,
): Promise<{ rows: UnstopRawOpportunity[]; total: number; perPage: number }> {
  const query = buildUnstopQuery(req).toString();
  const url = `${UNSTOP_BASE_URL}${UNSTOP_SEARCH_PATH}?${query}`;

  let res;
  try {
    res = await providerFetch(url, {
      headers: { Accept: "application/json" },
      // The CLI's own budget: a hung portal must never hang /scrape.
      attempts: 3,
      timeoutMs: 15000,
      fetchImpl: options.fetchImpl,
    });
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError("network", e instanceof Error ? e.message : String(e), { cause: e });
  }

  if (!res.ok) {
    throw new ProviderError("http", `Unstop search API responded with status ${res.status}`, {
      retryable: res.status === 429 || (res.status >= 500 && res.status <= 599),
    });
  }

  let payload: UnstopEnvelope | null;
  try {
    payload = (await res.json()) as UnstopEnvelope;
  } catch (e) {
    throw new ProviderError("parse", "the Unstop search API did not answer with JSON", { cause: e });
  }
  if (!payload || typeof payload !== "object" || !payload.data || !Array.isArray(payload.data.data)) {
    // The listing did not have the shape it is documented to have. That is a
    // parse failure, not an empty board.
    throw new ProviderError("parse", "the Unstop listing did not carry a data array");
  }
  return {
    rows: payload.data.data,
    total: payload.data.total ?? payload.data.data.length,
    perPage: payload.data.per_page ?? payload.data.data.length,
  };
}

/** A provider bound to a specific fetch. */
export function createUnstopProvider(options: UnstopOptions = {}): Provider<UnstopRow> {
  const now = options.now ?? (() => new Date());

  return {
    id: "unstop",
    version: "1.0.0",
    kind: "aggregator",
    displayName: "Unstop",
    seedUrls: [`${UNSTOP_BASE_URL}${UNSTOP_SEARCH_PATH}`],

    async search(req: SearchRequest): Promise<SearchPage<UnstopRow>> {
      const page = await fetchUnstopPage(req, options);
      const cards = page.rows
        .map((item) => parseUnstopOpportunity(item))
        .filter((c): c is UnstopRow => c !== null);
      const filtered = filterUnstop(cards, req, now());

      // The limit is a cap on what the caller receives, and it is applied
      // last - after every filter - so a filter can never be defeated by a
      // short page.
      const limit = req.limit;
      const rows = limit === undefined || limit === 0 ? filtered : filtered.slice(0, limit);

      const pageNumber = Math.max(1, req.page ?? 1);
      // The board's own total counts the rows that matched its TEXT search; it
      // does not know about the client-side filters above. Reporting it is
      // still the honest answer: it is what the board holds.
      const total = page.total;
      const start = (pageNumber - 1) * page.perPage;
      return {
        rows,
        total,
        page: pageNumber,
        truncated: total > start + rows.length,
      };
    },

    async detail(ref: string): Promise<PostingDetail<UnstopDetailRow>> {
      const id = extractUnstopId(ref);
      const search = async (listing: UnstopListing) => {
        const page = await fetchUnstopPage(
          { query: id, extra: { opportunity: listing } },
          options,
        );
        const exact = page.rows.find((d) => String(d.id) === id);
        return exact ? parseUnstopDetail(exact) : null;
      };

      // The board's two listings are searched in turn, and only the EXACT
      // requested id is ever returned. A search miss is NOT_FOUND - never the
      // first unrelated result.
      const found = (await search("jobs")) ?? (await search("internships"));
      if (!found) {
        throw new ProviderError("not-found", `Opportunity not found for ID or URL: "${ref}"`);
      }
      return found;
    },
  };
}

/** The production provider. A test binds its own with `createUnstopProvider`. */
export const unstopProvider: Provider<UnstopRow> = createUnstopProvider();

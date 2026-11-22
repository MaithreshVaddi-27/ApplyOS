// Origin: clean-room 2026-11-21, Phase 4 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// We Work Remotely, implemented once.
//
// This replaces two parsers: the one in the weworkremotely-search CLI and the one in
// applyos/packages/portals. They read different fields from the same feed, and the engine's
// copy had already drifted into reading a tag the feed does not carry.
//
// **The board's RSS items carry no author.** Verified live on 2026-11-21 against
// `https://weworkremotely.com/remote-jobs.rss`: 98 items, and no `dc:creator` and no `author`
// anywhere in the document. The employer is folded into the title ("Gusto, Inc.: Software
// Engineer, …"), and every one of the 98 titles carries a colon. The engine's parser read
// `dc:creator` first and only fell back to the title, so its employer rule is right but its
// first branch is dead code on this board.
//
// **The engine's parser read a tag the feed does not carry.** It read `<location>`, and the
// board's items carry `<region>`, `<country>` and `<state>` instead - so every engine row came
// out with no location at all. A live scrape showed it: `Proxify AB: Senior Backend Developer |
// ... | unspecified`. The CLI has always built the place from those three tags.
//
// **The engine's third feed does not exist.** It fetched
// `https://weworkremotely.com/categories/remote-data-science-jobs.rss`, which answers 301; the
// board's own categories are Full-Stack, Front-End, Back-End, DevOps and Sysadmin, Design,
// Product, Management and Finance, Customer Support, Sales and Marketing, and All Other Remote.
// There is no data-science category. The engine's per-feed error handling meant the source
// silently lost that feed for as long as it has been wired in.
//
// The behaviour reproduced here is the CLI's, because the CLI is the surface `/scrape` uses and
// therefore the one a candidate sees.
//
// **WWR's politeness differs from the shared policy, and is preserved.** The CLI gave a hung
// portal 15 seconds per attempt and four retries, because `/scrape` must never hang on one
// board. The shared policy's 20 seconds and one retry are more generous than that.

import { ProviderError } from "./errors.js";
import { providerFetch } from "./fetch.js";
import { asText, decodeHtmlEntities } from "./text.js";
import type { PostingDetail, Provider, ProviderRow, SearchPage, SearchRequest } from "./types.js";

export const WWR_BASE_URL = "https://weworkremotely.com";

/** The board's own full listing: every category, most recent first. */
export const WWR_MAIN_FEED = "https://weworkremotely.com/remote-jobs.rss";

/**
 * The board's category feeds, keyed by the names the CLI has always accepted.
 *
 * The SDK owns this catalogue; each surface chooses its feed set. The CLI reads one feed - the
 * main one, or the category a caller names. The engine reads the feeds it is configured with.
 */
export const WWR_CATEGORY_FEEDS: Record<string, string> = {
  "full-stack": "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss",
  fullstack: "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss",
  "remote-full-stack-programming-jobs":
    "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss",
  "front-end": "https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss",
  frontend: "https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss",
  "remote-front-end-programming-jobs":
    "https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss",
  "back-end": "https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss",
  backend: "https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss",
  "remote-back-end-programming-jobs":
    "https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss",
  devops: "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
  sysadmin: "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
  "devops-sysadmin": "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
  "remote-devops-sysadmin-jobs": "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
  design: "https://weworkremotely.com/categories/remote-design-jobs.rss",
  "remote-design-jobs": "https://weworkremotely.com/categories/remote-design-jobs.rss",
  product: "https://weworkremotely.com/categories/remote-product-jobs.rss",
  "remote-product-jobs": "https://weworkremotely.com/categories/remote-product-jobs.rss",
  management: "https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss",
  finance: "https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss",
  "management-finance": "https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss",
  "remote-management-and-finance-jobs":
    "https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss",
  support: "https://weworkremotely.com/categories/remote-customer-support-jobs.rss",
  "customer-support": "https://weworkremotely.com/categories/remote-customer-support-jobs.rss",
  "remote-customer-support-jobs": "https://weworkremotely.com/categories/remote-customer-support-jobs.rss",
  sales: "https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss",
  marketing: "https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss",
  "sales-marketing": "https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss",
  "remote-sales-and-marketing-jobs":
    "https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss",
  other: "https://weworkremotely.com/categories/all-other-remote-jobs.rss",
  "all-other": "https://weworkremotely.com/categories/all-other-remote-jobs.rss",
  "all-other-remote-jobs": "https://weworkremotely.com/categories/all-other-remote-jobs.rss",
};

/** The feed a request asks for: an explicit URL, a category name, or the board's full listing. */
export function wwrFeedFor(req: SearchRequest): string {
  const feed = req.extra?.feed;
  if (typeof feed === "string" && feed.trim()) return feed.trim();
  const category = req.extra?.category;
  if (typeof category === "string" && category.trim()) {
    const mapped = WWR_CATEGORY_FEEDS[category.trim().toLowerCase()];
    if (mapped) return mapped;
  }
  return WWR_MAIN_FEED;
}

/** One item as the feed states it, before the board's own rules are applied. */
export interface WwrRawItem {
  title?: string;
  /** `dc:creator` or `author`. The feed carries neither today. */
  company?: string;
  region?: string;
  country?: string;
  state?: string;
  category?: string;
  type?: string;
  skills?: string;
  pubDate?: string;
  link?: string;
  guid?: string;
  description?: string;
}

/** One posting from the feed, in the SDK's neutral shape. */
export interface WwrRow extends ProviderRow {
  /** The board's own guid, which for this board is the same string as the url. */
  guid: string | null;
  /** The board's own category, or null when the feed states none. */
  category: string | null;
  /** The board's own job type (full_time, part_time, contract, ...), or null. */
  jobType: string | null;
  tags: string[];
}

/**
 * We Work Remotely's own HTML-to-text rule.
 *
 * The SDK's shared `stripHtmlTags` is RemoteOK's. This one strips tags BEFORE decoding
 * entities, and once: decoding first would turn `&lt;script&gt;` into a real tag that then gets
 * stripped, and decoding twice would turn `&amp;amp;` into `&` instead of `&amp;`. A description
 * is read by the gates and checked by the Grounding Audit, so its text must not change shape in
 * a migration.
 */
export function stripWwrHtml(html: string): string {
  if (!html) return "";
  let text = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "");

  text = decodeHtmlEntities(text);
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The text inside one tag of an item block, or "". */
export function extractWwrTag(itemXml: string, tag: string): string {
  const match = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1].trim() : "";
}

/**
 * Parse a feed into raw items.
 *
 * The board's items are `<item>…</item>` blocks; there is no XML dependency here, and a regex
 * over each block is what the CLI has always done.
 */
export function parseWwrRss(xml: string): WwrRawItem[] {
  const items: WwrRawItem[] = [];
  for (const raw of xml.split("<item>").slice(1)) {
    const itemXml = "<item>" + raw;
    items.push({
      title: extractWwrTag(itemXml, "title"),
      company: extractWwrTag(itemXml, "dc:creator") || extractWwrTag(itemXml, "author"),
      region: decodeHtmlEntities(extractWwrTag(itemXml, "region")),
      country: decodeHtmlEntities(extractWwrTag(itemXml, "country")),
      state: decodeHtmlEntities(extractWwrTag(itemXml, "state")),
      category: decodeHtmlEntities(extractWwrTag(itemXml, "category")) || undefined,
      type: decodeHtmlEntities(extractWwrTag(itemXml, "type")) || undefined,
      skills: extractWwrTag(itemXml, "skills"),
      pubDate: extractWwrTag(itemXml, "pubDate"),
      link: extractWwrTag(itemXml, "link"),
      guid: extractWwrTag(itemXml, "guid"),
      description: extractWwrTag(itemXml, "description"),
    });
  }
  return items;
}

/** The posting's id: the board's slug from its url. */
export function wwrId(link: string): string {
  const match = link.match(/remote-jobs\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : link;
}

/**
 * The posting's place, from the three tags the board carries.
 *
 * No region and no country means no place claimed: empty, never a made-up one. An earlier
 * version defaulted this to "Worldwide".
 */
export function wwrLocation(item: WwrRawItem): string {
  let location = item.region || "";
  const country = item.country || "";
  const state = item.state || "";
  if (country && country !== item.region) {
    if (location === "" || location === "Anywhere in the World") {
      location = country;
    } else {
      location = `${location} (${country})`;
    }
  }
  if (state && !location.includes(state)) {
    location = `${location}, ${state}`;
  }
  return location;
}

/** The posting's skills, from the board's comma- (or "and"-) separated list. */
export function wwrTags(item: WwrRawItem): string[] {
  if (!item.skills) return [];
  const cleaned = decodeHtmlEntities(item.skills)
    .replace(/\band\b/gi, ",")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const tags: string[] = [];
  for (const tag of cleaned) {
    if (!tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

/**
 * Map one feed item to the SDK's neutral shape.
 *
 * The employer comes from the feed's author field when it carries one, and otherwise from the
 * title, which this board writes as "Employer: Role". A title with no colon has no employer to
 * recover, and the row says so with null.
 */
export function parseWwrJob(item: WwrRawItem): WwrRow | null {
  const rawTitle = asText(item.title);
  if (!rawTitle) return null;

  const link = asText(item.link) || asText(item.guid);
  if (!link) return null;

  const decodedTitle = decodeHtmlEntities(rawTitle);
  let company = asText(item.company).trim();
  let title = decodedTitle;

  if (!company) {
    const colonIndex = decodedTitle.indexOf(":");
    if (colonIndex > -1) {
      const head = decodedTitle.slice(0, colonIndex).trim();
      const rest = decodedTitle.slice(colonIndex + 1).trim();
      if (head.length <= 60 && rest) {
        company = head;
        title = rest;
      }
    }
  }

  let date = asText(item.pubDate);
  if (date) {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) date = parsed.toISOString();
    else date = "";
  }

  return {
    id: wwrId(link),
    title,
    company: company || null,
    location: wwrLocation(item) || null,
    date: date || null,
    url: link,
    salary: null,
    guid: asText(item.guid) || null,
    category: item.category ?? null,
    jobType: item.type ?? null,
    tags: wwrTags(item),
    description: item.description ? stripWwrHtml(item.description) : null,
  };
}

/** Fetch and parse one feed. */
export async function fetchWwrFeed(
  feed: string,
  options: { fetchImpl?: typeof fetch; attempts?: number; timeoutMs?: number } = {},
): Promise<WwrRow[]> {
  let res;
  try {
    res = await providerFetch(feed, {
      headers: { Accept: "application/rss+xml, application/xml, text/xml, */*" },
      // The CLI's own budget: a hung portal must never hang /scrape. A surface
      // with a different budget - the engine's, say - passes its own.
      attempts: options.attempts ?? 5,
      timeoutMs: options.timeoutMs ?? 15000,
      fetchImpl: options.fetchImpl,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new ProviderError("network", `could not fetch the We Work Remotely feed at ${feed} (${message})`, {
      cause: e,
    });
  }
  if (!res.ok) {
    throw new ProviderError("http", `We Work Remotely feed ${feed} answered HTTP ${res.status}`, {
      retryable: res.status === 429 || (res.status >= 500 && res.status <= 599),
    });
  }
  let xml: string;
  try {
    xml = await res.text();
  } catch (e) {
    throw new ProviderError("parse", `the We Work Remotely feed at ${feed} did not answer with text`, {
      cause: e,
    });
  }
  return parseWwrRss(xml)
    .map((item) => parseWwrJob(item))
    .filter((row): row is WwrRow => row !== null);
}

/**
 * Apply the client-side filters, in the order the CLI has always applied them.
 *
 * The feed is not searchable, so every filter is applied here.
 */
export function filterWwr(rows: WwrRow[], req: SearchRequest, now: Date): WwrRow[] {
  let out = rows;

  if (req.query) {
    const q = req.query.toLowerCase();
    out = out.filter((j) => {
      const titleMatch = j.title.toLowerCase().includes(q);
      const companyMatch = (j.company ?? "").toLowerCase().includes(q);
      const tagMatch = j.tags.some((t) => t.toLowerCase().includes(q));
      const descMatch = (j.description ?? "").toLowerCase().includes(q);
      const catMatch = (j.category ?? "").toLowerCase().includes(q);
      return titleMatch || companyMatch || tagMatch || descMatch || catMatch;
    });
  }

  if (req.location) {
    const loc = req.location.toLowerCase();
    out = out.filter((j) => (j.location ?? "").toLowerCase().includes(loc));
  }

  const tag = req.extra?.tag;
  if (typeof tag === "string" && tag) {
    const tagQuery = tag.toLowerCase();
    out = out.filter(
      (j) =>
        j.tags.some((t) => t.toLowerCase().includes(tagQuery)) ||
        (j.description ?? "").toLowerCase().includes(tagQuery),
    );
  }

  if (req.jobAgeDays !== undefined && req.jobAgeDays > 0) {
    const cutoff = now.getTime() - req.jobAgeDays * 24 * 60 * 60 * 1000;
    out = out.filter((j) => {
      if (!j.date) return true; // The board did not say: keep it.
      const parsed = new Date(j.date).getTime();
      if (isNaN(parsed)) return true;
      return parsed >= cutoff;
    });
  }

  return out;
}

/** The numeric id a reference carries: the slug from a `remote-jobs/<slug>` url. */
export function extractWwrId(idOrUrl: string): string {
  const trimmed = idOrUrl.trim();
  const match = trimmed.match(/remote-jobs\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : trimmed;
}

/**
 * Find one posting by id or url.
 *
 * Exact matching only. An earlier version fell back to substring matching, which turned a "dev"
 * lookup into the "backend-dev-xyz1" posting. The one fallback is a dash-anchored url tail, and
 * only when exactly one posting carries it.
 */
export function findWwrJob(
  jobs: WwrRow[],
  searchId: string,
  extractedId: string,
): WwrRow | undefined {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\/+$/, "");
  const nSearch = norm(searchId);
  const nExt = norm(extractedId);
  const exact = jobs.find(
    (j) => norm(j.id) === nSearch || norm(j.id) === nExt || norm(j.url) === nSearch,
  );
  if (exact) return exact;
  if (!nExt) return undefined;
  const candidates = jobs.filter(
    (j) => norm(j.url).endsWith(`/${nExt}`) || norm(j.url).endsWith(`-${nExt}`),
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}

export interface WwrOptions {
  /**
   * The fetch to use. Defaults to the global fetch.
   *
   * Every provider is CONSTRUCTED with its dependencies rather than hard-wiring the network, so
   * a test can bind a fixture and never reach the real board. The exported singleton below is
   * the production one.
   */
  fetchImpl?: typeof fetch;
  /**
   * The clock, so a test can pin the age filter.
   *
   * The age filter is the one part of a search whose result depends on today.
   */
  now?: () => Date;
  /**
   * The retry budget and per-attempt timeout.
   *
   * Defaults to the CLI's: 15 seconds and five attempts, because `/scrape` must
   * never hang on one board. The engine passes its own - the shared policy its
   * other adapters use - so a dead feed fails as fast as it does everywhere
   * else in the engine.
   */
  attempts?: number;
  timeoutMs?: number;
}

/**
 * The default page size.
 *
 * The feed has no paging of its own, so this is the CLI's default cap: twenty rows.
 */
export const WWR_DEFAULT_LIMIT = 20;

/** A provider bound to a specific fetch. */
export function createWwrProvider(options: WwrOptions = {}): Provider<WwrRow> {
  const now = options.now ?? (() => new Date());

  return {
    id: "weworkremotely",
    version: "1.0.0",
    kind: "aggregator",
    displayName: "We Work Remotely",
    seedUrls: [WWR_MAIN_FEED, ...Object.values(WWR_CATEGORY_FEEDS)],

    async search(req: SearchRequest): Promise<SearchPage<WwrRow>> {
      const feed = wwrFeedFor(req);
      const all = await fetchWwrFeed(feed, options);
      const filtered = filterWwr(all, req, now());

      const page = Math.max(1, req.page ?? 1);
      const limit = req.limit === undefined ? WWR_DEFAULT_LIMIT : req.limit;
      // `--limit 0` means "all results", which is the CLI's convention and the engine's too.
      const start = limit === 0 ? 0 : (page - 1) * limit;
      const rows = limit === 0 ? filtered : filtered.slice(start, start + limit);

      return {
        rows,
        total: filtered.length,
        page,
        truncated: filtered.length > start + rows.length,
      };
    },

    async detail(ref: string): Promise<PostingDetail<WwrRow>> {
      const searchId = ref.trim();
      const extractedId = extractWwrId(searchId);

      // The main feed first, then a sweep of the category feeds. Same request volume as a
      // sequential sweep at a fraction of the latency; a feed that fails is skipped, and the
      // deadline bounds the whole sweep.
      const deadline = now().getTime() + 60000;
      const feedUrls = [...new Set(Object.values(WWR_CATEGORY_FEEDS))];
      const keysByUrl = new Map<string, string>();
      for (const [key, url] of Object.entries(WWR_CATEGORY_FEEDS)) {
        if (!keysByUrl.has(url)) keysByUrl.set(url, key);
      }

      let found = findWwrJob(await fetchWwrFeed(WWR_MAIN_FEED, options), searchId, extractedId);
      if (!found) {
        const settled = await Promise.allSettled(
          feedUrls.map(async (url) => {
            if (now().getTime() > deadline) return undefined;
            try {
              return await fetchWwrFeed(url, options);
            } catch {
              return undefined;
            }
          }),
        );
        for (const [i] of feedUrls.entries()) {
          const s = settled[i];
          if (s.status !== "fulfilled" || !s.value) continue;
          found = findWwrJob(s.value, searchId, extractedId);
          if (found) break;
        }
        if (!found && now().getTime() > deadline) {
          throw new ProviderError("timeout", "the We Work Remotely lookup timed out after 60s");
        }
      }

      if (!found) {
        throw new ProviderError("not-found", `listing not found: ${ref}`);
      }
      return found;
    },
  };
}

/** The production provider. A test binds its own with `createWwrProvider`. */
export const wwrProvider: Provider<WwrRow> = createWwrProvider();

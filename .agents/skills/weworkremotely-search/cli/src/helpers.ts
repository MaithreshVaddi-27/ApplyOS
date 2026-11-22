// The weworkremotely CLI is a thin surface over the provider SDK.
//
// The board is implemented ONCE, in
// applyos/packages/provider/src/weworkremotely.ts: the feed catalogue, the
// item parser, the place builder, the tag splitter, the filters and the
// lookup. This file re-exports the pieces the CLI's commands and its own
// tests need, so a change to how We Work Remotely is read lands in both
// surfaces at the same time.
//
// The SDK lives in the engine's workspace rather than beside the CLI skills,
// because the engine is the convergence target and has to be installable on
// its own. The import is therefore a relative path rather than a sibling one
// - five levels up, which is ugly but explicit.
//
// The names the CLI has always exported are kept, so the CLI's own suite
// still tests the same things through the same surface.
export {
  WWR_BASE_URL as BASE_URL,
  WWR_MAIN_FEED as MAIN_RSS,
  WWR_CATEGORY_FEEDS as CATEGORY_MAP,
  wwrProvider,
  createWwrProvider,
  extractWwrId,
  fetchWwrFeed,
  filterWwr,
  findWwrJob,
  parseWwrJob,
  parseWwrRss,
  stripWwrHtml as stripHtmlTags,
  wwrFeedFor,
  wwrId,
  wwrLocation,
  wwrTags,
  type WwrRawItem,
  type WwrRow,
} from "../../../../../applyos/packages/provider/src/weworkremotely.js";

export { decodeHtmlEntities } from "../../../../../applyos/packages/provider/src/text.js";
export { writeError } from "../../../cli-shared/src/errors.js";

import {
  WWR_MAIN_FEED,
  WWR_CATEGORY_FEEDS,
  fetchWwrFeed as fetchFeed,
  type WwrRow,
} from "../../../../../applyos/packages/provider/src/weworkremotely.js";

/**
 * One posting, in the shape the portal-skill contract's search result uses.
 *
 * This is the CLI's own card, which is what it has always emitted: the place
 * and the employer are strings here (empty and "Unknown" when the board states
 * none), and the category, job type and body are absent rather than null.
 */
export interface WWRJob {
  id: string
  title: string
  company: string
  location: string
  date: string
  url: string
  salary: string | null
  category?: string
  jobType?: string
  tags: string[]
  description?: string
}

/** One board row, in the CLI's card shape. */
export function toJob(r: WwrRow): WWRJob {
  return {
    id: r.id,
    title: r.title,
    company: r.company ?? "Unknown",
    location: r.location ?? "",
    date: r.date ?? "",
    url: r.url,
    salary: r.salary ?? null,
    category: r.category ?? undefined,
    jobType: r.jobType ?? undefined,
    tags: r.tags,
    description: r.description ?? undefined,
  };
}

/**
 * Fetch one feed: the board's full listing, or the category a caller names.
 *
 * An unknown category falls back to the main feed, which is what the CLI has
 * always done.
 */
export async function fetchWWRFeed(category?: string): Promise<WWRJob[]> {
  let url = WWR_MAIN_FEED;
  if (category) {
    url = WWR_CATEGORY_FEEDS[category.toLowerCase().trim()] ?? url;
  }
  const rows = await fetchFeed(url);
  return rows.map(toJob);
}

// The unstop CLI is a thin surface over the provider SDK.
//
// The board is implemented ONCE, in applyos/packages/provider/src/unstop.ts:
// which endpoint to ask, how to parse a listing, how to read a salary, how to
// filter, how to find a posting by id. This file re-exports the pieces the
// CLI's commands and its own tests need, so a change to how Unstop is read
// lands in both surfaces at the same time.
//
// The SDK lives in the engine's workspace rather than beside the CLI skills,
// because the engine is the convergence target and has to be installable on
// its own. The import is therefore a relative path rather than a sibling one
// - five levels up, which is ugly but explicit.
//
// The names the CLI has always exported are kept, so the CLI's own suite
// still tests the same things through the same surface.
export {
  UNSTOP_BASE_URL,
  UNSTOP_SEARCH_PATH,
  unstopProvider,
  createUnstopProvider,
  buildUnstopQuery,
  extractUnstopId,
  formatUnstopSalary,
  parseUnstopOpportunity,
  parseUnstopDetail,
  salaryToLpaRange,
  stripUnstopHtml,
  unstopDate,
  unstopLocation,
  unstopUrl,
  type UnstopRawOpportunity,
  type UnstopRow,
  type UnstopDetailRow,
  type UnstopListing,
  type UnstopOpportunityType,
} from "../../../../../applyos/packages/provider/src/unstop.js";

export { decodeHtmlEntities } from "../../../../../applyos/packages/provider/src/text.js";

export { writeError } from "../../../cli-shared/src/errors.js";

import {
  parseUnstopOpportunity,
  parseUnstopDetail,
  type UnstopRawOpportunity,
  type UnstopRow,
  type UnstopDetailRow,
} from "../../../../../applyos/packages/provider/src/unstop.js";

/** The board's own listing endpoint. */
export const API_URL = "https://unstop.com/api/public/opportunity/search-result";

/** A Unstop opportunity - the fields this skill reads (the wire shape carries more). */
export type UnstopOpportunityItem = UnstopRawOpportunity;

/**
 * One opportunity, in the shape the portal-skill contract's search result uses.
 *
 * The board's parsing is the SDK's; this is the name the CLI has always
 * exposed. A row with no id is not referenceable and the SDK drops it - the
 * old CLI turned it into the id "undefined", which would have put
 * `unstop:undefined` in the pool.
 *
 * The title is the board's own string, which is empty when the board stated
 * no title; the CLI's search output calls such a row "Untitled".
 */
export function parseOpportunityCard(item: UnstopOpportunityItem): UnstopRow {
  const row = parseUnstopOpportunity(item);
  if (!row) {
    throw new Error(`not an opportunity: no id in ${JSON.stringify(item)}`);
  }
  return row;
}

/** One opportunity, in full: the card plus the body and the eligibility list. */
export function parseOpportunityDetail(item: UnstopOpportunityItem): UnstopDetailRow {
  const row = parseUnstopDetail(item);
  if (!row) {
    throw new Error(`not an opportunity: no id in ${JSON.stringify(item)}`);
  }
  return row;
}

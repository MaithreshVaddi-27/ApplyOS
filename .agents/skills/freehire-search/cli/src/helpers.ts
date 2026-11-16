// The freehire CLI is a thin surface over the provider SDK.
//
// The board is implemented ONCE, in applyos/packages/provider/src/freehire.ts.
// This file re-exports the pieces the CLI's commands and tests need, so that a
// change to how freehire is parsed lands in both surfaces at the same time.
//
// The SDK lives in the engine's workspace rather than beside the CLI skills,
// because the engine is the convergence target and has to be installable on
// its own. The import is therefore a relative path rather than a sibling one
// - five levels up, which is ugly but explicit.
//
// The names the CLI has always exported are kept, so the CLI's own suite
// still tests the same things through the same surface.
export {
  FREEHIRE_DEFAULT_BASE_URL,
  FREEHIRE_SEARCH_PATH,
  FREEHIRE_DETAIL_PATH,
  freehireProvider,
  createFreehireProvider,
  freehireBaseUrl,
  buildFreehireQuery,
  formatFreehireSalary,
  normalizeFreehireSlug,
  toFreehireRow,
  toFreehireDetail,
  type FreehireEnvelope,
  type FreehireRawJob,
  type FreehireRow,
  type FreehireDetailRow,
  type FreehireDescriptionFormat,
} from "../../../../../applyos/packages/provider/src/freehire.js";

import {
  freehireGet,
  freehireBaseUrl as sdkBaseUrl,
  cleanFreehireHtml,
  normalizeFreehireSlug,
  toFreehireRow,
  toFreehireDetail,
  type FreehireEnvelope,
  type FreehireRawJob,
} from "../../../../../applyos/packages/provider/src/freehire.js";

export { writeError } from "../../../cli-shared/src/errors.js";

/**
 * GET a JSON envelope from the freehire API.
 *
 * Kept under the name the CLI has always used. Retries 429/5xx (transient
 * server states) with backoff; returns `null` on a 404. A connection failure
 * fails fast with a clear message — no retry, so an outage degrades this
 * source quickly rather than hanging the caller.
 */
export async function apiGet<T>(path: string): Promise<FreehireEnvelope<T> | null> {
  return freehireGet<T>(path, { env: process.env });
}

/** The API base URL: FREEHIRE_API_URL (for a self-hosted instance) or the default. */
export function baseUrl(): string {
  return sdkBaseUrl(process.env);
}

/** A freehire job - the fields this skill reads (the wire shape carries more). */
export type FreehireJob = FreehireRawJob;

/** Strip a freehire description's HTML into readable prose: null for empty input. */
export const cleanHtml = cleanFreehireHtml;

/** Extract a freehire public slug from a bare slug or a /jobs/<slug> URL. */
export const normalizeSlug = normalizeFreehireSlug;

/** Reshape a freehire job into the contract's search-result fields. */
export const toResult = toFreehireRow;

/** Reshape a freehire job into the detail result (cleaned description + enrichment). */
export const toDetail = toFreehireDetail;

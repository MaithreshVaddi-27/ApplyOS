// The remotive CLI is a thin surface over the provider SDK.
//
// The board is implemented ONCE, in applyos/packages/provider/src/remotive.ts.
// This file re-exports the pieces the CLI's commands need, so that a change to
// how Remotive is parsed lands in both surfaces at the same time.
//
// The SDK lives in the engine's workspace rather than beside the CLI skills,
// because the engine is the convergence target and has to be installable on
// its own. The import is therefore a relative path rather than a sibling one
// - five levels up, which is ugly but explicit.
export {
  REMOTIVE_BASE_URL as BASE_URL,
  REMOTIVE_API_URL as API_URL,
  remotiveProvider,
  createRemotiveProvider,
  fetchRemotiveJobs,
  mapRemotive,
  filterRemotive,
  matchRemotiveJob,
  extractRemotiveId,
  stripRemotiveHtml,
  type RemotiveRow,
  type RemotiveRawJob,
} from "../../../../../applyos/packages/provider/src/remotive.js";

export {
  decodeHtmlEntities,
  stripHtmlTags,
} from "../../../../../applyos/packages/provider/src/text.js";

export { writeError } from "../../../cli-shared/src/errors.js";

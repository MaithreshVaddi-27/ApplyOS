// The remoteok CLI is a thin surface over the provider SDK.
//
// The board is implemented ONCE, in applyos/packages/provider/src/remoteok.ts.
// This file re-exports the pieces the CLI's commands need, so that a change to
// how RemoteOK is parsed lands in both surfaces at the same time.
//
// The SDK lives in the engine's workspace rather than beside the CLI skills,
// because the engine is the convergence target and has to be installable on
// its own. The import is therefore a relative path rather than a sibling one
// - five levels up, which is ugly but explicit.

export {
  REMOTEOK_BASE_URL as BASE_URL,
  REMOTEOK_API_URL as API_URL,
  remoteOkProvider,
  createRemoteOkProvider,
  fetchRemoteOkJobs,
  mapRemoteOk,
  matchRemoteOkJob,
  extractRemoteOkId,
  buildRemoteOkDetailUrl,
  parseRemoteOkJsonLd,
  type RemoteOkJob,
} from "../../../../../applyos/packages/provider/src/remoteok.js";

export {
  isProviderError,
  ProviderError,
} from "../../../../../applyos/packages/provider/src/errors.js";

export {
  formatSalary,
  stripHtmlTags,
  decodeHtmlEntities,
} from "../../../../../applyos/packages/provider/src/text.js";

export { writeError } from "../../../cli-shared/src/errors.js";

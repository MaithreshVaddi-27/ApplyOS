// The arbeitnow CLI is a thin surface over the provider SDK.
//
// The board is implemented ONCE, in
// applyos/packages/provider/src/arbeitnow.ts: the endpoint, the envelope,
// the date format, the place, the remote flag, the filters and the lookup.
// This file re-exports the pieces the CLI's commands and its own tests need,
// so a change to how Arbeitnow is read lands in both surfaces at the same
// time.
//
// The SDK lives in the engine's workspace rather than beside the CLI skills,
// because the engine is the convergence target and has to be installable on
// its own. The import is therefore a relative path rather than a sibling one
// - five levels up, which is ugly but explicit.
//
// The names the CLI has always exported are kept, so its suite still tests
// the same things through the same surface.
export {
  ARBEITNOW_API_URL,
  arbeitnowProvider,
  createArbeitnowProvider,
  arbeitnowDate,
  arbeitnowLocation,
  arbeitnowDescription,
  extractArbeitnowSlug,
  filterArbeitnow,
  parseArbeitnowJob,
  type ArbeitnowRawJob,
  type ArbeitnowRow,
} from "../../../../../applyos/packages/provider/src/arbeitnow.js";

export { writeError } from "../../../cli-shared/src/errors.js";

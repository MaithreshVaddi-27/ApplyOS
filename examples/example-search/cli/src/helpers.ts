// A worked example: one tiny provider CLI over the shared SDK.
//
// This is a TEACHING example, not a new board: it re-implements Arbeitnow's
// public feed so a contributor can copy the shape and change the endpoint. The
// SDK owns the board (applyos/packages/provider/src/arbeitnow.ts); this folder
// is only the CLI surface. Copy it to `.agents/skills/<your-board>-search`,
// swap the helpers' import for your board's module, and follow
// docs/developer/adding-a-portal.md.
export {
  ARBEITNOW_API_URL as API_URL,
  arbeitnowProvider,
  createArbeitnowProvider,
  parseArbeitnowJob as mapJob,
  filterArbeitnow as filterJobs,
  arbeitnowLocation as locationOf,
  arbeitnowDescription as descriptionOf,
  arbeitnowDate as toIsoDate,
  extractArbeitnowSlug as extractId,
  type ArbeitnowRawJob as RawJob,
  type ArbeitnowRow as Row,
} from "../../../../applyos/packages/provider/src/arbeitnow.js";

export {
  isProviderError,
  ProviderError,
} from "../../../../applyos/packages/provider/src/errors.js";

export {
  decodeHtmlEntities,
  stripHtmlTags,
} from "../../../../applyos/packages/provider/src/text.js";

export { writeError } from "../../../../.agents/skills/cli-shared/src/errors.js";

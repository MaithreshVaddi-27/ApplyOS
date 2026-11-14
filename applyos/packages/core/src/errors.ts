// Origin: clean-room 2026-11-13, Phase 3 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// The error vocabulary.
//
// Two layers emit errors and they use different conventions:
//
//   the engine        — kebab-case:  "missing-arg", "batch-file", "profile-invalid"
//   the provider CLIs — SCREAMING_CASE: "INVALID_FORMAT", "PARSE_ERROR", "BAD_ID"
//
// Both conventions are preserved exactly. The codes are already on the wire
// and something may be consuming them; renaming one is a breaking change, and
// a broken consumer is worse than an inconsistent vocabulary.
//
// What this module adds is the part that was missing: a single registry that
// says what every code MEANS, which layer emits it, and whether a retry could
// plausibly succeed. A consumer that meets an unknown code can look it up.
//
//   - a code's exact spelling never changes;
//   - a code's meaning never changes;
//   - a new code is added here before it is emitted anywhere.

/** Which boundary emits a code. */
export type ErrorLayer = "engine" | "provider";

export interface ErrorCodeSpec {
  /** The exact string emitted on the wire. Never change it. */
  readonly code: string;
  readonly layer: ErrorLayer;
  /** What the code means. */
  readonly meaning: string;
  /**
   * Whether a retry could plausibly succeed. A rate limit is retryable; a
   * missing argument is not, and retrying it wastes the candidate's time.
   */
  readonly retryable: boolean;
  /**
   * True when the portal-skill contract (ADR-0006) requires this code but no
   * provider currently emits it. Reserved, so that a provider which needs it
   * has a documented spelling to use.
   */
  readonly reserved?: boolean;
}

const ENGINE_CODES: ErrorCodeSpec[] = [
  { code: "missing-arg", layer: "engine", meaning: "A flag was given without the value it needs.", retryable: false },
  { code: "unknown-command", layer: "engine", meaning: "The command is not one this CLI knows.", retryable: false },
  { code: "bad-stage", layer: "engine", meaning: "--stage is not a known candidate stage.", retryable: false },
  { code: "bad-type", layer: "engine", meaning: "--type is not jobs, internships, or all.", retryable: false },
  { code: "batch-file", layer: "engine", meaning: "The batch file is missing, unreadable, or has an entry with no ref.", retryable: false },
  { code: "profile-not-found", layer: "engine", meaning: "The --profile path does not exist.", retryable: false },
  { code: "profile-invalid", layer: "engine", meaning: "The profile is not valid JSON, or does not have the required shape.", retryable: false },
  { code: "apply-failed", layer: "engine", meaning: "The apply flow could not complete.", retryable: false },
  { code: "detail-failed", layer: "engine", meaning: "A posting's detail could not be fetched.", retryable: true },
  { code: "unsupported-board", layer: "engine", meaning: "The posting's board has no detail connector.", retryable: false },
];

const PROVIDER_CODES: ErrorCodeSpec[] = [
  { code: "INVALID_ARG", layer: "provider", meaning: "An argument has an unusable value.", retryable: false },
  { code: "INVALID_FORMAT", layer: "provider", meaning: "--format is not json, table, or plain.", retryable: false },
  { code: "INVALID_JOBAGE", layer: "provider", meaning: "--jobage is not a positive whole number of days.", retryable: false },
  { code: "INVALID_LIMIT", layer: "provider", meaning: "--limit is not a usable count.", retryable: false },
  { code: "INVALID_PAGE", layer: "provider", meaning: "--page is not a positive page number.", retryable: false },
  { code: "INVALID_STAGE", layer: "provider", meaning: "--stage is not a known candidate stage.", retryable: false },
  { code: "INVALID_TYPE", layer: "provider", meaning: "--type is not a known posting type.", retryable: false },
  { code: "INVALID_BOARD", layer: "provider", meaning: "The requested board is not one this CLI serves.", retryable: false },
  { code: "UNKNOWN_FLAG", layer: "provider", meaning: "An unrecognised flag was passed.", retryable: false },
  { code: "MISSING_ARG", layer: "provider", meaning: "A required argument was not supplied.", retryable: false },
  { code: "UNKNOWN_COMMAND", layer: "provider", meaning: "The subcommand is not one this CLI knows.", retryable: false },
  { code: "BAD_ID", layer: "provider", meaning: "The posting id is malformed.", retryable: false },
  { code: "NO_ID", layer: "provider", meaning: "A posting id was required and none was given.", retryable: false },
  { code: "NOT_FOUND", layer: "provider", meaning: "The posting does not exist at the source.", retryable: false },
  { code: "FETCH_ERROR", layer: "provider", meaning: "The request could not be completed.", retryable: true },
  { code: "API_ERROR", layer: "provider", meaning: "The board's API returned an error.", retryable: true },
  { code: "PARSE_ERROR", layer: "provider", meaning: "The response did not have the shape the parser expects.", retryable: false },
  { code: "PARSE_EMPTY", layer: "provider", meaning: "The response parsed to nothing - the page shell carried no postings.", retryable: false },
  { code: "PARSE_FAILED", layer: "provider", meaning: "The detail page could not be parsed into a posting.", retryable: false },
  { code: "DETAIL_FAILED", layer: "provider", meaning: "The detail could not be assembled.", retryable: true },
  { code: "SEARCH_FAILED", layer: "provider", meaning: "The search could not be completed.", retryable: true },
  { code: "FATAL", layer: "provider", meaning: "The CLI stopped for an unexpected reason.", retryable: false },
  {
    code: "MISSING_CREDENTIALS",
    layer: "provider",
    meaning: "A required credential environment variable is absent.",
    retryable: false,
    reserved: true,
  },
];

/** Every code this repository can emit, in one place. */
export const ERROR_CODES: readonly ErrorCodeSpec[] = [...ENGINE_CODES, ...PROVIDER_CODES];

const BY_CODE = new Map(ERROR_CODES.map((spec) => [spec.code, spec]));

/** Look up a code's spec, or undefined if it is not registered. */
export function errorSpec(code: string): ErrorCodeSpec | undefined {
  return BY_CODE.get(code);
}

/** Whether a code is registered. */
export function isKnownCode(code: string): boolean {
  return BY_CODE.has(code);
}

/**
 * The cross-layer form of a code: kebab-case, lowercased.
 *
 * "INVALID_FORMAT" and "invalid-format" normalise to the same string, so the
 * two conventions can be compared without either being renamed.
 */
export function normaliseCode(code: string): string {
  return code.replace(/_/g, "-").toLowerCase();
}

/** Whether a retry could plausibly succeed for this code. */
export function isRetryable(code: string): boolean {
  return BY_CODE.get(code)?.retryable ?? false;
}

/** The codes the engine itself may emit. */
export const ENGINE_ERROR_CODES: readonly string[] = ENGINE_CODES.map((c) => c.code);

/** The codes a provider CLI may emit. */
export const PROVIDER_ERROR_CODES: readonly string[] = PROVIDER_CODES.map((c) => c.code);

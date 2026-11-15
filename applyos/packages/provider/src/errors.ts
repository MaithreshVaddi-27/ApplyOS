// Origin: clean-room 2026-11-13, Phase 4 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// The provider's error type.
//
// A provider throws this for a fatal condition. It returns a page with zero
// rows for a legitimate empty result, and the difference matters: "this board
// has no postings" and "this board is down" are different facts, and a caller
// that cannot tell them apart will report a failure as an empty search.
//
// The codes are the shared vocabulary's provider codes, so a provider's
// failure and the engine's failure are described in the same terms.

export type ProviderErrorCode =
  | "network"
  | "timeout"
  | "http"
  | "rate-limited"
  | "robots-disallowed"
  | "parse"
  | "not-found"
  | "credentials"
  | "unsupported";

/** The code a provider CLI emits for each provider failure. */
const CLI_CODE: Record<ProviderErrorCode, string> = {
  network: "FETCH_ERROR",
  timeout: "FETCH_ERROR",
  http: "FETCH_ERROR",
  "rate-limited": "FETCH_ERROR",
  "robots-disallowed": "FETCH_ERROR",
  parse: "PARSE_ERROR",
  "not-found": "NOT_FOUND",
  credentials: "MISSING_CREDENTIALS",
  unsupported: "INVALID_BOARD",
};

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  /** Whether a retry could plausibly succeed. */
  readonly retryable: boolean;
  /** The code a provider CLI emits for this failure. */
  readonly cliCode: string;
  readonly cause?: unknown;

  constructor(
    code: ProviderErrorCode,
    message: string,
    options: { retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.retryable = options.retryable ?? DEFAULT_RETRYABLE.has(code);
    this.cliCode = CLI_CODE[code];
    this.cause = options.cause;
  }
}

const DEFAULT_RETRYABLE = new Set<ProviderErrorCode>([
  "network",
  "timeout",
  "http",
  "rate-limited",
]);

/** Whether a value is a ProviderError. */
export function isProviderError(e: unknown): e is ProviderError {
  return e instanceof ProviderError;
}

/**
 * Wrap anything thrown into a ProviderError, so a caller never has to
 * interpret a raw Error. A ProviderError passes through unchanged.
 */
export function asProviderError(e: unknown, fallback: ProviderErrorCode = "network"): ProviderError {
  if (isProviderError(e)) return e;
  const message = e instanceof Error ? e.message : String(e);
  return new ProviderError(fallback, message, { cause: e });
}

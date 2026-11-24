// Origin: clean-room 2026-11-13, Phase 4 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// The shared fetch policy.
//
// Every provider fetches the same way: one timeout, a bounded number of
// attempts, exponential backoff with jitter, and an honest User-Agent.
//
// These values are the engine's outbound policy, copied from
// `applyos/packages/core/src/fetch.ts` (DEFAULT_TIMEOUT_MS, retries: 1,
// UA). The SDK cannot import the core - it has zero runtime dependencies, and
// it is consumed from outside the engine workspace by the provider CLIs - so
// the numbers are mirrored here rather than imported. `docs/design/provider-sdk.md`
// §5 states this policy; a test asserts the two stay in step.
//
// The UA matters. The 2026-10-09 audit recorded a "Chrome-UA convention" as
// a REGRESSION, not an improvement: a CLI sending `*-cli/1.0` identifies
// itself honestly, and impersonating a browser to slip past a block is both
// dishonest and the kind of behaviour that gets a user banned.
//
// RemoteOK's public API answers an honest UA with HTTP 200 (verified
// 2026-11-13), so nothing needs to be faked.

export const PROVIDER_UA = "applyos/0.1 (personal use)";

/** One attempt's budget. A hung portal must never hang a search. */
export const PROVIDER_TIMEOUT_MS = 20_000;

/** The total attempts, including the first. The core's policy is one retry. */
export const PROVIDER_ATTEMPTS = 2;

/** The base backoff, doubled each attempt, plus jitter. */
export const PROVIDER_BACKOFF_MS = 500;

export interface FetchOptions {
  /** Extra headers, merged over the defaults. */
  readonly headers?: Record<string, string>;
  /** The HTTP method. Defaults to GET; a few ATS boards need POST. */
  readonly method?: string;
  /** The request body, for a board that needs one. */
  readonly body?: string;
  /** The attempt budget. Defaults to PROVIDER_ATTEMPTS. */
  readonly attempts?: number;
  /** The per-attempt timeout. Defaults to PROVIDER_TIMEOUT_MS. */
  readonly timeoutMs?: number;
  /**
   * Whether a network failure is retried. Defaults to true.
   *
   * A board that wants an outage to degrade the source quickly rather than
   * hold the caller sets this to false: the connection is refused now, and
   * waiting to find out that it will be refused again is slower, not safer.
   */
  readonly retryOnNetworkFailure?: boolean;
  /** The backoff doubles each attempt up to this ceiling. Defaults to no cap. */
  readonly backoffCapMs?: number;
  /** Called between attempts, so a test can avoid real waiting. */
  readonly onRetry?: (attempt: number, delayMs: number) => void;
  /** The injected sleep, so a test can avoid real waiting. */
  readonly sleep?: (ms: number) => Promise<void>;
  /** The fetch implementation, so a test can inject a response. */
  readonly fetchImpl?: typeof fetch;
}

export interface ProviderResponse {
  readonly status: number;
  readonly ok: boolean;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Fetch a URL with the shared provider policy.
 *
 * Retries only on a network failure, a timeout, a 429, or a 5xx. A 4xx is
 * the caller's mistake or the board's answer, and retrying it just wastes the
 * candidate's time.
 */
export async function providerFetch(url: string, options: FetchOptions = {}): Promise<ProviderResponse> {
  const attempts = options.attempts ?? PROVIDER_ATTEMPTS;
  const timeoutMs = options.timeoutMs ?? PROVIDER_TIMEOUT_MS;
  const sleep = options.sleep ?? defaultSleep;
  const doFetch = options.fetchImpl ?? fetch;
  const retryOnNetworkFailure = options.retryOnNetworkFailure ?? true;
  const backoffCapMs = options.backoffCapMs ?? Number.POSITIVE_INFINITY;

  const backoff = (attempt: number): number =>
    Math.min(PROVIDER_BACKOFF_MS * 2 ** attempt, backoffCapMs);

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await doFetch(url, {
        method: options.method ?? "GET",
        body: options.body,
        headers: {
          "User-Agent": PROVIDER_UA,
          Accept: "application/json, text/html, */*",
          ...options.headers,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
        lastError = new Error(`HTTP ${res.status} for ${url}`);
        if (attempt < attempts - 1) {
          const delay = backoff(attempt) + Math.random() * 200;
          options.onRetry?.(attempt, delay);
          await sleep(delay);
          continue;
        }
      }
      return res as unknown as ProviderResponse;
    } catch (e) {
      lastError = e;
      if (retryOnNetworkFailure && attempt < attempts - 1) {
        const delay = backoff(attempt);
        options.onRetry?.(attempt, delay);
        await sleep(delay);
      } else {
        throw lastError instanceof Error ? lastError : new Error(String(lastError));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Fetch and parse JSON, with the shared policy. */
export async function providerJson(url: string, options: FetchOptions = {}): Promise<unknown> {
  const res = await providerFetch(url, options);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  try {
    return await res.json();
  } catch (e) {
    throw new Error(`the response from ${url} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
}

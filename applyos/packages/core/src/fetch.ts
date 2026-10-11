// Origin: clean-room 2026-10-07, derived from polite-crawl practice. Author: OpenCode agent.
export const DEFAULT_TIMEOUT_MS = 20_000;
export const DEFAULT_PACING_MS = 300;

/** Canonical User-Agent for all outbound traffic (personal-use identification). */
export const UA = "applyos/0.1 (personal use)";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** GET/POST JSON with a timeout and exactly one retry. Errors are data, never throws for HTTP status. */
export async function fetchJson(
  url: string,
  opts: {
    timeoutMs?: number;
    init?: RequestInit;
    retries?: number;
  } = {},
): Promise<{ json: unknown; attempts: number }> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = opts.retries ?? 1;
  let attempts = 0;
  let lastError = "unknown fetch error";
  for (let i = 0; i <= retries; i++) {
    attempts++;
    const attemptStart = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...opts.init, signal: ctrl.signal });
      if (!res.ok) {
        clearTimeout(timer);
        lastError = `HTTP ${res.status} for ${url}`;
        continue;
      }
      // Body parse races the remaining budget: some runtimes do not abort an
      // in-flight body read, so the signal alone cannot bound a stalled
      // transfer — the explicit race can.
      const budget = Math.max(1, timeoutMs - (Date.now() - attemptStart));
      let bodyTimer: ReturnType<typeof setTimeout> | undefined;
      const bodyTimeout = new Promise<never>((_, reject) => {
        bodyTimer = setTimeout(() => {
          try {
            void res.body?.cancel()?.catch(() => {});
          } catch {
            /* ignore cleanup failures */
          }
          reject(new Error(`body timeout for ${url}`));
        }, budget);
      });
      try {
        const json = (await Promise.race([res.json(), bodyTimeout])) as unknown;
        clearTimeout(bodyTimer);
        clearTimeout(timer);
        return { json, attempts };
      } catch (e) {
        clearTimeout(bodyTimer);
        clearTimeout(timer);
        lastError = e instanceof Error ? e.message : String(e);
      }
    } catch (e) {
      clearTimeout(timer);
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(lastError);
}

/** GET text (RSS/HTML) with a timeout and exactly one retry. Throws when every attempt fails. */
export async function fetchText(
  url: string,
  opts: {
    timeoutMs?: number;
    init?: RequestInit;
    retries?: number;
  } = {},
): Promise<{ text: string; attempts: number }> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = opts.retries ?? 1;
  let attempts = 0;
  let lastError = "unknown fetch error";
  for (let i = 0; i <= retries; i++) {
    attempts++;
    const attemptStart = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...opts.init,
        headers: { "User-Agent": UA, ...opts.init?.headers },
        signal: ctrl.signal,
      });
      if (!res.ok) {
        clearTimeout(timer);
        lastError = `HTTP ${res.status} for ${url}`;
        continue;
      }
      // Body parse races the remaining budget (see fetchJson).
      const budget = Math.max(1, timeoutMs - (Date.now() - attemptStart));
      let bodyTimer: ReturnType<typeof setTimeout> | undefined;
      const bodyTimeout = new Promise<never>((_, reject) => {
        bodyTimer = setTimeout(() => {
          try {
            void res.body?.cancel()?.catch(() => {});
          } catch {
            /* ignore cleanup failures */
          }
          reject(new Error(`body timeout for ${url}`));
        }, budget);
      });
      try {
        const text = await Promise.race([res.text(), bodyTimeout]);
        clearTimeout(bodyTimer);
        clearTimeout(timer);
        return { text, attempts };
      } catch (e) {
        clearTimeout(bodyTimer);
        clearTimeout(timer);
        lastError = e instanceof Error ? `${e.message} for ${url}` : `${String(e)} for ${url}`;
      }
    } catch (e) {
      clearTimeout(timer);
      lastError = e instanceof Error ? `${e.message} for ${url}` : `${String(e)} for ${url}`;
    }
  }
  throw new Error(lastError);
}
/** Enforce ≥ `pacingMs` between successive host calls. Returns actual waited ms. */
export async function pace(lastCallAt: number, pacingMs: number = DEFAULT_PACING_MS): Promise<number> {
  const wait = Math.max(0, pacingMs - (Date.now() - lastCallAt));
  if (wait > 0) await sleep(wait);
  return wait;
}

/** Clamp a caller limit to a sane range. 0 means "no cap" and passes through. */
export function clampLimit(limit: number | undefined, fallback: number, max: number): number {
  if (limit === 0) return 0;
  if (limit === undefined || Number.isNaN(limit)) return fallback;
  return Math.min(Math.max(1, Math.floor(limit)), max);
}

/**
 * Parse a CLI numeric flag through clampLimit: missing/NaN → fallback,
 * 0 passes through ("no cap"), negatives clamp to 1, capped at max.
 */
export function parseNumArg(raw: string | undefined, fallback: number, max: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return clampLimit(Number.isNaN(n) ? undefined : n, fallback, max);
}

export function ageInDays(postedDate: string | null, now = new Date()): number | null {
  if (!postedDate) return null;
  const t = Date.parse(postedDate);
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / 86_400_000);
}

/** True when the row is older than maxAgeDays (or undated when `flagUndated` is set). Never drops the row itself. */
export function isStale(postedDate: string | null, maxAgeDays: number, now = new Date(), flagUndated = true): boolean {
  const age = ageInDays(postedDate, now);
  if (age === null) return flagUndated;
  return age > maxAgeDays;
}

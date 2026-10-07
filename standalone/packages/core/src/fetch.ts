// Origin: clean-room 2026-10-07, derived from polite-crawl practice. Author: OpenCode agent.
import type { SearchOptions } from "./types";

export const DEFAULT_TIMEOUT_MS = 20_000;
export const DEFAULT_PACING_MS = 300;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface FetchOutcome {
  res: Response | null;
  attempts: number;
  error?: string;
}

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
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...opts.init, signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) {
        lastError = `HTTP ${res.status} for ${url}`;
        continue;
      }
      return { json: (await res.json()) as unknown, attempts };
    } catch (e) {
      clearTimeout(timer);
      lastError = e instanceof Error ? e.message : String(e);
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

export function queryOf(opts: SearchOptions): string {
  return (opts.query ?? "").trim().toLowerCase();
}

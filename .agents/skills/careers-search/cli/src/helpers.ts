// Shared helpers for the careers-search CLI: fetching with timeout + retry,
// HTML stripping, client-side filters, and the shared table/plain formatters.
// Zero runtime dependencies — Bun globals only.

import type { NormalizedJob } from "./types.js"

export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

/** Fetch JSON with a bounded timeout and one retry on transient failures. */
export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 20000,
  retries = 1,
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: {
          accept: "application/json, text/plain, */*",
          "user-agent": USER_AGENT,
          ...(init.headers ?? {}),
        },
        signal: AbortSignal.timeout(timeoutMs),
        ...init,
      })
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status}`)
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      return (await res.json()) as T
    } catch (err) {
      lastErr = err
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 750 * (attempt + 1)))
      }
    }
  }
  throw new Error(lastErr instanceof Error ? lastErr.message : "fetch failed")
}

/** Fetch HTML text with the same bounded behavior. */
export async function fetchText(
  url: string,
  init: RequestInit = {},
  timeoutMs = 20000,
  retries = 1,
): Promise<string> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": USER_AGENT,
          "accept-language": "en-US,en;q=0.9",
          ...(init.headers ?? {}),
        },
        signal: AbortSignal.timeout(timeoutMs),
        ...init,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (err) {
      lastErr = err
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 750 * (attempt + 1)))
      }
    }
  }
  throw new Error(lastErr instanceof Error ? lastErr.message : "fetch failed")
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x3D;/g, "=")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
}

/** Convert HTML to readable plain text (no dependencies). */
export function stripHtmlTags(html: string): string {
  if (!html) return ""
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, "\n\n$1\n")
    .replace(/<[^>]+>/g, "")
  text = decodeHtmlEntities(text)
  return text
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** ISO date (YYYY-MM-DD) from anything date-like, or null. Never invents. */
export function toIsoDate(value: unknown): string | null {
  if (!value) return null
  if (typeof value === "number") {
    const ms = value > 1e12 ? value : value * 1000
    const d = new Date(ms)
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  }
  const s = String(value).trim()
  if (!s) return null
  // Already ISO-like: 2026-09-30, 2026-09-30T12:00:00Z, 2026/09/30
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const m2 = s.match(/^(\d{4})\/(\d{2})\/(\d{2})/)
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`
  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return null
}

/** Normalize whitespace for display. */
export function clean(text: unknown): string {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Case-insensitive substring match used by the shared filters. */
export function matches(text: string, needle: string): boolean {
  return text.toLowerCase().includes(needle.toLowerCase())
}

/** True when the posting is an internship / trainee / apprentice role. */
export function isInternship(j: NormalizedJob): boolean {
  const target = [j.title, j.description ?? ""].join(" ").toLowerCase()
  return /\b(intern|internship|co-op|coop|trainee|apprentice|fellowship|fellow)\b/.test(target)
}

/** True when the posting location reads as remote / work-from-home. */
export function isRemote(j: NormalizedJob): boolean {
  return /remote|work from home|wfh|anywhere|distributed|india-remote/i.test(j.location)
}

/** Apply the shared client-side filters every board supports. */
export function applyClientFilters(
  jobs: NormalizedJob[],
  opts: { query?: string; location?: string; jobage?: number; type?: string; stage?: string },
): NormalizedJob[] {
  let out = jobs
  // Stage defaults (only when the caller did not set an explicit filter):
  // student => internships only; remote-global => remote-only rows.
  const type = opts.type ?? (opts.stage === "student" ? "internships" : undefined)
  if (type === "internships") {
    out = out.filter((j) => isInternship(j))
  } else if (type === "jobs") {
    out = out.filter((j) => !isInternship(j))
  }
  if (opts.query) {
    const words = opts.query.toLowerCase().trim().split(/\s+/)
    out = out.filter((j) => {
      const target = [j.title, j.company, j.location, j.description ?? ""].join(" ").toLowerCase()
      return words.every((w) => target.includes(w))
    })
  }
  if (opts.location) {
    const loc = opts.location.toLowerCase().trim()
    if (!["remote", "any", "all"].includes(loc)) {
      out = out.filter((j) => matches(j.location, loc))
    }
  } else if (opts.stage === "remote-global") {
    // Remote-global stage without an explicit location: keep remote rows only.
    out = out.filter((j) => isRemote(j))
  }
  if (opts.jobage && opts.jobage > 0) {
    const cutoff = Date.now() - opts.jobage * 24 * 60 * 60 * 1000
    out = out.filter((j) => {
      if (!j.date) return true
      const t = new Date(j.date).getTime()
      if (isNaN(t)) return true
      return t >= cutoff
    })
  }
  return out
}

/** Shared table renderer. */
export function renderTable(rows: NormalizedJob[]): void {
  if (rows.length === 0) {
    process.stdout.write("No matching jobs found.\n")
    return
  }
  const pad = (s: string, w: number) => {
    const cl = s.replace(/\s+/g, " ")
    if (cl.length > w) return cl.slice(0, w - 1) + "…"
    return cl.padEnd(w)
  }
  const colId = 12
  const colTitle = 34
  const colComp = 22
  const colLoc = 20
  const colBoard = 14
  const header = `${pad("ID", colId)} ${pad("TITLE", colTitle)} ${pad("COMPANY", colComp)} ${pad("LOCATION", colLoc)} ${pad("BOARD", colBoard)}`
  process.stdout.write(header + "\n" + "-".repeat(header.length) + "\n")
  for (const r of rows) {
    process.stdout.write(
      `${pad(r.id, colId)} ${pad(r.title, colTitle)} ${pad(r.company, colComp)} ${pad(r.location, colLoc)} ${pad(r.board, colBoard)}\n`,
    )
  }
}

/** Shared plain renderer. */
export function renderPlain(rows: NormalizedJob[]): void {
  for (const r of rows) {
    process.stdout.write(`ID: ${r.id}\n`)
    process.stdout.write(`Title: ${r.title}\n`)
    process.stdout.write(`Company: ${r.company}\n`)
    process.stdout.write(`Location: ${r.location}\n`)
    if (r.date) process.stdout.write(`Date: ${r.date}\n`)
    process.stdout.write(`URL: ${r.url}\n`)
    if (r.description) {
      const snippet = r.description.replace(/\s+/g, " ").slice(0, 200)
      process.stdout.write(`Description: ${snippet}${r.description.length > 200 ? "…" : ""}\n`)
    }
    process.stdout.write("\n")
  }
}

/** Bounded pause between sequential fetches (politeness pacing). */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export function dedupeByUrl(jobs: NormalizedJob[]): NormalizedJob[] {
  const seen = new Set<string>()
  return jobs.filter((j) => {
    const key = j.url.replace(/#.*$/, "")
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

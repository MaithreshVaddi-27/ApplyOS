// Origin: clean-room 2026-10-07, own output design for CLI+agent use. Author: OpenCode agent.
import type { SearchMeta, JobPosting } from "./types";

export function stripHtml(html: string): string {
  // Decode entities FIRST: some boards (Greenhouse) ship HTML-escaped markup
  // (`&lt;div&gt;`); stripping tags before decoding would leave the tags intact.
  // `&amp;` goes first so double-encoded entities (`&amp;nbsp;`) resolve in one pass.
  return html
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function toJsonPayload(results: JobPosting[], meta: SearchMeta): string {
  return JSON.stringify({ results, meta }, null, 2);
}

/**
 * Coerce unknown payload text to string: strings pass through, finite
 * numbers stringify, everything else (null/undefined/objects) falls back.
 * Replaces `as string` casts on untyped connector payloads.
 */
export function asText(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return fallback;
}

/** Slice an ISO datetime to its YYYY-MM-DD date, else null (never invented). */
export function isoDateOnly(raw: string): string | null {
  const date = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

/** One table cell: pipes would split columns, newlines would split rows. */
function cell(v: string): string {
  return v.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
}

export function toTable(results: JobPosting[]): string {
  const head = "TITLE | COMPANY | LOCATION | DATE | URL";
  const lines = results.map((r) => [r.title, r.company, r.location ?? "unspecified", r.postedDate ?? "undated", r.url].map(cell).join(" | "));
  return [head, ...lines].join("\n");
}

export function toPlain(results: JobPosting[]): string {
  return results.map((r) => `${r.title} — ${r.company} (${r.location ?? "unspecified"}, ${r.postedDate ?? "undated"})\n${r.url}`).join("\n\n");
}

/** Status lines mirroring the run contract: skips, fallbacks, per-source health. */
export function statusLines(meta: SearchMeta, skipped: string[] = [], fallback: string[] = []): string[] {
  const lines: string[] = [];
  if (skipped.length) lines.push(`skipped: ${skipped.join(", ")}`);
  if (fallback.length) lines.push(`fallback: ${fallback.join(", ")}`);
  for (const n of meta.notes.filter((x) => !x.ok)) {
    lines.push(`health: ${n.portal} — error: ${n.error ?? "unknown"}${n.truncated ? " (truncated)" : ""}`);
  }
  return lines;
}

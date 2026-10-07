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

export function toTable(results: JobPosting[]): string {
  const head = "TITLE | COMPANY | LOCATION | DATE | URL";
  const lines = results.map((r) => [r.title, r.company, r.location, r.postedDate ?? "undated", r.url].join(" | "));
  return [head, ...lines].join("\n");
}

export function toPlain(results: JobPosting[]): string {
  return results.map((r) => `${r.title} — ${r.company} (${r.location}, ${r.postedDate ?? "undated"})\n${r.url}`).join("\n\n");
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

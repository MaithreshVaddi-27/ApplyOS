// Origin: clean-room 2026-11-13, Phase 4 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// Text helpers for provider implementations.
//
// A board's description arrives as HTML. Turning it into text is part of
// parsing the board, so it belongs here rather than in each surface.
//
// The entity decoder is the same union set cli-shared uses (linkedin's set
// plus careers' `&#x2F;`/`&#x3D;`), with fromCodePoint and a range guard:
// supplementary-plane code points decode correctly, and out-of-range values
// are dropped rather than throwing or turning into mojibake.
//
// cli-shared keeps its own copy until every CLI has migrated onto this SDK.
// That duplication is deliberate and temporary - the SDK has to be
// self-contained inside the engine workspace - and it goes away with the
// last migration.

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
}

/**
 * Coerce a payload field to text.
 *
 * A board may send a number where a string belongs. `777` is a real company
 * name that arrived as a number, and casting it is honest; `{}` is not, and it
 * becomes the fallback instead.
 */
export function asText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

/**
 * The engine's ATS body rule.
 *
 * Decode entities FIRST, because boards such as Greenhouse ship escaped markup
 * (`&lt;div&gt;`) that a strip-first rule would leave intact. Then drop tags
 * and collapse whitespace to single spaces. This is the rule the engine's
 * `stripHtml` has always used for ATS bodies; the aggregators keep their own
 * newline-preserving rules, so this is separate from `stripHtmlTags`.
 */
export function stripAtsHtml(html: string): string {
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
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ");
}

/**
 * Strip HTML into readable text.
 *
 * Block elements become newlines so a description keeps its shape; inline
 * elements become nothing. This is the shape the remoteok CLI has always
 * produced, kept exactly so the migration changes nothing a reader can see.
 */
export function stripHtmlTags(html: string): string {
  if (!html) return "";
  let text = html
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, "\n\n$1\n")
    .replace(/<[^>]+>/g, "");
  text = decodeHtmlEntities(text);
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Format a salary range for display.
 *
 * NOTE: RemoteOK's feed is not consistent about scale - one captured row
 * carried `salary_min: 21` and another `salary_min: 114000000` for
 * ordinary postings. This formatter treats the raw number as dollars,
 * which is what the remoteok CLI has always done, so the migration is
 * behaviour-preserving. The scale itself is a separate defect and is
 * deliberately NOT fixed here: a wrong number is better left visible and
 * documented than silently rescaled by a migration.
 */
export function formatSalary(min?: number, max?: number): string | undefined {
  if (!min && !max) return undefined;
  if (min && max && min === max) {
    return `$${min.toLocaleString()} / year`;
  }
  if (min && max) {
    return `$${min.toLocaleString()} - $${max.toLocaleString()} / year`;
  }
  if (min) {
    return `From $${min.toLocaleString()} / year`;
  }
  if (max) {
    return `Up to $${max.toLocaleString()} / year`;
  }
  return undefined;
}

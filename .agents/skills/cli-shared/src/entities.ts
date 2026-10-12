// Shared HTML entity decoding for the *-search portal CLIs: the union of the
// per-CLI copies (linkedin's set plus careers' &#x2F;/&#x3D;). Numeric
// references use fromCodePoint with a range guard (linkedin's version):
// supplementary-plane code points decode correctly, out-of-range values are
// dropped instead of throwing (fromCodePoint) or mojibake (fromCharCode).
//
// Tag stripping is deliberately NOT shared: whitespace handling diverges per
// CLI (collapse+trim vs newline-preserving vs inline), so each CLI keeps its
// own strip function and calls this decoder inside it.

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
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
    .replace(/&nbsp;/g, " ")
}

// Shared text helpers for the *-search portal CLIs: byte-identical copies
// collapsed (internshala/naukri/wayup/cutshort).

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

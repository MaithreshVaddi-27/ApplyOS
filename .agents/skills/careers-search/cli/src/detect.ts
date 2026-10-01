// URL detection: from a careers URL, identify the board kind, the tenant slug
// and (when present) the posting id. Used by `detail` and by /apply handoff.

export interface DetectedBoard {
  board: string
  slug: string | null
  id: string | null
  /** Seeded company board when the URL matches a registry row. */
  company?: import("./types.js").CompanyBoard
}

export function detectBoards(url: string): DetectedBoard[] {
  const out: DetectedBoard[] = []
  let m: RegExpMatchArray | null

  if ((m = url.match(/amazon\.jobs\/(?:en\/)?jobs?\/([a-z0-9]+)/i))) {
    out.push({ board: "amazon", slug: "amazon", id: m[1] })
  } else if ((m = url.match(/careers\.google\.com\/jobs\/results\//i))) {
    out.push({ board: "google-careers (no connector — see docs/COMPANY_PORTAL_SCRAPER.md)", slug: null, id: null })
  } else if ((m = url.match(/jobs\.careers\.microsoft\.com\//i))) {
    out.push({ board: "microsoft-careers (no connector — see docs/COMPANY_PORTAL_SCRAPER.md)", slug: null, id: null })
  } else if ((m = url.match(/careers\.salesforce\.com\/en\/jobs\/([^/?#]+)/i))) {
    out.push({ board: "salesforce", slug: "salesforce", id: m[1].replace(/\/$/, "") })
  // Greenhouse serves regional boards (job-boards.eu.greenhouse.io, etc.) —
  // allow an optional region segment between the host and the slug.
  } else if ((m = url.match(/(?:job-boards(?:\.[a-z]{2})?|boards)\.greenhouse\.io\/([a-z0-9_-]+)(?:\/jobs\/([a-z0-9]+))?/i))) {
    out.push({ board: "greenhouse", slug: m[1], id: m[2] ?? null })
  } else if ((m = url.match(/jobs\.(?:eu\.)?lever\.co\/([a-z0-9_-]+)(?:\/([a-z0-9-]+))?/i))) {
    out.push({ board: "lever", slug: m[1], id: m[2] ?? null })
  } else if ((m = url.match(/jobs\.ashbyhq\.com\/([a-z0-9_-]+)(?:\/([a-z0-9-]+))?/i))) {
    out.push({ board: "ashby", slug: m[1], id: m[2] ?? null })
  } else if ((m = url.match(/jobs\.smartrecruiters\.com\/([A-Za-z0-9_-]+)(?:\/([A-Za-z0-9-]+))?/i))) {
    out.push({ board: "smartrecruiters", slug: m[1], id: m[2] ?? null })
  } else if ((m = url.match(/([a-z0-9-]+)\.eightfold\.ai\/careers(?:\/job)?\/([A-Za-z0-9._-]+)/i))) {
    out.push({ board: "eightfold", slug: m[1], id: m[2] ?? null })
  } else if ((m = url.match(/([a-z0-9]+)\.wd\d+\.myworkdayjobs\.com\/(?:en-US\/)?([a-zA-Z0-9]+)(?:\/job\/([A-Za-z0-9._-]+))?/i))) {
    out.push({ board: "workday", slug: `${m[1]}/${m[2]}`, id: m[3] ?? null })
  }
  return out
}

// Implementation of `careers-cli search [flags]`

import type { NormalizedJob, SearchOpts, SearchResult, BoardKind, CompanyBoard } from "../types.js"
import { connectorFor } from "../connectors/index.js"
import { applyClientFilters, dedupeByUrl, renderTable, renderPlain, clean } from "../helpers.js"
import { COMPANIES, companiesForBoard, companiesByCategory, companiesByRegion, findCompany } from "../companies.js"
import { detectBoards } from "../detect.js"

export async function runSearch(opts: SearchOpts): Promise<number> {
  // Resolve the target set of company boards.
  let targets = COMPANIES
  if (opts.company) {
    targets = findCompany(opts.company)
    if (targets.length === 0) {
      process.stderr.write(JSON.stringify({ error: `no seeded company matches "${opts.company}"`, code: "UNKNOWN_COMPANY" }) + "\n")
      return 1
    }
  } else if (opts.board) {
    targets = companiesForBoard(opts.board)
  } else if (opts.category) {
    targets = companiesByCategory(opts.category)
  } else if (opts.region) {
    targets = companiesByRegion(opts.region)
  }

  const maxPages = opts.maxPages ?? 3
  const boardsMeta: SearchResult["meta"]["boards"] = []
  const collected: NormalizedJob[] = []
  const pageLimit = opts.limit !== undefined && opts.limit >= 0 ? opts.limit : 20
  let fetchTruncated = false
  let displayTruncated = false

  // Fetch boards sequentially with small pacing — politeness over speed.
  for (const board of targets) {
    if (opts.board && board.board !== opts.board) continue
    const connector = connectorFor(board.board)
    if (!connector) {
      boardsMeta.push({ board: board.board, company: board.company, count: 0, ok: false, error: "no connector" })
      continue
    }
    try {
      const jobs = await connector.search(board, { query: opts.query, maxPages })
      collected.push(...jobs)
      boardsMeta.push({ board: board.board, company: board.company, count: jobs.length, ok: true })
      // A full page on the last permitted fetch pass means the board was cut
      // off by --max-pages, not exhausted. Say so — silence here is how an
      // "all possible applications" request quietly loses postings. Page
      // sizes per connector; Greenhouse/Lever are single-pass and never cap.
      const pageSize = ({ amazon: 100, smartrecruiters: 50, workday: 20, eightfold: 100, salesforce: 20 } as Partial<Record<BoardKind, number>>)[board.board]
      if (maxPages > 0 && pageSize && jobs.length > 0 && jobs.length % pageSize === 0) {
        const row = boardsMeta[boardsMeta.length - 1]
        row.error = `truncated fetch: hit --max-pages ${maxPages} — pass a higher --max-pages (or 0 for all pages) if you need every posting`
        fetchTruncated = true
      }
    } catch (err) {
      boardsMeta.push({
        board: board.board,
        company: board.company,
        count: 0,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
    await new Promise((r) => setTimeout(r, 300))
  }

  const filtered = dedupeByUrl(applyClientFilters(collected, opts))
  const total = filtered.length
  const page = Math.max(1, opts.page || 1)
  // --limit 0 emits everything; the default (20) exists for humans scanning a
  // table, not for machine consumers — which must ask for what they want.
  const paged = pageLimit === 0 ? filtered : filtered.slice((page - 1) * pageLimit, (page - 1) * pageLimit + pageLimit)
  if (pageLimit > 0 && total > paged.length) {
    displayTruncated = true
  }
  const displayNote = `truncated display: ${total} postings matched, showing ${paged.length} — pass --limit 0 for all, or page with --page`

  if (opts.format === "json") {
    const output: SearchResult & { meta: { truncated: boolean } } = {
      meta: { count: paged.length, page, total, truncated: fetchTruncated || displayTruncated, boards: boardsMeta },
      results: paged.map((r) => ({
        id: r.id,
        title: r.title,
        company: r.company,
        location: r.location,
        date: r.date,
        url: r.url,
        description: r.description,
        board: r.board,
        slug: r.slug,
      })),
    }
    process.stdout.write(JSON.stringify(output, null, 2) + "\n")
    return 0
  }
  if (opts.format === "table") {
    renderTable(paged)
    // Per-board status lines (the /scrape health check consumes these).
    for (const b of boardsMeta) {
      if (!b.ok) process.stdout.write(`board: ${b.company} (${b.board}) — error: ${b.error}\n`)
      else if (b.error) process.stdout.write(`board: ${b.company} (${b.board}) — note: ${b.error}\n`)
    }
    if (displayTruncated) process.stdout.write(`note: ${displayNote}\n`)
    return 0
  }
  renderPlain(paged)
  for (const b of boardsMeta) {
    if (b.error) process.stdout.write(`# ${b.company} (${b.board}): ${b.error}\n`)
  }
  if (displayTruncated) process.stdout.write(`# ${displayNote}\n`)
  return 0
}

/** `careers-cli detail <id|url>` — resolve board from URL, else try --board. */
export async function runDetail(target: string, opts: { board?: BoardKind; format: "json" | "plain" }): Promise<number> {
  const detected = detectBoards(target)
  const d = detected[0]
  if (d && d.slug && d.id) {
    const connector = connectorFor(d.board as BoardKind)
    if (!connector) {
      process.stderr.write(JSON.stringify({ error: `no connector for board ${d.board}`, code: "NO_CONNECTOR" }) + "\n")
      return 1
    }
    // Build a board from the URL's own tenant slug — detail works on any
    // board, seeded or not.
    const bare: CompanyBoard = { company: d.slug, board: d.board as BoardKind, slug: d.slug }
    const text = await connector.detail(bare, d.id)
    if (opts.format === "json") {
      process.stdout.write(JSON.stringify({ board: d.board, id: d.id, text }, null, 2) + "\n")
    } else {
      process.stdout.write(text + "\n")
    }
    return 0
  }
  if (d && !d.slug) {
    // Detection matched a host with a documented no-connector verdict.
    process.stderr.write(JSON.stringify({ error: `board "${d.board}" has no compliant connector`, code: "NO_CONNECTOR" }) + "\n")
    return 1
  }
  if (opts.board) {
    const connector = connectorFor(opts.board)
    if (!connector) {
      process.stderr.write(JSON.stringify({ error: `no connector for board ${opts.board}`, code: "NO_CONNECTOR" }) + "\n")
      return 1
    }
    // A bare board name is only meaningful for boards whose API keys on the
    // company name itself (amazon). Otherwise, try each seeded company of
    // that board until one answers.
    const candidates: CompanyBoard[] =
      opts.board === "amazon"
        ? [{ company: "Amazon", board: "amazon", slug: "india" }]
        : companiesForBoard(opts.board)
    let lastErr: unknown
    for (const board of candidates) {
      try {
        const text = await connector.detail(board, target)
        if (opts.format === "json") {
          process.stdout.write(JSON.stringify({ board: opts.board, company: board.company, id: target, text }, null, 2) + "\n")
        } else {
          process.stdout.write(text + "\n")
        }
        return 0
      } catch (err) {
        lastErr = err
      }
    }
    process.stderr.write(
      JSON.stringify({
        error: `no ${opts.board} company could resolve posting "${target}": ${lastErr instanceof Error ? lastErr.message : lastErr}`,
        code: "NOT_FOUND",
      }) + "\n",
    )
    return 1
  }
  process.stderr.write(
    JSON.stringify({
      error: "could not determine the board for this target — pass a full posting URL or --board <kind>",
      code: "AMBIGUOUS_TARGET",
    }) + "\n",
  )
  return 1
}

/** `careers-cli companies` — list the seeded registry. */
export function runCompanies(opts: { format: "json" | "table" }): number {
  if (opts.format === "json") {
    process.stdout.write(JSON.stringify(COMPANIES, null, 2) + "\n")
    return 0
  }
  for (const c of COMPANIES) {
    process.stdout.write(`${c.company.padEnd(24)} ${(c.board + "/" + c.slug).padEnd(32)} ${c.region ?? ""} ${c.category ?? ""}\n`)
  }
  return 0
}

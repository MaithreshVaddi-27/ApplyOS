// The example CLI. One command shape for every runtime (ADR-0008, §2.1 of
// public-api.md): `example-search <search|detail> [flags] --format json`.
// Everything board-specific is in helpers.ts, which re-exports the SDK.
import {
  arbeitnowProvider,
  extractId,
  writeError,
  type Row,
  type RawJob,
} from "./helpers.js";

export interface NormalizedJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  date: string | null;
  url: string;
  description?: string;
}

/** Map one SDK row into the portal-skill envelope (ADR-0006). */
export function toResult(row: Row): NormalizedJob {
  return {
    id: row.id,
    title: row.title,
    company: "Arbeitnow",
    location: row.location,
    date: row.date,
    url: row.url,
    ...(row.description ? { description: row.description.slice(0, 1200) } : {}),
  };
}

export async function search(opts: { query?: string; limit: number }): Promise<NormalizedJob[]> {
  const page = await arbeitnowProvider.search({ query: opts.query, limit: opts.limit, jobAgeDays: 14 });
  return page.rows.map(toResult);
}

export async function detail(ref: string): Promise<string> {
  const found = await arbeitnowProvider.detail(extractId(ref));
  return `${found.title}\n\n${found.description ?? "(no description returned)"}`;
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const command = process.argv[2];
if (command === "search") {
  const limit = Number(flag("--limit") ?? "20");
  try {
    const results = await search({ query: flag("--query") ?? flag("-q"), limit });
    process.stdout.write(JSON.stringify({ meta: { count: results.length, page: 1 }, results }, null, 2) + "\n");
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "FETCH_ERROR");
  }
} else if (command === "detail") {
  const ref = process.argv[3];
  if (!ref) writeError("missing reference", "INVALID_ARG");
  else {
    try {
      process.stdout.write(JSON.stringify({ text: await detail(ref) }, null, 2) + "\n");
    } catch (e) {
      writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED");
    }
  }
} else {
  process.stderr.write("usage: example-search <search|detail> [--query Q] [--limit N] --format json\n");
  process.exit(1);
}

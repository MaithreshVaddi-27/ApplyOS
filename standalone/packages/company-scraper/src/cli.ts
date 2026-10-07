// Origin: clean-room 2026-10-07, own CLI (no framework code reused). Author: OpenCode agent.
import { toJsonPayload, toTable, toPlain, statusLines } from "../../core/src/index";
import { loadRegistry } from "./registry";
import { runCompanySearch } from "./search";
import { detectBoard } from "./detect";
import { detailGreenhouse } from "./connectors/greenhouse";
import { detailAmazon } from "./connectors/amazon";

function arg(flag: string, short?: string): string | undefined {
  const i = process.argv.findIndex((a) => a === flag || (short && a === short));
  if (i < 0) return undefined;
  return process.argv[i + 1];
}

function has(flag: string): boolean {
  return process.argv.includes(flag);
}

function numArg(flag: string, short: string | undefined, fallback: number): number {
  const v = arg(flag, short);
  if (v === undefined) return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
}

function fail(code: string, error: string): never {
  process.stderr.write(JSON.stringify({ error, code }) + "\n");
  process.exit(1);
}

function formatOf(): "json" | "table" | "plain" {
  const f = (arg("--format") ?? "table").toLowerCase();
  return f === "json" ? "json" : f === "plain" ? "plain" : "table";
}

async function cmdSearch(): Promise<void> {
  const format = formatOf();
  const { results, meta } = await runCompanySearch({
    query: arg("--query", "-q") ?? arg("-q") ?? "",
    location: arg("--location", "-l"),
    company: arg("--company", "-c"),
    board: arg("--board", "-b"),
    category: arg("--category"),
    region: arg("--region"),
    type: ((arg("--type") ?? "all") as "jobs" | "internships" | "all"),
    stage: arg("--stage") as "student" | "fresher" | "experienced" | "remote-global" | undefined,
    jobage: numArg("--jobage", undefined, 0),
    limit: numArg("--limit", "-n", 20),
    maxPages: numArg("--max-pages", undefined, 3),
  });
  if (format === "json") {
    process.stdout.write(toJsonPayload(results, meta) + "\n");
  } else if (format === "plain") {
    process.stdout.write(toPlain(results) + (results.length ? "\n" : "No matches.\n"));
  } else {
    const body = results.length ? toTable(results) : "No matches.";
    const extra = statusLines(meta);
    process.stdout.write([body, ...extra, `total=${meta.total} truncated=${meta.truncated} elapsedMs=${meta.elapsedMs}`].join("\n") + "\n");
  }
}

async function cmdDetail(): Promise<void> {
  const ref = process.argv[3];
  if (!ref) fail("missing-arg", "usage: company-scrape detail <url|id> [--board amazon|greenhouse] [--format json|table|plain]");
  const format = formatOf();
  const board = arg("--board", "-b");
  const detected = detectBoard(ref);
  try {
    if (detected.board === "amazon" || board === "amazon") {
      const id = /^\d+$/.test(ref) ? ref : ref.match(/(\d{5,})/)?.[1] ?? ref;
      const d = await detailAmazon(id);
      process.stdout.write(format === "json" ? JSON.stringify(d, null, 2) + "\n" : `${d.title} — ${d.company} (${d.location})\n${d.url}\n\n${d.description}\n`);
      return;
    }
    if (detected.board === "greenhouse" || board === "greenhouse") {
      const slug = detected.slug ?? arg("--company", "-c") ?? fail("missing-arg", "greenhouse detail needs a board slug: --board greenhouse --company <slug>");
      const id = ref.match(/(\d+)(?!.*\d)/)?.[1] ?? ref;
      const d = await detailGreenhouse(slug, id);
      process.stdout.write(format === "json" ? JSON.stringify(d, null, 2) + "\n" : `${d.title} — ${d.company} (${d.location})\n${d.url}\n\n${d.description}\n`);
      return;
    }
    fail("unsupported-board", `detail supports amazon + greenhouse URLs in this build (${detected.hint})`);
  } catch (e) {
    fail("detail-failed", e instanceof Error ? e.message : String(e));
  }
}

function cmdCompanies(): void {
  const format = formatOf();
  const rows = loadRegistry();
  if (format === "json") {
    process.stdout.write(JSON.stringify({ companies: rows }, null, 2) + "\n");
  } else {
    process.stdout.write(["COMPANY | BOARD | SLUG | REGION | CATEGORY", ...rows.map((r) => `${r.company} | ${r.board} | ${r.slug} | ${r.region} | ${r.category}`)].join("\n") + "\n");
  }
}

function cmdDiscover(): void {
  const url = process.argv[3];
  if (!url) fail("missing-arg", "usage: company-scrape discover <careers-url>");
  const d = detectBoard(url);
  process.stdout.write(JSON.stringify(d, null, 2) + "\n");
}

function help(): void {
  process.stdout.write(`company-scrape — standalone company-careers search (clean-room, zero deps)

usage:
  company-scrape search [-q query] [-l location] [-b board] [-c company] [--category X] [--region india|global]
                        [--type jobs|internships|all] [--stage student|fresher|experienced|remote-global]
                        [--jobage days] [-n limit] [--max-pages N] [--format json|table|plain]
  company-scrape detail <url|id> [--board amazon|greenhouse] [--format json|table|plain]
  company-scrape companies [--format json|table]
  company-scrape discover <careers-url>

personal use only: one fetch pass per company per run, default page cap 3, 300ms pacing.
`);
}

const cmd = process.argv[2];
if (cmd === "search") await cmdSearch();
else if (cmd === "detail") await cmdDetail();
else if (cmd === "companies") cmdCompanies();
else if (cmd === "discover") cmdDiscover();
else if (!cmd || has("--help") || has("-h")) help();
else fail("unknown-command", `unknown command: ${cmd} (see --help)`);


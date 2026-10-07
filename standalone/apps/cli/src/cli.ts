// Origin: clean-room 2026-10-07, own CLI (no framework code reused). Author: OpenCode agent.
import { toJsonPayload, toTable, toPlain, statusLines } from "../../../packages/core/src/index";
import { runUnifiedSearch } from "./scrape";

function arg(flag: string, short?: string): string | undefined {
  const i = process.argv.findIndex((a) => a === flag || (short && a === short));
  if (i < 0) return undefined;
  return process.argv[i + 1];
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

async function cmdScrape(): Promise<void> {
  const format = formatOf();
  const stage = arg("--stage") as "student" | "fresher" | "experienced" | "remote-global" | undefined;
  if (stage && !["student", "fresher", "experienced", "remote-global"].includes(stage)) {
    fail("bad-stage", `--stage must be student|fresher|experienced|remote-global (got ${stage})`);
  }
  const { results, meta } = await runUnifiedSearch({
    query: arg("--query", "-q") ?? "",
    location: arg("--location", "-l"),
    stage,
    type: (arg("--type") ?? "all") as "jobs" | "internships" | "all",
    jobage: numArg("--jobage", undefined, 0),
    limit: numArg("--limit", "-n", 20),
    maxPages: numArg("--max-pages", undefined, 3),
  });
  if (format === "json") {
    process.stdout.write(toJsonPayload(results, meta) + "\n");
  } else if (format === "plain") {
    process.stdout.write((results.length ? toPlain(results) : "No matches.") + "\n");
  } else {
    const body = results.length ? toTable(results) : "No matches.";
    process.stdout.write(
      [body, ...statusLines(meta), `total=${meta.total} truncated=${meta.truncated} elapsedMs=${meta.elapsedMs}`].join("\n") + "\n",
    );
  }
}

function help(): void {
  process.stdout.write(`applyos — unified standalone job/internship finder (clean-room, zero deps)

usage:
  applyos scrape [-q query] [-l location] [--stage student|fresher|experienced|remote-global]
                 [--type jobs|internships|all] [--jobage days] [-n limit]
                 [--max-pages N] [--format json|table|plain]

stage presets: --stage student keeps internship rows; --stage remote-global
keeps remote rows unless -l is given. --type overrides the stage default.

sources: company boards (greenhouse/lever/smartrecruiters/amazon/workday)
+ remoteok, remotive, weworkremotely, unstop. One dead source never aborts
the run — see the per-source notes in the output.

personal use only: polite volume (page cap 3, pacing between hosts),
public endpoints, no evasion.
`);
}

const cmd = process.argv[2];
if (cmd === "scrape") await cmdScrape();
else if (!cmd || process.argv.includes("--help") || process.argv.includes("-h")) help();
else fail("unknown-command", `unknown command: ${cmd} (see --help)`);

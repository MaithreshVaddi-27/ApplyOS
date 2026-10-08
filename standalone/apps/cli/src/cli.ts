// Origin: clean-room 2026-10-07, own CLI (no framework code reused). Author: OpenCode agent.
import { existsSync, readFileSync } from "node:fs";
import { toJsonPayload, toTable, toPlain, statusLines } from "@applyos/core";
import { runUnifiedSearch } from "./scrape";
import { runRank } from "./rank";
import { runApply, runApplyBatch } from "./apply";

function arg(flag: string, short?: string): string | undefined {
  const i = process.argv.findIndex((a) => a === flag || (short && a === short));
  if (i < 0) return undefined;
  const value = process.argv[i + 1];
  if (value === undefined || /^--?[a-z]/i.test(value)) {
    fail("missing-arg", `${process.argv[i]} requires a value`);
  }
  return value;
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

rank runs deterministic gates first (stale/location/language/batch/stipend/
ctc/bond — FAILs listed with reasons, never silent), then scores survivors:

  applyos rank [-q query] [-l location] [--stage STAGE] [--type TYPE]
               [--skills a,b,c] [--locations X,Y] [--grad-year YYYY]
               [--stipend-floor N] [--ctc-floor N] [--max-age days]
               [-n limit] [--format json|table]
  applyos apply <url|id> [--profile profile.json] [--description text]
                [--skills a,b] [--locations X] [--stage STAGE] [--format json|table]
  applyos apply --batch batch.json [--profile profile.json]
                [--skills a,b] [--locations X] [--stage STAGE] [--format json|table]
                batch.json holds [{"ref": "<url|id>", "description": "optional pasted JD"}].
                Packs build sequentially in file order; one dead entry is a row, not an abort.
                Exit 0 when at least one pack was built, 1 otherwise.
`);
}

async function cmdRank(): Promise<void> {
  const format = formatOf();
  const stage = arg("--stage") as "student" | "fresher" | "experienced" | "remote-global" | undefined;
  if (stage && !["student", "fresher", "experienced", "remote-global"].includes(stage)) {
    fail("bad-stage", `--stage must be student|fresher|experienced|remote-global (got ${stage})`);
  }
  const split = (v: string | undefined): string[] =>
    (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const { ranked, rejected, elapsedMs } = await runRank({
    query: arg("--query", "-q") ?? "",
    location: arg("--location", "-l"),
    stage,
    type: (arg("--type") ?? "all") as "jobs" | "internships" | "all",
    jobage: numArg("--jobage", undefined, 0),
    limit: numArg("--limit", "-n", 20),
    maxPages: numArg("--max-pages", undefined, 3),
    skills: split(arg("--skills")),
    locations: split(arg("--locations")),
    gradYear: arg("--grad-year") ? Number(arg("--grad-year")) : undefined,
    stipendFloor: arg("--stipend-floor") ? Number(arg("--stipend-floor")) : undefined,
    ctcFloor: arg("--ctc-floor") ? Number(arg("--ctc-floor")) : undefined,
    maxAge: numArg("--max-age", undefined, 30),
  });
  if (format === "json") {
    process.stdout.write(JSON.stringify({ ranked, rejected, elapsedMs }, null, 2) + "\n");
    return;
  }
  const lines = [`## Ranked shortlist (${ranked.length} scored, ${rejected.length} gated out, ${elapsedMs}ms)`, ""];
  ranked.forEach((r, i) => {
    lines.push(`${i + 1}. [${r.score} · ${r.verdict}] ${r.posting.title} — ${r.posting.company} (${r.posting.location})`);
    lines.push(`   ${r.posting.url}`);
    for (const s of r.strengths.slice(0, 2)) lines.push(`   + ${s}`);
    for (const g of r.gaps.slice(0, 2)) lines.push(`   - ${g}`);
  });
  if (rejected.length) {
    lines.push("", `Gated out (${rejected.length}):`);
    for (const j of rejected.slice(0, 10)) {
      lines.push(` - ${j.posting.title} — ${j.posting.company}: ${j.reasons.join("; ")}`);
    }
  }
  process.stdout.write(lines.join("\n") + "\n");
}

async function cmdApply(): Promise<void> {
  const batchPath = arg("--batch");
  if (batchPath) {
    await cmdApplyBatch(batchPath);
    return;
  }
  const ref = process.argv[3];
  if (!ref) fail("missing-arg", "usage: applyos apply <url|id> [--profile profile.json] [--description text] [--format json|table]");
  const format = formatOf();
  const split = (v: string | undefined): string[] =>
    (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const stage = arg("--stage") as "student" | "fresher" | "experienced" | "remote-global" | undefined;
  try {
    const { pack, gated } = await runApply({
      ref,
      profilePath: arg("--profile"),
      description: arg("--description"),
      skills: split(arg("--skills")),
      locations: split(arg("--locations")),
      stage,
    });
    if (format === "json") {
      process.stdout.write(JSON.stringify({ pack, gated }, null, 2) + "\n");
      return;
    }
    const fails = gated.filter((g) => g.verdict === "FAIL");
    process.stdout.write(
      [
        `## Application pack — ${pack.posting.title} @ ${pack.posting.company} [${pack.score} · ${pack.verdict}]`,
        pack.posting.url,
        ...(fails.length ? ["", `GATE FAILS: ${fails.map((f) => `${f.gate}: ${f.note}`).join("; ")}`] : []),
        "",
        "### Tailored resume (Markdown)",
        pack.resumeMarkdown,
        "",
        "### Portal pitch",
        pack.pitch,
        "",
        "### Follow-up draft (never auto-sent)",
        pack.followUp,
        "",
        `### Gaps kept visible (${pack.gaps.length}): ${pack.gaps.join(", ") || "none"}`,
        `### Claim traces: ${pack.traces.length} bullets, all sourced`,
      ].join("\n") + "\n",
    );
  } catch (e) {
    fail("apply-failed", e instanceof Error ? e.message : String(e));
  }
}

async function cmdApplyBatch(batchPath: string): Promise<void> {
  const format = formatOf();
  const split = (v: string | undefined): string[] =>
    (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const stage = arg("--stage") as "student" | "fresher" | "experienced" | "remote-global" | undefined;
  if (!existsSync(batchPath)) fail("batch-file", `batch file not found: ${batchPath}`);
  let entries: unknown;
  try {
    entries = JSON.parse(readFileSync(batchPath, "utf8"));
  } catch {
    fail("batch-file", `batch file is not valid JSON: ${batchPath}`);
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    fail("batch-file", `batch file must hold a non-empty array of {ref, description?}: ${batchPath}`);
  }
  for (const [i, e] of (entries as unknown[]).entries()) {
    if (!e || typeof (e as { ref?: unknown }).ref !== "string" || !(e as { ref: string }).ref.trim()) {
      fail("batch-file", `batch entry ${i} is missing its ref: every entry needs {ref, description?}`);
    }
  }
  const out = await runApplyBatch({
    entries: entries as { ref: string; description?: string }[],
    profilePath: arg("--profile"),
    skills: split(arg("--skills")),
    locations: split(arg("--locations")),
    stage,
  });
  if (format === "json") {
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  } else {
    const lines = [`## Application packs (${out.built} built, ${out.failed} failed, ${out.elapsedMs}ms)`, ""];
    for (const item of out.items) {
      if (!item.ok) {
        lines.push(`!! FAILED ${item.ref}: ${item.error} (${item.code})`, "");
        continue;
      }
      const fails = item.gated.filter((g) => g.verdict === "FAIL");
      lines.push(
        `## Application pack — ${item.pack.posting.title} @ ${item.pack.posting.company} [${item.pack.score} · ${item.pack.verdict}]`,
        item.pack.posting.url,
        ...(fails.length ? [`GATE FAILS: ${fails.map((f) => `${f.gate}: ${f.note}`).join("; ")}`] : []),
        "",
        "### Tailored resume (Markdown)",
        item.pack.resumeMarkdown,
        "",
        "### Portal pitch",
        item.pack.pitch,
        "",
      );
    }
    process.stdout.write(lines.join("\n") + "\n");
  }
  // Loud batch contract: partial results stay usable (exit 0), but a batch
  // that built nothing fails loudly so agents never mistake it for success.
  if (out.built === 0) process.exit(1);
}

const cmd = process.argv[2];
if (cmd === "scrape") await cmdScrape();
else if (cmd === "rank") await cmdRank();
else if (cmd === "apply") await cmdApply();
else if (!cmd || process.argv.includes("--help") || process.argv.includes("-h")) help();
else fail("unknown-command", `unknown command: ${cmd} (see --help)`);

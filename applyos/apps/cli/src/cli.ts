// Origin: clean-room 2026-10-07, own CLI (no framework code reused). Author: OpenCode agent.
import { existsSync, readFileSync } from "node:fs";
import { toJsonPayload, toTable, toPlain, statusLines, cliArg, cliNumArg, cliFail, cliFormat, cliStage, cliType } from "@applyos/core";
import { runUnifiedSearch } from "./scrape";
import { runRank } from "./rank";
import { runApply, runApplyBatch } from "./apply";
import { runDoctor, formatDoctorTable } from "./doctor";
import { runTrackerList, runTrackerSet, runTrackerMigrate } from "./tracker";
import { buildSnapshot } from "./snapshot";
import { loadProfileFile } from "@applyos/docgen";
import { runAll, updateBaseline, writeBaseline } from "../../../evals/runner";
import { contractDocument } from "@applyos/core";

/** Split a comma list into trimmed parts; empty means "not given". */
function splitList(v: string | undefined): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

/** An optional numeric gate floor: absent when the flag was not supplied. */
function floorArg(name: string): number | undefined {
  const raw = cliArg(name);
  return raw === undefined ? undefined : Number(raw);
}

/** The batch/stipend/ctc floors, resolved once for every apply-shaped command. */
function gateFloors(): { gradYear?: number; stipendFloor?: number; ctcFloor?: number } {
  return {
    gradYear: floorArg("--grad-year"),
    stipendFloor: floorArg("--stipend-floor"),
    ctcFloor: floorArg("--ctc-floor"),
  };
}

async function cmdScrape(): Promise<void> {
  const format = cliFormat();
  const stage = cliStage(cliArg("--stage"));
  const type = cliType(cliArg("--type"));
  const { results, meta } = await runUnifiedSearch({
    query: cliArg("--query", "-q") ?? "",
    location: cliArg("--location", "-l"),
    stage,
    type,
    jobage: cliNumArg("--jobage", undefined, 0, 3650),
    limit: cliNumArg("--limit", "-n", 20, 1000),
    maxPages: cliNumArg("--max-pages", undefined, 3, 20),
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
  process.stdout.write(`applyos — unified job/internship finder (clean-room, zero deps)

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

rank gates each posting on what the search pass actually has. Only stale and
location can decide a rejection: the search pass carries no description text, so
language/batch/stipend/ctc/bond report "not evaluated" rather than a finding.
apply has the full description and runs all nine:

  applyos rank [-q query] [-l location] [--stage STAGE] [--type TYPE]
               [--skills a,b,c] [--locations X,Y] [--grad-year YYYY]
               [--stipend-floor N] [--ctc-floor N] [--max-age days]
               [-n limit] [--format json|table]
  applyos apply <url|id> [--profile profile.json] [--description text]
                [--skills a,b] [--locations X] [--stage STAGE]
                [--grad-year YYYY] [--stipend-floor N] [--ctc-floor N]
                [--format json|table]
  applyos apply --batch batch.json [--profile profile.json]
                [--skills a,b] [--locations X] [--stage STAGE]
                [--grad-year YYYY] [--stipend-floor N] [--ctc-floor N]
                [--format json|table]
                batch.json holds [{"ref": "<url|id>", "description": "optional pasted JD"}].
                Packs build sequentially in file order; one dead entry is a row, not an abort.
                Exit 0 when at least one pack was built, 1 otherwise.

  applyos doctor [--check-remote] [--format json|table|plain]
                 Checks the toolchain and the workspace: bun, python, lualatex, moderncv,
                 a PDF text extractor, the engine install, the provider CLIs, the personal-data
                 directories, the profile, and the git remote's visibility. Exit 0 when every
                 required check passes, 1 otherwise.
                 --check-remote asks the GitHub CLI whether origin is public. It is the only
                 flag that reaches the network; without it doctor stays offline.

  applyos tracker list [--status S] [--format json|table]
                 Read workspace/job_search_tracker.csv without changing a byte.
  applyos tracker set <company> <role> [--status S] [--notes N] [--date YYYY-MM-DD]
                 Update one row's status, notes and date. No prompt: the agent asks the human.
  applyos tracker migrate --to N [--dry-run]
                 Apply a versioned tracker migration. Dry-run is the default.

  applyos snapshot [--format json|table]
                 Emit a stable JSON snapshot of the tracker for any consumer. Read-only, offline.
  applyos profile validate <file.json> [--format json|table]
                 Validate the machine-readable profile. Shape only; never judges a claim.
  applyos eval [suite] [--format json|table] [--update-baseline]
                 Run the offline evaluation suites against the committed corpus.
                 Exits 1 when a metric breaches its tolerance. Never touches the network.
                 --update-baseline is a maintainer action: it rewrites the stored baseline.

  applyos contract [--format json|table|plain]
                 Prints the shared contract: the field names and shapes each boundary uses
                 (the provider result, the engine row, the seen-store entry, the tracker
                 columns and statuses). Read it instead of guessing a field name.
`);
}

async function cmdRank(): Promise<void> {
  const format = cliFormat();
  const stage = cliStage(cliArg("--stage"));
  const split = splitList;
  const type = cliType(cliArg("--type"));
  const { ranked, rejected, elapsedMs } = await runRank({
    query: cliArg("--query", "-q") ?? "",
    location: cliArg("--location", "-l"),
    stage,
    type,
    jobage: cliNumArg("--jobage", undefined, 0, 3650),
    limit: cliNumArg("--limit", "-n", 20, 1000),
    maxPages: cliNumArg("--max-pages", undefined, 3, 20),
    skills: split(cliArg("--skills")),
    locations: split(cliArg("--locations")),
    gradYear: cliArg("--grad-year") ? Number(cliArg("--grad-year")) : undefined,
    stipendFloor: cliArg("--stipend-floor") ? Number(cliArg("--stipend-floor")) : undefined,
    ctcFloor: cliArg("--ctc-floor") ? Number(cliArg("--ctc-floor")) : undefined,
    maxAge: cliNumArg("--max-age", undefined, 30, 3650),
  });
  if (format === "json") {
    process.stdout.write(JSON.stringify({ ranked, rejected, elapsedMs }, null, 2) + "\n");
    return;
  }
  const lines = [`## Ranked shortlist (${ranked.length} scored, ${rejected.length} gated out, ${elapsedMs}ms)`, ""];
  ranked.forEach((r, i) => {
    lines.push(`${i + 1}. [${r.score} · ${r.verdict}] ${r.posting.title} — ${r.posting.company} (${r.posting.location ?? "unspecified"})`);
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
  const batchPath = cliArg("--batch");
  if (batchPath) {
    await cmdApplyBatch(batchPath);
    return;
  }
  const ref = process.argv[3];
  // A flag in ref position means the URL was forgotten (e.g. `apply --profile x`):
  // fail loudly instead of building a junk pack titled "--profile".
  if (!ref || ref.startsWith("-")) cliFail("missing-arg", "usage: applyos apply <url|id> [--profile profile.json] [--description text] [--format json|table]");
  const format = cliFormat();
  const split = splitList;
  const stage = cliStage(cliArg("--stage"));
  // Numeric floors gate the batch/stipend/ctc checks. Supplied here because the
  // apply path does have the posting text, so those gates can really run.
  const { gradYear, stipendFloor, ctcFloor } = gateFloors();
  try {
    const { pack, gated } = await runApply({
      ref,
      profilePath: cliArg("--profile"),
      description: cliArg("--description"),
      skills: split(cliArg("--skills")),
      locations: split(cliArg("--locations")),
      stage,
      gradYear,
      stipendFloor,
      ctcFloor,
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
    cliFail("apply-failed", e instanceof Error ? e.message : String(e));
  }
}

async function cmdApplyBatch(batchPath: string): Promise<void> {
  const format = cliFormat();
  const split = splitList;
  const stage = cliStage(cliArg("--stage"));
  const { gradYear, stipendFloor, ctcFloor } = gateFloors();
  if (!existsSync(batchPath)) cliFail("batch-file", `batch file not found: ${batchPath}`);
  let entries: unknown;
  try {
    entries = JSON.parse(readFileSync(batchPath, "utf8"));
  } catch {
    cliFail("batch-file", `batch file is not valid JSON: ${batchPath}`);
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    cliFail("batch-file", `batch file must hold a non-empty array of {ref, description?}: ${batchPath}`);
  }
  for (const [i, e] of (entries as unknown[]).entries()) {
    if (!e || typeof (e as { ref?: unknown }).ref !== "string" || !(e as { ref: string }).ref.trim()) {
      cliFail("batch-file", `batch entry ${i} is missing its ref: every entry needs {ref, description?}`);
    }
  }
  const out = await runApplyBatch({
    entries: entries as { ref: string; description?: string }[],
    profilePath: cliArg("--profile"),
    skills: split(cliArg("--skills")),
    locations: split(cliArg("--locations")),
    stage,
    gradYear,
    stipendFloor,
    ctcFloor,
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

async function cmdDoctor(): Promise<void> {
  const format = cliFormat();
  // --check-remote is the only flag that reaches the network: it asks the
  // GitHub CLI whether the origin repository is public. Without it, doctor
  // stays entirely offline and reports the remote as "verify it is private".
  const checkRemote = process.argv.includes("--check-remote");
  const outcome = runDoctor({ checkRemote });
  if (format === "json") {
    process.stdout.write(JSON.stringify(outcome, null, 2) + "\n");
  } else if (format === "plain") {
    for (const c of outcome.checks) {
      process.stdout.write(`${c.status}\t${c.label}\t${c.detail}\n`);
    }
  } else {
    process.stdout.write(formatDoctorTable(outcome) + "\n");
  }
  // A required check failed: the environment is not ready. Exit 1 so a
  // script or an agent can tell "ready" from "not ready" without parsing.
  if (outcome.exitCode !== 0) process.exit(1);
}

async function cmdContract(): Promise<void> {
  const format = cliFormat();
  const doc = contractDocument();
  if (format === "json") {
    process.stdout.write(JSON.stringify(doc, null, 2) + "\n");
    return;
  }
  if (format === "plain") {
    for (const [shapeName, shape] of Object.entries(doc.shapes as Record<string, { fields: { name: string; type: string; required: boolean }[] }>)) {
      for (const f of shape.fields) {
        process.stdout.write(`${shapeName}\t${f.name}\t${f.type}\t${f.required ? "required" : "optional"}\n`);
      }
    }
    return;
  }
  const lines: string[] = [];
  for (const [shapeName, shape] of Object.entries(doc.shapes as Record<string, { where: string; fields: { name: string; type: string; required: boolean; note: string }[] }>)) {
    lines.push(`## ${shapeName}`, `   ${shape.where}`, "");
    for (const f of shape.fields) {
      lines.push(`   ${f.name.padEnd(18)} ${f.type.padEnd(24)} ${f.required ? "required" : "optional"}  ${f.note}`);
    }
    lines.push("");
  }
  const tracker = doc.tracker as { file: string; columns: string[]; statuses: string[] };
  lines.push("## tracker", `   ${tracker.file}`, "", `   columns:  ${tracker.columns.join(", ")}`, "", `   statuses: ${tracker.statuses.join(", ")}`, "");
  const scoring = doc.scoringSource as Record<string, string>;
  lines.push("## scoring tables (the spec is the reference)", "");
  for (const [k, v] of Object.entries(scoring)) lines.push(`   ${k.padEnd(14)} ${v}`);
  process.stdout.write(lines.join("\n") + "\n");
}

const cmd = process.argv[2];
if (cmd === "--version" || cmd === "-V") {
  // The engine's own version, from the workspace manifest — not the framework
  // version marker on the specs.
  const pkg = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8")) as { version: string };
  process.stdout.write(`applyos ${pkg.version}\n`);
}
else if (cmd === "scrape") await cmdScrape();
else if (cmd === "rank") await cmdRank();
else if (cmd === "apply") await cmdApply();
else if (cmd === "doctor") await cmdDoctor();
else if (cmd === "snapshot") {
  const snapshot = buildSnapshot();
  if (cliFormat() === "json") {
    process.stdout.write(JSON.stringify(snapshot, null, 2) + "\n");
  } else {
    process.stdout.write(`Snapshot schema ${snapshot.schemaVersion}, tracker v${snapshot.tracker.version}\n`);
    process.stdout.write(`${snapshot.tracker.rows.length} row(s); statuses: ${snapshot.tracker.statuses.join(", ") || "(none)"}\n`);
    for (const n of snapshot.notes) process.stdout.write(`note: ${n}\n`);
  }
}
else if (cmd === "profile") {
  const sub = process.argv[3];
  if (sub !== "validate") cliFail("unknown-command", `unknown profile subcommand: ${sub ?? "(none)"} (validate)`);
  const file = process.argv[4];
  if (!file) cliFail("missing-arg", "profile validate <file.json> [--format json|table]");
  const { warnings } = loadProfileFile(file);
  if (cliFormat() === "json") {
    process.stdout.write(JSON.stringify({ valid: true, warnings }, null, 2) + "\n");
  } else {
    process.stdout.write(`Profile valid. ${warnings.length} warning(s).\n`);
    for (const w of warnings) process.stdout.write(`warn: ${w}\n`);
  }
}
else if (cmd === "eval") {
  const { results, baseline, breaches } = runAll();
  if (process.argv.includes("--update-baseline")) {
    writeBaseline(updateBaseline(results));
    process.stdout.write(`Baseline updated for ${results.length} suites.\n`);
  } else {
    const format = cliFormat();
    const candidate = process.argv[3];
    const wanted = candidate && !candidate.startsWith("-") ? candidate : undefined;
    const rows = wanted ? results.filter((r) => r.suite === wanted) : results;
    if (format === "json") {
      process.stdout.write(JSON.stringify({ corpusHash: baseline.corpusHash, modelVersion: baseline.modelVersion, results: rows, breaches }, null, 2) + "\n");
    } else {
      for (const r of rows) {
        process.stdout.write(`## ${r.suite} (${r.labels} labels)\n`);
        for (const [k, v] of Object.entries(r.metrics)) process.stdout.write(`   ${k.padEnd(22)} ${v.toFixed(4)}\n`);
      }
      for (const b of breaches) process.stdout.write(`BREACH ${b}\n`);
    }
    if (breaches.length) process.exit(1);
  }
}
else if (cmd === "contract") await cmdContract();
else if (cmd === "tracker") {
  const sub = process.argv[3];
  if (sub === "list") runTrackerList(cliFormat(), cliArg("--status"));
  else if (sub === "set") {
    const company = process.argv[4];
    const role = process.argv[5];
    if (!company || !role) cliFail("missing-arg", "tracker set <company> <role> [--status S] [--notes N] [--date YYYY-MM-DD]");
    runTrackerSet(company, role);
  } else if (sub === "migrate") runTrackerMigrate();
  else cliFail("unknown-command", `unknown tracker subcommand: ${sub ?? "(none)"} (list|set|migrate)`);
}
else if (!cmd || process.argv.includes("--help") || process.argv.includes("-h")) help();
else cliFail("unknown-command", `unknown command: ${cmd} (see --help)`);

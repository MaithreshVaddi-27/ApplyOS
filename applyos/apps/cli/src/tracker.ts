// Origin: clean-room 2026-11-26, Phase 7 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// `applyos tracker` — the thin CLI over the shared tracker contract.
// list is read-only; set is idempotent and never prompts (the agent asks the
// human); migrate is dry-run by default.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  cliArg, cliFail, cliFormat,
  loadTrackerFile, migrateTracker, readTracker, TRACKER_SIDECAR, writeTracker,
} from "@applyos/core";

const TRACKER = "workspace/job_search_tracker.csv";

export function runTrackerList(format: string, status?: string): void {
  const doc = loadTrackerFile(TRACKER);
  const rows: Array<Record<string, string>> = doc.rows
    .filter((r) => !status || r.status === status)
    .map((r) => ({ ...r.fields, status: r.status }));
  if (format === "json") {
    process.stdout.write(JSON.stringify({ version: doc.version, rows }, null, 2) + "\n");
    return;
  }
  if (!rows.length) {
    process.stdout.write("No matching applications.\n");
    return;
  }
  const pad = (s: string, w: number): string => s.length > w ? s.slice(0, w - 1) + "…" : s.padEnd(w);
  const header = `${pad("DATE", 12)} ${pad("COMPANY", 20)} ${pad("ROLE", 26)} ${pad("STATUS", 16)}`;
  process.stdout.write(header + "\n" + "-".repeat(header.length) + "\n");
  for (const r of rows) {
    process.stdout.write(`${pad(r.date, 12)} ${pad(r.company, 20)} ${pad(r.role, 26)} ${pad(r.status, 16)}\n`);
  }
}

export function runTrackerSet(company: string, role: string): void {
  if (!existsSync(TRACKER)) cliFail("tracker-not-found", `${TRACKER} not found — run /apply first`);
  const doc = loadTrackerFile(TRACKER);
  const raw = readFileSync(TRACKER, "utf8");
  const updated = writeTracker(readTracker(raw, doc.version), {
    company,
    role,
    status: cliArg("--status"),
    notes: cliArg("--notes"),
    date: cliArg("--date"),
  });
  writeFileSync(TRACKER, updated, "utf8");
  process.stdout.write(`Updated ${company} / ${role}\n`);
}

export function runTrackerMigrate(): void {
  const to = cliArg("--to");
  if (!to || !/^\d+$/.test(to)) cliFail("missing-arg", "tracker migrate --to N [--dry-run]");
  const dryRun = !process.argv.includes("--write");
  if (!existsSync(TRACKER)) cliFail("tracker-not-found", `${TRACKER} not found — run /apply first`);
  const doc = loadTrackerFile(TRACKER);
  const raw = readFileSync(TRACKER, "utf8");
  const migrated = migrateTracker(doc.version, Number(to), raw);
  if (dryRun) {
    process.stdout.write(`Would migrate tracker ${doc.version} -> ${to} (dry-run; pass --write to apply)\n`);
    return;
  }
  writeFileSync(TRACKER, migrated, "utf8");
  writeFileSync(TRACKER_SIDECAR, `${to}\n`, "utf8");
  process.stdout.write(`Migrated tracker ${doc.version} -> ${to}\n`);
}

export function isTrackerStatus(value: string): boolean {
  return loadTrackerFile(TRACKER).rows.some((r) => r.status === value);
}

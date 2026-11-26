// Origin: clean-room 2026-11-26, Phase 10 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// The stable data contract Q10 resolved on: one versioned JSON snapshot,
// built through the shared tracker reader. Read-only and offline. Any consumer
// can read it; the TUI happens to be a Bun package today and need not stay one.
import { existsSync } from "node:fs";
import { loadTrackerFile } from "./tracker.js";
import { normalizeStatus } from "./tracker.js";

export interface Snapshot {
  schemaVersion: 1;
  /** No wall-clock in the shape: the same tracker produces the same snapshot. */
  generatedAt: null;
  tracker: {
    version: number;
    columns: string[];
    statuses: string[];
    rows: Record<string, string>[];
  };
  notes: string[];
}

export function buildSnapshot(trackerPath = "workspace/job_search_tracker.csv"): Snapshot {
  const notes: string[] = [];
  const doc = loadTrackerFile(trackerPath);
  if (!existsSync(trackerPath)) notes.push("tracker missing: showing an empty snapshot (run /setup or /apply)");
  return {
    schemaVersion: 1,
    generatedAt: null,
    tracker: {
      version: doc.version,
      columns: doc.header.split(",").map((c) => c.trim()),
      statuses: [...new Set(doc.rows.map((r) => normalizeStatus(r.status)))].sort(),
      rows: doc.rows.map((r) => ({ ...r.fields, status: normalizeStatus(r.status) })),
    },
    notes,
  };
}

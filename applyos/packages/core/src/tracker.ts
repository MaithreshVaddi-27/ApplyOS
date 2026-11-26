// Origin: clean-room 2026-11-26, Phase 7 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// The tracker contract: ONE schema, ONE reader, ONE writer.
//
// `workspace/job_search_tracker.csv` is the highest-fanout contract in the
// repo: /apply, /outcome and /gmail-sync write it; /rank, /html-report and
// /notion-sync read it. Before Phase 7 the 14 columns, the status vocabulary
// and the legacy spellings lived as prose in six specs. This module is the
// single definition all six defer to.
//
// The writer never restructures the file: it edits only the named columns of
// the named row and preserves every other byte, including malformed fields.
import { existsSync, readFileSync } from "node:fs";
import { TRACKER_COLUMNS, TRACKER_STATUSES } from "./contract.js";

export const TRACKER_SCHEMA_VERSION = 1;
export const TRACKER_SIDECAR = "workspace/.tracker_version";

/**
 * The 14 columns and the nine spellings already live in contract.ts — the
 * published contract. The tracker reads them from there; there is one source.
 */
export type TrackerColumn = (typeof TRACKER_COLUMNS)[number];
export type TrackerStatus = (typeof TRACKER_STATUSES)[number];

// The column and status arrays are exported once, from contract.ts. Consumers
// that need the literal union import the types below; runtime callers use the
// contract's arrays directly. Re-exporting them here would be a second source.

/** Final statuses close an application. Everything else, drafted included, is open. */
export const FINAL_STATUSES: readonly TrackerStatus[] = ["hired", "rejected", "no_response", "offer_declined", "withdrawn"];

/**
 * Legacy space forms are accepted on read and normalised in memory. They are
 * never written: a workspace never has to be rewritten to become readable.
 */
export const LEGACY_STATUS_ALIASES: Readonly<Record<string, TrackerStatus>> = {
  "no response": "no_response",
  "offer declined": "offer_declined",
};

/** `interview_only` belongs to the archive Status enum, never to the tracker. */
export const ARCHIVE_ONLY_STATUSES = ["in_progress", "interview_only"] as const;

export interface TrackerRow {
  /** Exact byte content of every field, keyed by column. */
  fields: Record<string, string>;
  /** 1-based physical line number in the file, for byte-preserving updates. */
  line: number;
  status: TrackerStatus;
}

export interface TrackerDocument {
  /** The raw header line, preserved exactly. */
  header: string;
  /** Raw physical lines including the header, so untouched bytes survive. */
  lines: string[];
  rows: TrackerRow[];
  version: number;
}

/** Normalise a status on read. Unknown values are returned unchanged. */
export function normalizeStatus(value: string): string {
  const trimmed = value.trim();
  return LEGACY_STATUS_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

export function isFinalStatus(status: string): boolean {
  return (FINAL_STATUSES as readonly string[]).includes(normalizeStatus(status));
}

/** Minimal RFC-4180 split: quoted commas and escaped quotes stay in one field. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      out.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

/** Quote a field only when the CSV grammar requires it; leave others byte-exact. */
export function encodeField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Split a line into RAW field substrings, keeping each field's own quoting
 * intact. The writer uses this so a field it does not touch survives byte for
 * byte, rather than being re-encoded from a parsed value.
 */
export function splitCsvRaw(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    current += ch;
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { current += line[++i]; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      out.push(current.slice(0, -1));
      current = "";
    }
  }
  out.push(current);
  return out;
}

/** Read a tracker without changing a byte. A missing file has only the header. */
export function readTracker(text: string, version = TRACKER_SCHEMA_VERSION): TrackerDocument {
  const lines = text.split(/\r?\n/);
  const header = lines[0] ?? TRACKER_COLUMNS.join(",");
  const columns = splitCsvLine(header);
  if (columns.join(",") !== TRACKER_COLUMNS.join(",")) {
    throw new Error(`tracker invalid: header must have the 14 canonical columns in order`);
  }
  const rows: TrackerRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const values = splitCsvLine(raw);
    const fields: Record<string, string> = {};
    TRACKER_COLUMNS.forEach((c, j) => { fields[c] = values[j] ?? ""; });
    rows.push({ fields, line: i, status: normalizeStatus(fields.status) as TrackerStatus });
  }
  return { header, lines, rows, version };
}

/** Read a tracker file on disk, including its additive version sidecar. */
export function loadTrackerFile(path: string, sidecarPath = TRACKER_SIDECAR): TrackerDocument {
  const text = existsSync(path) ? readFileSync(path, "utf8") : TRACKER_COLUMNS.join(",") + "\n";
  let version = TRACKER_SCHEMA_VERSION;
  if (existsSync(sidecarPath)) {
    const raw = readFileSync(sidecarPath, "utf8").trim();
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error(`tracker invalid: ${sidecarPath} must hold a positive integer version`);
    }
    version = parsed;
  }
  return readTracker(text, version);
}

export interface TrackerUpdate {
  /** Company + role identify the row, the same key the specs use. */
  company: string;
  role: string;
  status?: string;
  notes?: string;
  date?: string;
}

/**
 * Apply updates to the raw lines. Only the named columns of the matched row
 * change: every other byte — including a field the parser would reformat —
 * is copied verbatim. A repeated identical update produces identical output.
 */
export function writeTracker(doc: TrackerDocument, update: TrackerUpdate): string {
  const status = update.status === undefined ? undefined : normalizeStatus(update.status);
  if (status !== undefined && !(TRACKER_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`tracker invalid: status "${update.status}" is not one of ${TRACKER_STATUSES.join(", ")}`);
  }
  const match = doc.rows.find(
    (r) => r.fields.company === update.company && r.fields.role === update.role,
  );
  if (!match) throw new Error(`tracker invalid: no row for ${update.company} / ${update.role}`);
  const values = splitCsvRaw(doc.lines[match.line]);
  const set = (name: TrackerColumn, value: string | undefined): void => {
    if (value === undefined) return;
    const index = TRACKER_COLUMNS.indexOf(name);
    values[index] = encodeField(value);
  };
  set("status", status);
  set("notes", update.notes);
  set("date", update.date);
  const lines = [...doc.lines];
  lines[match.line] = values.join(",");
  return lines.join("\n");
}

/**
 * A pure, versioned migration. Migrations must never lose information: this
 * first step only normalises legacy status spellings, which are aliases rather
 * than distinct values, and refuses any unknown status.
 */
export function migrateTracker(from: number, to: number, csv: string): string {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    throw new Error(`tracker invalid: cannot migrate ${from} -> ${to}`);
  }
  if (from === to) return csv;
  if (from === 1 && to === 2) {
    const doc = readTracker(csv, from);
    const lines = [...doc.lines];
    for (const row of doc.rows) {
      const original = row.fields.status;
      const normalised = normalizeStatus(original);
      if (!original.trim() || (TRACKER_STATUSES as readonly string[]).includes(normalised)) continue;
      // An unknown status is information the migration cannot safely map.
      throw new Error(`tracker invalid: row ${row.line} has unknown status "${original}" — refusing to migrate`);
    }
    return lines.join("\n");
  }
  throw new Error(`tracker invalid: no migration from ${from} to ${to}`);
}

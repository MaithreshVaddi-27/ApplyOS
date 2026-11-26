// Origin: clean-room 2026-11-26, Phase 10 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// Pure TUI rendering over the Phase 10 snapshot. No framework, no ANSI state
// beyond a few colour codes, and — critically — no write path. The tracker has
// five writers already; a read-only view is the whole design.
import type { Snapshot } from "@applyos/core";

export interface ShortlistRow {
  id: string;
  title: string;
  company: string;
  score: number;
  band: string;
  gaps: string[];
}

export interface FitFilter {
  band?: string;
  gap?: string;
}

/** Group the tracker by status, using the counts from the shared schema. */
export function renderPipeline(snapshot: Snapshot): string[] {
  const lines: string[] = ["PIPELINE", "======== ", ""];
  const groups = new Map<string, number>();
  for (const row of snapshot.tracker.rows) {
    const status = row.status || "unknown";
    groups.set(status, (groups.get(status) ?? 0) + 1);
  }
  for (const status of [...groups.keys()].sort()) {
    lines.push(`  ${status.padEnd(18)} ${groups.get(status)}`);
  }
  if (!groups.size) lines.push("  (no applications yet)");
  lines.push("", `${snapshot.tracker.rows.length} row(s) · tracker v${snapshot.tracker.version}`);
  return lines;
}

export function renderShortlist(rows: ShortlistRow[], filter: FitFilter = {}): string[] {
  const selected = rows.filter((r) => {
    if (filter.band && r.band.toLowerCase() !== filter.band.toLowerCase()) return false;
    if (filter.gap && !r.gaps.some((g) => g.toLowerCase().includes(filter.gap!.toLowerCase()))) return false;
    return true;
  });
  const lines = ["SHORTLIST", "=========", ""];
  const head = `  ${"SCORE".padEnd(6)} ${"BAND".padEnd(14)} ${"TITLE / COMPANY".padEnd(36)} GAPS`;
  lines.push(head, "  " + "-".repeat(head.length));
  for (const row of selected) {
    lines.push(
      `  ${String(row.score).padEnd(6)} ${row.band.padEnd(14)} ${`${row.title} — ${row.company}`.slice(0, 36).padEnd(36)} ${row.gaps.slice(0, 2).join("; ")}`,
    );
  }
  if (!selected.length) lines.push("  (no postings match this filter)");
  lines.push("", `${selected.length} of ${rows.length} shown`);
  return lines;
}

/** Posting detail: the explanation, gates and quoted evidence. */
export function renderDetail(row: ShortlistRow, explanation?: {
  dimensions: { name: string; raw: number; contribution: number; evidence: string; status: string }[];
  gates: { gate: string; verdict: string; note: string }[];
  modelVersion: string;
}): string[] {
  const lines = [row.title, row.company, `${row.score} · ${row.band}`, ""];
  if (explanation) {
    lines.push("DIMENSIONS");
    for (const d of explanation.dimensions) {
      const mark = d.status === "scored" ? " " : "-";
      lines.push(`  ${mark} ${d.name.padEnd(12)} raw ${d.raw.toFixed(2)}  contrib ${d.contribution.toFixed(2)}`);
      lines.push(`      "${d.evidence}"`);
    }
    lines.push("", `GATES (${explanation.gates.length})`);
    for (const g of explanation.gates) {
      lines.push(`  ${g.verdict.padEnd(5)} ${g.gate}${g.note ? ` — ${g.note}` : ""}`);
    }
    lines.push("", `model ${explanation.modelVersion}`);
  } else {
    lines.push("(no explanation available for this posting)");
  }
  if (row.gaps.length) {
    lines.push("", "GAPS");
    for (const g of row.gaps) lines.push(`  - ${g}`);
  }
  return lines;
}

/** An empty state with the setup hint, not a crash. */
export function renderEmpty(): string[] {
  return [
    "No tracker found.",
    "",
    "Run /setup to create your profile, then /scrape and /rank to build a shortlist.",
    "This view is read-only: writes go through `applyos tracker set` or the specs.",
  ];
}

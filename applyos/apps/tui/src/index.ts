// Origin: clean-room 2026-11-26, Phase 10. Author: OpenCode agent.
//
// The TUI entry point. Reads the shared snapshot, renders to stdout, never
// writes. Views: pipeline, shortlist, detail. Filtering is read-only.
import { buildSnapshot } from "@applyos/core";
import { renderDetail, renderEmpty, renderPipeline, renderShortlist, type ShortlistRow } from "./render.js";

/** Shortlist rows come from a scorer injected by the caller, never re-derived here. */
export type ScoreSource = (posting: Record<string, string>) => ShortlistRow | undefined;

export function runTui(options: {
  view: "pipeline" | "shortlist" | "detail";
  band?: string;
  gap?: string;
  id?: string;
  scoreSource?: ScoreSource;
  trackerPath?: string;
}): string[] {
  const snapshot = buildSnapshot(options.trackerPath);
  if (!snapshot.tracker.rows.length && snapshot.notes.length) return renderEmpty();
  if (options.view === "pipeline") return renderPipeline(snapshot);

  const rows = options.scoreSource
    ? snapshot.tracker.rows.map(options.scoreSource).filter((r): r is ShortlistRow => !!r)
    : [];
  if (options.view === "shortlist") return renderShortlist(rows, { band: options.band, gap: options.gap });

  const target = rows.find((r) => r.id === options.id);
  return target ? renderDetail(target) : [`No posting with id ${options.id ?? "(none)"} in this snapshot.`];
}

const view = (process.argv[2] as "pipeline" | "shortlist" | "detail") ?? "pipeline";
if (!["pipeline", "shortlist", "detail"].includes(view)) {
  process.stderr.write("usage: applyos-tui pipeline|shortlist|detail [--band B] [--gap G] [--id ID]\n");
  process.exit(1);
}
const flag = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
for (const line of runTui({ view, band: flag("--band"), gap: flag("--gap"), id: flag("--id") })) {
  process.stdout.write(line + "\n");
}

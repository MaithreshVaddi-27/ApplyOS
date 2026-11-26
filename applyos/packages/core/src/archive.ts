// Origin: clean-room 2026-11-26, Phase 7 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// The application-archive layout, defined once.
//
// /apply, /outcome, /interview and /gmail-sync all name the same archive
// folder. Before Phase 7 the rule lived in input/README.md and was repeated in
// four specs — a change to one drifted from the others. This slug helper is
// the single definition; the specs reference it instead of restating it.
import { join } from "node:path";

/** The archive root, relative to the repository root. */
export const ARCHIVE_ROOT = "output/applications";

/**
 * `<company>_<role>` — lowercase, underscores for spaces, every non-word
 * character dropped, runs of underscores collapsed, edges trimmed. The result
 * is always one path component, whatever the posting contains.
 */
export function archiveSlug(company: string, role: string): string {
  const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return `${norm(company)}_${norm(role)}`.replace(/_+/g, "_").replace(/^_|_$/g, "");
}

/** The archive folder for one application. */
export function archiveDir(company: string, role: string): string {
  const slug = archiveSlug(company, role);
  if (!slug) throw new Error("archive invalid: company and role must contain at least one letter or digit");
  return join(ARCHIVE_ROOT, slug);
}

/** Archive files are copied from the submitted version, never moved. */
export const ARCHIVE_RULE = "copied, never moved; never overwritten once written";

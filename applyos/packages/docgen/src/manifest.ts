// Origin: clean-room 2026-11-26, Phase 6 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// The Document Manifest.
//
// A generated document carries a machine-checkable list of its factual claims
// and where each came from. `tools/verify_pdf.py --manifest` compares it with
// the extracted text of the *compiled PDF*, so a claim the document never
// delivered — or a claim with no source — fails mechanically.
import type { JobPosting } from "@applyos/core";
import type { ClaimTrace } from "./pack.js";

export const DOCUMENT_MANIFEST_VERSION = 1;

export interface DocumentClaim {
  text: string;
  /** The profile section this claim came from. */
  source?: string;
  grounded: boolean;
}

export interface DocumentManifest {
  documentVersion: number;
  documentType: string;
  posting: { url: string; title: string; company: string };
  profile: string;
  claims: DocumentClaim[];
  /** Claims the Grounding Audit could not source. Empty in a delivered document. */
  ungrounded: string[];
  gaps: string[];
  pageBudget: { document: string; pages: number; required: number };
  ats: { extractable: boolean; chars: number };
}

/** Build the manifest for a finished pack. Every trace becomes a claim. */
export function buildManifest(
  pack: {
    posting: JobPosting;
    traces: ClaimTrace[];
    gaps: string[];
    resumeMarkdown: string;
  },
  options: {
    documentType?: string;
    profilePath?: string;
    pageBudget?: { document: string; pages: number; required: number };
  } = {},
): DocumentManifest {
  const claims: DocumentClaim[] = pack.traces.map((t: ClaimTrace) => ({
    text: t.claim,
    ...(t.source ? { source: t.source } : {}),
    grounded: Boolean(t.source?.trim()),
  }));
  const ungrounded = claims.filter((c) => !c.grounded).map((c) => c.text);
  const posting: JobPosting = pack.posting;
  return {
    documentVersion: DOCUMENT_MANIFEST_VERSION,
    documentType: options.documentType ?? "resume",
    posting: { url: posting.url, title: posting.title, company: posting.company ?? "" },
    profile: options.profilePath ?? "01-candidate-profile.md",
    claims,
    ungrounded,
    gaps: [...pack.gaps],
    pageBudget: options.pageBudget ?? { document: "resume", pages: 1, required: 1 },
    ats: { extractable: pack.resumeMarkdown.trim().length > 0, chars: pack.resumeMarkdown.length },
  };
}

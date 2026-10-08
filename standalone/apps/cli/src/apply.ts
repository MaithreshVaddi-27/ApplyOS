// Origin: clean-room 2026-10-07, own apply flow. Author: OpenCode agent.
import { readFileSync, existsSync } from "node:fs";
import type { JobPosting } from "@applyos/core";
import { runGates, scorePosting, type Candidate } from "@applyos/matching";
import { buildPack, type Profile, type ApplicationPack } from "@applyos/docgen";
import { detectBoard } from "@applyos/company-scraper/detect";
import { detailGreenhouse } from "@applyos/company-scraper/connectors/greenhouse";
import { detailLever } from "@applyos/company-scraper/connectors/lever";
import { detailSmartRecruiters } from "@applyos/company-scraper/connectors/smartrecruiters";
import { detailAmazon } from "@applyos/company-scraper/connectors/amazon";
import { loadRegistry } from "@applyos/company-scraper/registry";

export interface ApplyOptions {
  ref: string;
  profilePath?: string;
  description?: string;
  skills?: string[];
  locations?: string[];
  stage?: Candidate["stage"];
  maxAge?: number;
}

export interface ApplyOutcome {
  pack: ApplicationPack;
  gated: ReturnType<typeof runGates>["gates"];
}

export interface BatchEntry {
  ref: string;
  description?: string;
}

export interface BatchSharedOptions {
  profilePath?: string;
  skills?: string[];
  locations?: string[];
  stage?: Candidate["stage"];
  maxAge?: number;
}

export type BatchItemOutcome =
  | { ref: string; ok: true; pack: ApplicationPack; gated: ReturnType<typeof runGates>["gates"]; elapsedMs: number }
  | { ref: string; ok: false; error: string; code: string; elapsedMs: number };

export interface BatchOutcome {
  items: BatchItemOutcome[];
  built: number;
  failed: number;
  elapsedMs: number;
}

/**
 * Batch packs for S17: one pack per entry, sequential in file order.
 * Sequential (never Promise.all): board-URL entries fetch live ATS pages,
 * and fan-out against employer boards would break the politeness budget.
 * Per-item isolation mirrors the scrape contract — one dead entry never
 * aborts the batch; its failure is a row, not an exception.
 */
export async function runApplyBatch(o: BatchSharedOptions & { entries: BatchEntry[] }): Promise<BatchOutcome> {
  if (!Array.isArray(o.entries) || o.entries.length === 0) {
    throw new Error("batch is empty: --batch <file.json> must hold a non-empty array of {ref, description?}");
  }
  const started = Date.now();
  const items: BatchItemOutcome[] = [];
  for (const entry of o.entries) {
    if (!entry || typeof entry.ref !== "string" || !entry.ref.trim()) {
      throw new Error("batch entry is missing its ref: every entry needs {ref, description?}");
    }
    const itemStarted = Date.now();
    try {
      const { pack, gated } = await runApply({
        ref: entry.ref,
        profilePath: o.profilePath,
        description: entry.description,
        skills: o.skills,
        locations: o.locations,
        stage: o.stage,
        maxAge: o.maxAge,
      });
      items.push({ ref: entry.ref, ok: true, pack, gated, elapsedMs: Date.now() - itemStarted });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const code = /^profile not found/.test(message) ? "profile-not-found" : "apply-failed";
      items.push({ ref: entry.ref, ok: false, error: message, code, elapsedMs: Date.now() - itemStarted });
    }
  }
  return {
    items,
    built: items.filter((i) => i.ok).length,
    failed: items.filter((i) => !i.ok).length,
    elapsedMs: Date.now() - started,
  };
}

function loadProfile(path: string | undefined): Profile {
  if (!path) {
    return {
      name: "Your Name", email: "you@example.com", skills: [], experience: [], education: [],
      summary: "Pass --profile <profile.json> for a tailored pack (Phase 5: ~/.applyos/profile.yaml).",
    };
  }
  if (!existsSync(path)) throw new Error(`profile not found: ${path}`);
  return JSON.parse(readFileSync(path, "utf8")) as Profile;
}

async function resolvePosting(ref: string, fallbackDescription: string): Promise<{ posting: JobPosting; description: string }> {
  const detected = detectBoard(ref);
  if (detected.board === "greenhouse") {
    const slug = detected.slug ?? "";
    const id = ref.match(/(\d+)(?!.*\d)/)?.[1] ?? ref;
    const d = await detailGreenhouse(slug, id);
    return { posting: d, description: d.description };
  }
  if (detected.board === "amazon") {
    const id = ref.match(/(\d{5,})/)?.[1] ?? ref;
    const d = await detailAmazon(id);
    return { posting: d, description: d.description };
  }
  if (detected.board === "lever") {
    const slug = detected.slug ?? "";
    const id = ref.split("/").filter(Boolean).pop() ?? ref;
    const company = loadRegistry().find((e) => e.slug.toLowerCase() === slug.toLowerCase())?.company ?? slug;
    const d = await detailLever(slug, id, company);
    return { posting: d, description: d.description };
  }
  if (detected.board === "smartrecruiters") {
    const slug = ref.match(/smartrecruiters\.com\/([^/]+)/i)?.[1] ?? "";
    const id = ref.match(/([0-9a-f-]{8,})/i)?.[1] ?? ref.split("/").filter(Boolean).pop() ?? ref;
    const company = loadRegistry().find((e) => e.slug.toLowerCase() === slug.toLowerCase())?.company ?? slug;
    const d = await detailSmartRecruiters(company || slug, slug, id);
    return { posting: d, description: d.description };
  }
  if (fallbackDescription) {
    return {
      posting: {
        id: `pasted:${ref.slice(0, 40)}`, title: ref.slice(0, 80), company: "Unknown",
        location: "Unknown", postedDate: null, url: ref, portal: "pasted", source: "fallback",
      },
      description: fallbackDescription,
    };
  }
  throw new Error(
    `cannot resolve posting: ${detected.hint}. Paste the description with --description <text> for boards without a detail connector.`,
  );
}

/** Full single-application flow: resolve → gate → score → tailored pack. */
export async function runApply(o: ApplyOptions): Promise<ApplyOutcome> {
  const profile = loadProfile(o.profilePath);
  const { posting, description } = await resolvePosting(o.ref, o.description ?? "");
  // Empty arrays mean "not given" (CLI flag parsing yields []), so the
  // profile remains the fallback instead of being silently overridden.
  const candidate: Candidate = {
    stage: o.stage ?? "experienced",
    skills: o.skills?.length ? o.skills : profile.skills,
    locations: o.locations?.length ? o.locations : profile.location ? [profile.location] : [],
  };
  const gated = runGates(posting, description, candidate, o.maxAge ?? 90);
  const scored = scorePosting(gated, candidate);
  return { pack: buildPack(posting, description, scored, profile), gated: gated.gates };
}

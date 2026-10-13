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
import { detailWorkday } from "@applyos/company-scraper/connectors/workday";
import { loadRegistry } from "@applyos/company-scraper/registry";

export interface ApplyOptions {
  ref: string;
  profilePath?: string;
  description?: string;
  skills?: string[];
  locations?: string[];
  stage?: Candidate["stage"];
  maxAge?: number;
  /** Batch/stipend/ctc floors. Without these the batch, stipend and ctc gates
   *  cannot fire at all — supply them (or put them in the profile) or those
   *  three of the seven gates are inert. */
  gradYear?: number;
  stipendFloor?: number;
  ctcFloor?: number;
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
  gradYear?: number;
  stipendFloor?: number;
  ctcFloor?: number;
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
  for (const [index, entry] of o.entries.entries()) {
    // Row isolation: a schema-invalid entry is an error row, never an abort —
    // one bad item must not kill the in-order packs around it.
    if (!entry || typeof entry.ref !== "string" || !entry.ref.trim()) {
      items.push({
        ref: typeof (entry as BatchEntry | undefined)?.ref === "string"
          ? (entry as BatchEntry).ref
          : `entry#${index}`,
        ok: false,
        error: "batch entry is missing its ref: every entry needs {ref, description?}",
        code: "batch-file",
        elapsedMs: 0,
      });
      continue;
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
        gradYear: o.gradYear,
        stipendFloor: o.stipendFloor,
        ctcFloor: o.ctcFloor,
      });
      items.push({ ref: entry.ref, ok: true, pack, gated, elapsedMs: Date.now() - itemStarted });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const code = /^profile not found/.test(message)
        ? "profile-not-found"
        : /^profile invalid/.test(message)
          ? "profile-invalid"
          : "apply-failed";
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`profile invalid: ${path} is not valid JSON`);
  }
  // Fail loud at load: a malformed profile must never silently tailor with
  // undefined fields halfway through a batch. Element shapes are checked
  // too: docgen calls .toLowerCase()/.map on skills, bullets, and education.
  const p: unknown = parsed;
  const shapeOk = isRecord(p)
    && typeof p.name === "string" && !!p.name.trim()
    && typeof p.email === "string" && !!p.email.trim()
    && Array.isArray(p.skills) && (p.skills as unknown[]).every((s) => typeof s === "string")
    && Array.isArray(p.experience)
    && (p.experience as unknown[]).every((e) => isExperience(e))
    && Array.isArray(p.education)
    && (p.education as unknown[]).every((e) => isEducation(e));
  if (!shapeOk) {
    throw new Error(`profile invalid: ${path} must define {name, email, skills: string[], experience[{role, company, period, bullets[{text}]}], education[{degree, school}]}`);
  }
  return parsed as Profile;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isExperience(e: unknown): boolean {
  if (!isRecord(e)) return false;
  if (typeof e.role !== "string" || typeof e.company !== "string" || typeof e.period !== "string") return false;
  if (!Array.isArray(e.bullets)) return false;
  return (e.bullets as unknown[]).every((b) => isRecord(b) && typeof b.text === "string");
}

function isEducation(e: unknown): boolean {
  if (!isRecord(e)) return false;
  return typeof e.degree === "string" && typeof e.school === "string";
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
  if (detected.board === "workday") {
    // Slug packs tenant/site/instance (detectBoard workday branch).
    const [tenant = "", site = "", instance = "3"] = (detected.slug ?? "").split("/");
    if (!tenant || !site) throw new Error(`cannot resolve workday posting: no tenant/site in ${ref}`);
    const company = loadRegistry().find(
      (e) => e.board === "workday" && e.slug.toLowerCase().startsWith(`${tenant.toLowerCase()}/`),
    )?.company ?? tenant;
    const d = await detailWorkday(company, { tenant, site, instance: `wd${instance}` }, ref);
    return { posting: d, description: d.description };
  }
  if (fallbackDescription) {
    return {
      posting: {
        id: `pasted:${ref.slice(0, 40)}`, title: ref.slice(0, 80), company: "Unknown",
        // A pasted posting states no location. `null` is the honest value and
        // the one locationGate reports on; the literal string "Unknown" would
        // be a fabricated location that reads like a real place.
        location: null, postedDate: null, url: ref, portal: "pasted", source: "fallback",
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
  // The numeric floors fall back to the profile for the same reason: the
  // batch/stipend/ctc gates read nothing else, and an unpopulated floor makes
  // those three gates silently pass everything.
  const candidate: Candidate = {
    stage: o.stage ?? profile.stage ?? "experienced",
    skills: o.skills?.length ? o.skills : profile.skills,
    locations: o.locations?.length ? o.locations : profile.location ? [profile.location] : [],
    gradYear: o.gradYear ?? profile.gradYear,
    stipendFloor: o.stipendFloor ?? profile.stipendFloor,
    ctcFloor: o.ctcFloor ?? profile.ctcFloor,
  };
  const gated = runGates(posting, description, candidate, o.maxAge ?? 90);
  const scored = scorePosting(gated, candidate);
  return { pack: buildPack(posting, description, scored, profile), gated: gated.gates };
}

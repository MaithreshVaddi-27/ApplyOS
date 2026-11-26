// Origin: clean-room 2026-11-26, Phase 6 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// The candidate profile: ONE schema and ONE reader.
//
// The markdown profile stays the source of truth. This JSON twin is derived
// from it during /setup; it exists so the engine and the document engine read
// the same shape instead of the engine's old ad-hoc object. Validation checks
// shape only — it never judges whether a skill or a claim is real.
import { existsSync, readFileSync } from "node:fs";

export const PROFILE_SCHEMA_VERSION = 1;

export interface ProfileBullet {
  text: string;
  /** The profile section this came from, e.g. "01-candidate-profile.md#achievements". */
  source?: string;
}

export interface Profile {
  schemaVersion?: number;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  summary?: string;
  stage?: "student" | "fresher" | "experienced" | "remote-global";
  graduationYear?: number;
  /** Back-compatible alias used by the engine's gates. */
  gradYear?: number;
  skills: string[];
  experience: { role: string; company: string; period: string; bullets: ProfileBullet[] }[];
  education: { degree: string; school: string; year?: string }[];
  links?: string[];
  documentType?: string;
  salary?: { stipendFloor?: number; ctcFloor?: number };
  stipendFloor?: number;
  ctcFloor?: number;
  source?: { profile: string; generated?: string };
}

export class ProfileError extends Error {
  constructor(message: string) {
    super(`profile invalid: ${message}`);
    this.name = "ProfileError";
  }
}

function record(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** The anonymous fallback used when no --profile is supplied. */
export function defaultProfile(): Profile {
  return {
    name: "Your Name",
    email: "you@example.com",
    skills: [],
    experience: [],
    education: [],
    summary: "Pass --profile <profile.json> for a tailored pack.",
  };
}

export interface ValidationResult {
  profile: Profile;
  /** Grounding gaps, not malformed files: a bullet without a source. */
  warnings: string[];
}

/**
 * Validate a parsed profile. Every failure names the exact field, so a caller
 * can fix it without guessing which of a dozen arrays was wrong.
 */
export function validateProfile(value: unknown, checkSourceFile = true): ValidationResult {
  if (!record(value)) throw new ProfileError("must be an object");

  if (value.schemaVersion !== undefined && value.schemaVersion !== PROFILE_SCHEMA_VERSION) {
    throw new ProfileError(`schemaVersion ${String(value.schemaVersion)} is unsupported (want ${PROFILE_SCHEMA_VERSION})`);
  }
  if (typeof value.name !== "string" || !value.name.trim()) throw new ProfileError("name must be a non-empty string");
  if (typeof value.email !== "string" || !value.email.trim()) throw new ProfileError("email must be a non-empty string");
  for (const key of ["phone", "location", "summary", "documentType"] as const) {
    if (value[key] !== undefined && typeof value[key] !== "string") throw new ProfileError(`${key} must be a string`);
  }
  if (value.stage !== undefined && !["student", "fresher", "experienced", "remote-global"].includes(String(value.stage))) {
    throw new ProfileError(`stage must be one of student|fresher|experienced|remote-global (got ${String(value.stage)})`);
  }
  for (const key of ["graduationYear", "gradYear", "stipendFloor", "ctcFloor"] as const) {
    if (value[key] !== undefined && typeof value[key] !== "number") throw new ProfileError(`${key} must be a number`);
  }

  if (!Array.isArray(value.skills)) throw new ProfileError("skills must be an array of strings");
  value.skills.forEach((s, i) => {
    if (typeof s !== "string") throw new ProfileError(`skills[${i}] must be a string`);
  });

  if (!Array.isArray(value.experience)) throw new ProfileError("experience must be an array");
  const warnings: string[] = [];
  value.experience.forEach((raw, i) => {
    if (!record(raw)) throw new ProfileError(`experience[${i}] must be an object`);
    for (const key of ["role", "company", "period"] as const) {
      if (typeof raw[key] !== "string") throw new ProfileError(`experience[${i}].${key} must be a string`);
    }
    if (!Array.isArray(raw.bullets)) throw new ProfileError(`experience[${i}].bullets must be an array`);
    raw.bullets.forEach((b, j) => {
      if (!record(b)) throw new ProfileError(`experience[${i}].bullets[${j}] must be an object`);
      if (typeof b.text !== "string") throw new ProfileError(`experience[${i}].bullets[${j}].text must be a string`);
      if (b.source !== undefined && typeof b.source !== "string") {
        throw new ProfileError(`experience[${i}].bullets[${j}].source must be a string`);
      }
      if (!b.source) warnings.push(`experience[${i}].bullets[${j}] has no source (grounding gap)`);
    });
  });

  if (!Array.isArray(value.education)) throw new ProfileError("education must be an array");
  value.education.forEach((raw, i) => {
    if (!record(raw)) throw new ProfileError(`education[${i}] must be an object`);
    for (const key of ["degree", "school"] as const) {
      if (typeof raw[key] !== "string") throw new ProfileError(`education[${i}].${key} must be a string`);
    }
    if (raw.year !== undefined && typeof raw.year !== "string") throw new ProfileError(`education[${i}].year must be a string`);
  });

  if (value.links !== undefined) {
    if (!Array.isArray(value.links)) throw new ProfileError("links must be an array of strings");
    value.links.forEach((l, i) => {
      if (typeof l !== "string") throw new ProfileError(`links[${i}] must be a string`);
    });
  }
  if (value.salary !== undefined) {
    if (!record(value.salary)) throw new ProfileError("salary must be an object");
    for (const key of ["stipendFloor", "ctcFloor"] as const) {
      if (value.salary[key] !== undefined && typeof value.salary[key] !== "number") {
        throw new ProfileError(`salary.${key} must be a number`);
      }
    }
  }
  if (value.source !== undefined) {
    if (!record(value.source)) throw new ProfileError("source must be an object");
    if (typeof value.source.profile !== "string" || !value.source.profile.trim()) {
      throw new ProfileError("source.profile must name the markdown profile it was derived from");
    }
    if (value.source.generated !== undefined && typeof value.source.generated !== "string") {
      throw new ProfileError("source.generated must be a string");
    }
    if (checkSourceFile && !existsSync(value.source.profile)) {
      throw new ProfileError(`source.profile "${value.source.profile}" does not exist`);
    }
  }

  return { profile: value as unknown as Profile, warnings };
}

/** Read and validate a profile file; preserves the engine's error prefixes. */
export function loadProfileFile(path: string): ValidationResult {
  if (!existsSync(path)) throw new Error(`profile not found: ${path}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`profile invalid: ${path} is not valid JSON`);
  }
  try {
    return validateProfile(parsed);
  } catch (e) {
    if (e instanceof ProfileError) throw new Error(`profile invalid: ${e.message.slice("profile invalid: ".length)}`);
    throw e;
  }
}

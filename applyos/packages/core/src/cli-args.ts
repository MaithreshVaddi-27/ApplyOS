// Origin: clean-room 2026-10-11, extracted verbatim from apps/cli + company-scraper (identical logic). Author: OpenCode agent.
import type { CandidateStage } from "./types";
import { parseNumArg } from "./fetch";

export const STAGES: CandidateStage[] = ["student", "fresher", "experienced", "remote-global"];
export const DOC_TYPES = ["jobs", "internships", "all"] as const;
export type DocType = (typeof DOC_TYPES)[number];

/** Raw argv lookup. A flag-like next token means the value was forgotten: fail loudly. */
export function cliArg(flag: string, short?: string): string | undefined {
  const i = process.argv.findIndex((a) => a === flag || (short && a === short));
  if (i < 0) return undefined;
  const value = process.argv[i + 1];
  if (value === undefined || /^--?[a-z]/i.test(value)) {
    cliFail("missing-arg", `${process.argv[i]} requires a value`);
  }
  return value;
}

/** Via core clamp: negatives → 1, NaN → fallback, 0 keeps its "no cap" meaning. */
export function cliNumArg(flag: string, short: string | undefined, fallback: number, max: number): number {
  return parseNumArg(cliArg(flag, short), fallback, max);
}

/** Loud failure envelope: stderr {error, code} + exit 1, stdout stays empty. */
export function cliFail(code: string, error: string): never {
  process.stderr.write(JSON.stringify({ error, code }) + "\n");
  process.exit(1);
}

export function cliFormat(): "json" | "table" | "plain" {
  const f = (cliArg("--format") ?? "table").toLowerCase();
  return f === "json" ? "json" : f === "plain" ? "plain" : "table";
}

/** Validated --stage (undefined when absent); anything else fails loudly. */
export function cliStage(v: string | undefined): CandidateStage | undefined {
  if (v && !(STAGES as string[]).includes(v)) {
    cliFail("bad-stage", `--stage must be ${STAGES.join("|")} (got ${v})`);
  }
  return v as CandidateStage | undefined;
}

/** Validated --type (defaults to "all"); anything else fails loudly. */
export function cliType(v: string | undefined): DocType {
  const t = v ?? "all";
  if (!(DOC_TYPES as readonly string[]).includes(t)) {
    cliFail("bad-type", `--type must be ${(DOC_TYPES as readonly string[]).join("|")} (got ${v})`);
  }
  return t as DocType;
}

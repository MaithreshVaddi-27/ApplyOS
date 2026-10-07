// Origin: clean-room 2026-10-07, own pack design. Author: OpenCode agent.
import type { JobPosting } from "../../core/src/index";
import type { ScoredPosting } from "../../matching/src/index";

/** Candidate profile — explicit object (file wiring lands in Phase 5). */
export interface Profile {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  summary?: string;
  skills: string[];
  experience: {
    role: string;
    company: string;
    period: string;
    bullets: { text: string; source: string }[];
  }[];
  education: { degree: string; school: string; year?: string }[];
  links?: string[];
}

export interface ClaimTrace {
  claim: string;
  /** Where in the profile this came from, e.g. "experience[0].bullets[2]". */
  source: string;
}

export interface ApplicationPack {
  posting: JobPosting;
  score: number;
  verdict: ScoredPosting["verdict"];
  /** Tailored resume in Markdown (PDF step renders from this in Phase 5). */
  resumeMarkdown: string;
  /** Short portal free-text pitch (≤600 chars). */
  pitch: string;
  /** Follow-up draft (never auto-sent). */
  followUp: string;
  /** Every resume bullet traced to its profile source. */
  traces: ClaimTrace[];
  /** Posting keywords the profile does not cover — visible gaps, never stuffed. */
  gaps: string[];
}

function words(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").split(/\s+/).filter((w) => w.length > 3);
}

/** Posting keywords (title-weighted) the profile covers or misses. */
export function keywordGaps(title: string, description: string, skills: string[]): { covered: string[]; missing: string[] } {
  // Function words that are never real gaps — kept out of the missing list.
  const noise = new Set([
    "with", "will", "from", "have", "this", "that", "team", "work", "role",
    "your", "their", "join", "help", "strong", "passion", "driven", "ideal",
    "looking", "hiring", "dynamic", "growing", "every", "their", "about",
    "into", "across", "through", "more", "than", "also", "such",
  ]);
  const freq = new Map<string, number>();
  for (const w of words(`${title} ${title}`)) freq.set(w, (freq.get(w) ?? 0) + 2);
  for (const w of words(description)) freq.set(w, (freq.get(w) ?? 0) + 1);
  const prof = new Set(skills.map((s) => s.toLowerCase()));
  const covered: string[] = [];
  const missing: string[] = [];
  for (const [w] of [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    const hit = [...prof].some((s) => s.includes(w) || w.includes(s));
    (hit ? covered : missing).push(w);
  }
  return { covered, missing: missing.filter((m) => !noise.has(m)).slice(0, 5) };
}

/** Order profile bullets by posting-keyword hits; keep source refs. Unmatched tail preserved. */
export function selectBullets(
  bullets: { text: string; source: string }[],
  keywords: string[],
  take: number,
): { text: string; source: string }[] {
  const scored = bullets.map((b) => ({
    b,
    hits: keywords.filter((k) => b.text.toLowerCase().includes(k)).length,
  }));
  scored.sort((a, b) => b.hits - a.hits);
  return scored.slice(0, take).map((s) => s.b);
}

/** Build the full pack. Selection and ordering only — every line traces to the profile. */
export function buildPack(
  posting: JobPosting,
  description: string,
  scored: ScoredPosting,
  profile: Profile,
): ApplicationPack {
  const { covered, missing } = keywordGaps(posting.title, description, profile.skills);
  const orderedSkills = [...profile.skills].sort((a, b) => {
    const ah = covered.includes(a.toLowerCase()) ? 0 : 1;
    const bh = covered.includes(b.toLowerCase()) ? 0 : 1;
    return ah - bh;
  });

  const traces: ClaimTrace[] = [];
  const expSections = profile.experience.map((e, ei) => {
    const picked = selectBullets(
      e.bullets.map((b, bi) => ({ ...b, source: `experience[${ei}].bullets[${bi}]` })),
      covered,
      4,
    );
    for (const p of picked) traces.push({ claim: p.text, source: p.source });
    return `### ${e.role} — ${e.company} (${e.period})\n${picked.map((p) => `- ${p.text}`).join("\n")}`;
  }).join("\n\n");

  const resumeMarkdown = [
    `# ${profile.name}`,
    [profile.email, profile.phone, profile.location].filter(Boolean).join(" · "),
    "",
    profile.summary ? `${profile.summary}\n` : "",
    "## Skills",
    orderedSkills.join(", "),
    "",
    "## Experience",
    expSections,
    "",
    "## Education",
    ...profile.education.map((e) => `- ${e.degree}, ${e.school}${e.year ? ` (${e.year})` : ""}`),
    ...(profile.links?.length ? ["", "## Links", ...profile.links.map((l) => `- ${l}`)] : []),
  ].filter((l) => l !== undefined).join("\n");

  const pitch =
    `Applying for ${posting.title} at ${posting.company}: ` +
    (covered.length
      ? `my strongest matches are ${covered.slice(0, 3).join(", ")}.`
      : `my background is a growth fit for this role.`) +
    ` ${profile.summary ?? ""}`.slice(0, 600);

  const followUp =
    `Hi — I applied for ${posting.title} at ${posting.company} a week ago and wanted to briefly follow up. ` +
    `The role matches my work in ${(covered.slice(0, 2).join(" and ") || "this area")}. Happy to share anything useful. Thanks!`;

  return { posting, score: scored.score, verdict: scored.verdict, resumeMarkdown, pitch: pitch.slice(0, 600), followUp, traces, gaps: missing };
}

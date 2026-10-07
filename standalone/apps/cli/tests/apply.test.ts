// Origin: clean-room 2026-10-07, pasted-description path (no network). Author: OpenCode agent.
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runApply } from "../src/apply";

async function withProfile<T>(profile: object, run: (profilePath: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "applyos-profile-test-"));
  const profilePath = join(directory, "profile.json");
  await writeFile(profilePath, JSON.stringify(profile));
  try {
    return await run(profilePath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const testProfile = {
  name: "Test Candidate",
  email: "t@example.com",
  skills: ["python", "backend"],
  experience: [
    {
      role: "Backend Intern", company: "Acme", period: "2025",
      bullets: [{ text: "Built python APIs", source: "s" }],
    },
  ],
  education: [{ degree: "B.Tech", school: "U" }],
};

describe("runApply (pasted description, offline)", () => {
  test("builds a traced pack with visible gaps", async () => {
    await withProfile(testProfile, async (profilePath) => {
      const { pack, gated } = await runApply({
        ref: "https://example.com/jobs/123",
        profilePath,
        description: "Python backend intern role with kubernetes and docker. Stipend ₹30000 per month.",
        stage: "student",
      });
      expect(pack.resumeMarkdown).toContain("Test Candidate");
      expect(pack.traces.length).toBeGreaterThan(0);
      expect(pack.gaps).toContain("kubernetes");
      expect(gated.some((g) => g.gate === "stale")).toBe(true);
    });
  });

  test("missing profile file fails loudly", async () => {
    await expect(runApply({ ref: "https://example.com/x", profilePath: "/no/such.json", description: "x" })).rejects.toThrow("profile not found");
  });

  test("empty skills/locations arrays fall back to the profile", async () => {
    await withProfile(testProfile, async (profilePath) => {
      const { pack } = await runApply({
        ref: "https://example.com/jobs/124",
        profilePath,
        description: "python backend role",
        skills: [],
        locations: [],
        stage: "experienced",
      });
      // Profile skills (python, backend) must survive the empty-array override:
      // with them, the pitch names matches; without, it falls back to "growth fit".
      expect(pack.pitch).toContain("strongest matches");
    });
  });

  test("does not keep generated profile data in the test tree", () => {
    expect(existsSync(join(import.meta.dir, "profile.fixture.json"))).toBe(false);
  });
});

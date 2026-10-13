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

  test("malformed profile JSON fails loud profile-invalid at load", async () => {
    const directory = await mkdtemp(join(tmpdir(), "applyos-badprofile-test-"));
    try {
      const notJson = join(directory, "bad.json");
      await writeFile(notJson, "{not json");
      await expect(runApply({ ref: "https://example.com/x", profilePath: notJson, description: "x" })).rejects.toThrow(/profile invalid/);
      const wrongShape = join(directory, "shape.json");
      await writeFile(wrongShape, JSON.stringify({ name: "No Email" }));
      await expect(runApply({ ref: "https://example.com/x", profilePath: wrongShape, description: "x" })).rejects.toThrow(/profile invalid/);
      const badSkill = join(directory, "skill.json");
      await writeFile(badSkill, JSON.stringify({ ...testProfile, skills: ["python", 42] }));
      await expect(runApply({ ref: "https://example.com/x", profilePath: badSkill, description: "x" })).rejects.toThrow(/profile invalid/);
      const badBullet = join(directory, "bullet.json");
      await writeFile(badBullet, JSON.stringify({ ...testProfile, experience: [{ role: "R", company: "C", period: "2025", bullets: [{ text: 7 }] }] }));
      await expect(runApply({ ref: "https://example.com/x", profilePath: badBullet, description: "x" })).rejects.toThrow(/profile invalid/);
      const badEdu = join(directory, "edu.json");
      await writeFile(badEdu, JSON.stringify({ ...testProfile, education: [{ degree: "B.Tech" }] }));
      await expect(runApply({ ref: "https://example.com/x", profilePath: badEdu, description: "x" })).rejects.toThrow(/profile invalid/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
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

  test("batch/stipend/ctc floors from options make those gates fire", async () => {
    // Without the floors these three gates cannot run at all, so the pack would
    // carry no trace of an exclusive batch or a below-floor stipend.
    await withProfile(testProfile, async (profilePath) => {
      const { gated } = await runApply({
        ref: "https://example.com/jobs/125",
        profilePath,
        description: "Only 2024 batch graduates. Stipend 5000 per month.",
        skills: ["python"],
        locations: ["Bengaluru"],
        stage: "student",
        gradYear: 2026,
        stipendFloor: 15000,
      });
      const byGate = Object.fromEntries(gated.map((g) => [g.gate, g.verdict]));
      expect(byGate.batch).toBe("FAIL");
      expect(byGate.stipend).toBe("FAIL");
    });
  });

  test("floors fall back to the profile when the flag is absent", async () => {
    const withFloors = { ...testProfile, stage: "student", gradYear: 2026, stipendFloor: 15000 };
    await withProfile(withFloors, async (profilePath) => {
      const { gated } = await runApply({
        ref: "https://example.com/jobs/126",
        profilePath,
        description: "Only 2024 batch graduates. Stipend 5000 per month.",
        skills: ["python"],
        locations: ["Bengaluru"],
      });
      const byGate = Object.fromEntries(gated.map((g) => [g.gate, g.verdict]));
      expect(byGate.batch).toBe("FAIL");
      expect(byGate.stipend).toBe("FAIL");
    });
  });

  test("a pasted posting states no location rather than the string Unknown", async () => {
    await withProfile(testProfile, async (profilePath) => {
      const { pack, gated } = await runApply({
        ref: "https://example.com/jobs/127",
        profilePath,
        description: "python backend role",
        locations: ["Bengaluru"],
      });
      expect(pack.posting.location).toBeNull();
      const location = gated.find((g) => g.gate === "location");
      expect(location?.verdict).toBe("FAIL");
      expect(location?.note).toMatch(/unstated/);
    });
  });
});

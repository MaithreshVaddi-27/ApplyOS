// Origin: clean-room 2026-10-07, pasted-description path (no network). Author: OpenCode agent.
import { describe, expect, test } from "bun:test";
import { runApply } from "../src/apply";

describe("runApply (pasted description, offline)", () => {
  test("builds a traced pack with visible gaps", async () => {
    const profile = {
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
    const path = `${import.meta.dir}/profile.fixture.json`;
    await Bun.write(path, JSON.stringify(profile));
    const { pack, gated } = await runApply({
      ref: "https://example.com/jobs/123",
      profilePath: path,
      description: "Python backend intern role with kubernetes and docker. Stipend ₹30000 per month.",
      stage: "student",
    });
    expect(pack.resumeMarkdown).toContain("Test Candidate");
    expect(pack.traces.length).toBeGreaterThan(0);
    expect(pack.gaps).toContain("kubernetes");
    expect(gated.some((g) => g.gate === "stale")).toBe(true);
  });

  test("missing profile file fails loudly", async () => {
    await expect(runApply({ ref: "https://example.com/x", profilePath: "/no/such.json", description: "x" })).rejects.toThrow("profile not found");
  });

  test("empty skills/locations arrays fall back to the profile", async () => {
    const path = `${import.meta.dir}/profile.fixture.json`;
    const { pack } = await runApply({
      ref: "https://example.com/jobs/124",
      profilePath: path,
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

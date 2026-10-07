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
});

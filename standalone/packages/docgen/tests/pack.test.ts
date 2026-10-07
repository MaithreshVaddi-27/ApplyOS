// Origin: clean-room 2026-10-07, own fixtures, no network. Author: OpenCode agent.
import { describe, expect, test } from "bun:test";
import { buildPack, keywordGaps, selectBullets, type Profile } from "../src/pack";

const profile: Profile = {
  name: "Test Candidate",
  email: "test@example.com",
  skills: ["python", "backend", "cobol"],
  experience: [
    {
      role: "Backend Intern", company: "Acme", period: "2025",
      bullets: [
        { text: "Built python APIs serving 1k rps", source: "x" },
        { text: "Organized team events", source: "x" },
      ],
    },
  ],
  education: [{ degree: "B.Tech", school: "Test University", year: "2026" }],
};

describe("docgen", () => {
  test("keywordGaps splits covered/missing", () => {
    const { covered, missing } = keywordGaps("Python Backend Intern", "python backend role with kubernetes", profile.skills);
    expect(covered).toContain("python");
    expect(missing).toContain("kubernetes");
    expect(missing).not.toContain("python");
  });
  test("selectBullets ranks keyword hits first, keeps sources", () => {
    const picked = selectBullets(profile.experience[0].bullets, ["python"], 2);
    expect(picked[0].text).toContain("python");
    expect(picked[0].source).toBe("x"); // passthrough; buildPack rewrites to experience[i].bullets[j]
  });
  test("buildPack traces every bullet and never invents", () => {
    const pack = buildPack(
      { id: "1", title: "Python Backend Intern", company: "Acme", location: "Bengaluru", postedDate: null, url: "https://x", portal: "mock", source: "adapter" },
      "python backend role",
      { posting: {} as never, score: 80, verdict: "strong fit", strengths: [], gaps: [] },
      profile,
    );
    expect(pack.traces.length).toBeGreaterThan(0);
    for (const t of pack.traces) {
      expect(t.source).toMatch(/^experience\[\d+\]\.bullets\[\d+\]$/);
    }
    // Full profile text is preserved somewhere traceable — nothing dropped silently.
    expect(pack.resumeMarkdown).toContain("Test Candidate");
    expect(pack.resumeMarkdown).toContain("Built python APIs");
    expect(pack.pitch.length).toBeLessThanOrEqual(600);
    expect(pack.followUp.length).toBeGreaterThan(0);
  });
  test("matched skills sort first", () => {
    const pack = buildPack(
      { id: "1", title: "Python role", company: "A", location: "X", postedDate: null, url: "https://x", portal: "m", source: "adapter" },
      "python job", { posting: {} as never, score: 50, verdict: "good fit", strengths: [], gaps: [] }, profile,
    );
    const skillsLine = pack.resumeMarkdown.split("\n").find((l) => l.includes("python")) ?? "";
    expect(skillsLine.indexOf("python")).toBeLessThan(skillsLine.indexOf("cobol"));
  });
});

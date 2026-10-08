// Origin: clean-room 2026-10-08, batch packs (S17, TDD red first). Author: OpenCode agent.
import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runApplyBatch } from "../src/apply";

async function withProfile<T>(profile: object, run: (profilePath: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "applyos-batch-test-"));
  const profilePath = join(directory, "profile.json");
  await writeFile(profilePath, JSON.stringify(profile));
  try {
    return await run(profilePath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const testProfile = {
  name: "Batch Candidate",
  email: "b@example.com",
  skills: ["python", "backend"],
  experience: [
    {
      role: "Backend Intern", company: "Acme", period: "2025",
      bullets: [{ text: "Built python APIs", source: "s" }],
    },
  ],
  education: [{ degree: "B.Tech", school: "U" }],
};

const desc = (extra: string) => `Python backend role. ${extra}`;

describe("runApplyBatch (offline, pasted descriptions)", () => {
  test("builds one traced pack per entry, in file order", async () => {
    await withProfile(testProfile, async (profilePath) => {
      const out = await runApplyBatch({
        entries: [
          { ref: "https://example.com/jobs/b1", description: desc("Stipend ₹30000 per month.") },
          { ref: "https://example.com/jobs/b2", description: desc("Remote friendly team.") },
        ],
        profilePath,
        stage: "student",
      });
      expect(out.items.length).toBe(2);
      expect(out.built).toBe(2);
      expect(out.failed).toBe(0);
      expect(out.items[0].ref).toBe("https://example.com/jobs/b1");
      expect(out.items[1].ref).toBe("https://example.com/jobs/b2");
      for (const item of out.items) {
        expect(item.ok).toBe(true);
        if (item.ok) {
          expect(item.pack.resumeMarkdown).toContain("Batch Candidate");
          expect(item.pack.traces.length).toBeGreaterThan(0);
        }
      }
    });
  });

  test("one unresolvable entry becomes an error row, the batch still completes", async () => {
    await withProfile(testProfile, async (profilePath) => {
      const out = await runApplyBatch({
        entries: [
          { ref: "https://example.com/jobs/good", description: desc("Nice role.") },
          // No description and not a supported board URL: cannot resolve.
          { ref: "https://unresolvable-board.example/jobs/xyz" },
        ],
        profilePath,
        stage: "experienced",
      });
      expect(out.built).toBe(1);
      expect(out.failed).toBe(1);
      expect(out.items[1].ok).toBe(false);
      if (!out.items[1].ok) {
        expect(out.items[1].error).toMatch(/cannot resolve posting/);
      }
    });
  });

  test("empty batch fails loudly instead of returning an empty envelope", async () => {
    await expect(runApplyBatch({ entries: [] })).rejects.toThrow(/non-empty/i);
  });

  test("entry without a ref fails loudly", async () => {
    await expect(runApplyBatch({ entries: [{ ref: "" }] })).rejects.toThrow(/ref/i);
  });
});

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

  test("schema-invalid entries become error rows, the batch still completes", async () => {
    await withProfile(testProfile, async (profilePath) => {
      const out = await runApplyBatch({
        entries: [
          { ref: "https://example.com/jobs/good", description: desc("Nice role.") },
          { ref: "" },
          { ref: "https://example.com/jobs/good2", description: desc("Nice role.") },
        ],
        profilePath,
        stage: "experienced",
      });
      expect(out.built).toBe(2);
      expect(out.failed).toBe(1);
      expect(out.items[1].ok).toBe(false);
      if (!out.items[1].ok) {
        expect(out.items[1].error).toMatch(/ref/i);
        expect(out.items[1].code).toBe("batch-file");
      }
      // Order preserved: valid packs around the bad row still built.
      expect(out.items[0].ok).toBe(true);
      expect(out.items[2].ok).toBe(true);
    });
  });

  test("a mid-batch fetch failure becomes an error row, the batch still completes", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    try {
      await withProfile(testProfile, async (profilePath) => {
        const out = await runApplyBatch({
          entries: [
            { ref: "https://example.com/jobs/good", description: desc("Nice role.") },
            // Resolvable board URL, no pasted description: must fetch, which fails.
            { ref: "https://job-boards.greenhouse.io/groww/jobs/1" },
            { ref: "https://example.com/jobs/good2", description: desc("Nice role.") },
          ],
          profilePath,
          stage: "experienced",
        });
        expect(out.built).toBe(2);
        expect(out.failed).toBe(1);
        expect(out.items[1].ok).toBe(false);
        expect(out.items[0].ok).toBe(true);
        expect(out.items[2].ok).toBe(true);
      });
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

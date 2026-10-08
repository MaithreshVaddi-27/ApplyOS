// Origin: clean-room 2026-10-08, apply --batch CLI contract (S17). Author: OpenCode agent.
import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cliPath = join(import.meta.dir, "..", "src", "cli.ts");
const cliDirectory = join(import.meta.dir, "..");

async function withBatchFile<T>(content: string, run: (path: string) => T): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "applyos-batch-cli-"));
  const filePath = join(directory, "batch.json");
  await writeFile(filePath, content);
  try {
    return await run(filePath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function runCli(...args: string[]) {
  return spawnSync(process.execPath, ["run", cliPath, ...args], {
    cwd: cliDirectory, encoding: "utf8", timeout: 60_000,
  });
}

test("missing batch file fails loudly with exit 1", async () => {
  const result = runCli("apply", "--batch", "/no/such-batch.json", "--format", "json");
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(JSON.parse(result.stderr)).toEqual({
    error: expect.stringMatching(/batch file/i),
    code: "batch-file",
  });
});

test("invalid batch JSON fails loudly with exit 1", async () => {
  await withBatchFile("{not valid json", async (filePath) => {
    const result = runCli("apply", "--batch", filePath, "--format", "json");
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stderr).code).toBe("batch-file");
  });
});

test("mixed batch returns an envelope and exits 0 while a pack was built", async () => {
  await withBatchFile(
    JSON.stringify([
      { ref: "https://example.com/jobs/cli-good", description: "Python backend role with testing." },
      { ref: "https://unresolvable-board.example/jobs/xyz" },
    ]),
    async (filePath) => {
      const result = runCli("apply", "--batch", filePath, "--stage", "experienced", "--format", "json");
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      const body = JSON.parse(result.stdout);
      expect(body.items.length).toBe(2);
      expect(body.built).toBe(1);
      expect(body.failed).toBe(1);
      expect(body.items[0].ok).toBe(true);
      expect(body.items[1].ok).toBe(false);
      expect(typeof body.elapsedMs).toBe("number");
    },
  );
});

test("batch with zero packs built exits 1", async () => {
  await withBatchFile(
    JSON.stringify([{ ref: "https://unresolvable-board.example/jobs/xyz" }]),
    async (filePath) => {
      const result = runCli("apply", "--batch", filePath, "--format", "json");
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).failed).toBe(1);
    },
  );
});

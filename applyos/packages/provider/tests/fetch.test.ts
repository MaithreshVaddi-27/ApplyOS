// Phase 11.4 — a per-request timeout is not a timeout; the whole operation needs one.
import { expect, test } from "bun:test";
import { providerFetch } from "../src/fetch";

const slow = (async () => {
  await new Promise((r) => setTimeout(r, 200));
  return { status: 200, ok: true, text: async () => "ok", json: async () => ({}) };
}) as unknown as typeof fetch;

test("a total deadline fires before a slow first attempt returns", async () => {
  const started = Date.now();
  let message = "";
  try {
    await providerFetch("https://example.test/x", { deadlineMs: 10, fetchImpl: slow });
  } catch (e) {
    message = e instanceof Error ? e.message : String(e);
  }
  expect(message).toContain("deadline");
  expect(Date.now() - started).toBeLessThan(150);
});

test("a deadline blocks a retry before it sleeps again", async () => {
  let calls = 0;
  const failing = (async () => {
    calls++;
    throw new Error("network");
  }) as unknown as typeof fetch;
  let message = "";
  try {
    await providerFetch("https://example.test/x", {
      deadlineMs: 1,
      attempts: 5,
      sleep: async () => {},
      fetchImpl: failing,
    });
  } catch (e) {
    message = e instanceof Error ? e.message : String(e);
  }
  expect(message).toContain("deadline");
  expect(calls).toBeLessThanOrEqual(1);
});

test("no deadline preserves the ordinary retry policy", async () => {
  let calls = 0;
  const flaky = (async () => {
    calls++;
    if (calls === 1) throw new Error("network");
    return { status: 200, ok: true, text: async () => "ok", json: async () => ({}) };
  }) as unknown as typeof fetch;
  const res = await providerFetch("https://example.test/x", {
    attempts: 2,
    sleep: async () => {},
    fetchImpl: flaky,
  });
  expect(res.status).toBe(200);
  expect(calls).toBe(2);
});

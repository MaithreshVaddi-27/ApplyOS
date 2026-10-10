// Origin: clean-room 2026-10-09, S-M2 loud-fail fix. Offline only (data: URL + refused port).
import { describe, expect, test, afterEach } from "bun:test";
import { fetchText, fetchJson, UA } from "../src/fetch";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("fetchText", () => {
  test("returns body text with timeout and retry budget", async () => {
    const { text, attempts } = await fetchText("data:text/plain,hello");
    expect(text).toBe("hello");
    expect(attempts).toBe(1);
  });
  test("throws after retries when every attempt fails", async () => {
    let error = "";
    try {
      await fetchText("http://127.0.0.1:1/", { timeoutMs: 500 });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    expect(error).toContain("http://127.0.0.1:1/");
  });
  test("canonical UA identifies personal-use traffic", () => {
    expect(UA).toContain("applyos");
  });
  test("a hanging response body cannot outlive the timeout", async () => {
    // Stub a 200 with a body that never yields a byte: without the body
    // parse inside the abort race this would hang past the timeout budget.
    globalThis.fetch = (async () =>
      new Response(new ReadableStream({}), { status: 200 })) as unknown as typeof fetch;
    const started = Date.now();
    let error = "";
    try {
      await fetchJson("https://example.com/hanging", { timeoutMs: 200, retries: 0 });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    expect(error).not.toBe("");
    expect(Date.now() - started).toBeLessThan(5000);
  });
});

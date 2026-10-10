// Origin: clean-room 2026-10-09, S-M2 loud-fail fix. Offline only (data: URL + refused port).
import { describe, expect, test } from "bun:test";
import { fetchText, UA } from "../src/fetch";

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
});

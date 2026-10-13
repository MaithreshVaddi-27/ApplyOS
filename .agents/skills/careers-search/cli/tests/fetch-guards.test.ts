// Offline guard tests for the shared fetch helpers and the connector loop
// bounds. These stub globalThis.fetch and assert on what would go out on the
// wire - no network.

import { describe, expect, test, afterEach } from "bun:test"
import { fetchJson, fetchText, USER_AGENT } from "../src/helpers.js"

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

function captureFetch(): { calls: Array<{ url: string; init: RequestInit }> } {
  const calls: Array<{ url: string; init: RequestInit }> = []
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }) as typeof fetch
  return { calls }
}

describe("fetch header merge", () => {
  test("caller headers do not drop the User-Agent (fetchJson)", async () => {
    // REGRESSION: `...init` was spread after `headers`, so any caller passing
    // init.headers replaced the whole object and the request went out with no
    // User-Agent at all. The ashby, salesforce and workday POST connectors all
    // pass init.headers.
    // Signature is positional: fetchJson(url, init, timeoutMs, retries).
    const { calls } = captureFetch()
    await fetchJson(
      "https://example.com/jobs",
      { method: "POST", headers: { "content-type": "application/json" } },
      20000,
      0,
    )
    expect(calls.length).toBe(1)
    const sent = calls[0].init.headers as Record<string, string>
    expect(sent["user-agent"]).toBe(USER_AGENT)
    expect(sent["content-type"]).toBe("application/json")
    expect(sent["accept"]).toContain("application/json")
  })

  test("caller headers do not drop the User-Agent (fetchText)", async () => {
    let captured: RequestInit = {}
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      captured = init
      return new Response("<html></html>", { status: 200 })
    }) as typeof fetch
    await fetchText(
      "https://example.com/board",
      { headers: { "x-custom": "1" } },
      20000,
      0,
    )
    const sent = captured.headers as Record<string, string>
    expect(sent["user-agent"]).toBe(USER_AGENT)
    expect(sent["x-custom"]).toBe("1")
    expect(sent["accept-language"]).toBe("en-US,en;q=0.9")
  })

  test("a caller can still override a default header", async () => {
    const { calls } = captureFetch()
    await fetchJson(
      "https://example.com/jobs",
      { headers: { accept: "application/vnd.custom" } },
      20000,
      0,
    )
    const sent = calls[0].init.headers as Record<string, string>
    expect(sent.accept).toBe("application/vnd.custom")
    expect(sent["user-agent"]).toBe(USER_AGENT)
  })
})

describe("every connector treats maxPages 0 as 'all pages'", () => {
  // REGRESSION: the salesforce connector used `for (let i = 0; i < maxPages; i++)`
  // while the other seven used `maxPages > 0 ? maxPages : 500`. With the
  // documented default of 0, salesforce ran zero iterations and returned no
  // rows at all, reported as an ordinary "no matches".
  test("source uses the shared maxLoops guard", async () => {
    const src = await Bun.file(
      new URL("../src/connectors/enterprise.ts", import.meta.url),
    ).text()
    expect(src).toContain("const maxLoops = maxPages > 0 ? maxPages : 500")
    // The unguarded form must not reappear.
    expect(src).not.toMatch(/for \(let i = 0; i < maxPages; i\+\+\)/)
  })
})
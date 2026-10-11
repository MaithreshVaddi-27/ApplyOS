import { afterEach, describe, expect, test } from "bun:test"
import { runSearch } from "../src/commands/search.js"

// Offline runSearch tests: stub global fetch, capture stdio. No network access.

const realFetch = globalThis.fetch
const realStdout = process.stdout.write
const realStderr = process.stderr.write

afterEach(() => {
  globalThis.fetch = realFetch
  process.stdout.write = realStdout
  process.stderr.write = realStderr
})

function stubFetch(handler: (url: string) => Response): void {
  globalThis.fetch = (async (url: unknown) => handler(String(url))) as unknown as typeof fetch
}

function capture(): { out: string[]; err: string[] } {
  const out: string[] = []
  const err: string[] = []
  process.stdout.write = ((c: string | Uint8Array) => {
    out.push(c.toString())
    return true
  }) as typeof process.stdout.write
  process.stderr.write = ((c: string | Uint8Array) => {
    err.push(c.toString())
    return true
  }) as typeof process.stderr.write
  return { out, err }
}

const opts = { category: "reactjs-jobs", format: "json", limit: 5 } as const

describe("runSearch offline", () => {
  test("404 category page exits 1 with NOT_FOUND", async () => {
    stubFetch(() => new Response("missing", { status: 404 }))
    const { err } = capture()
    const code = await runSearch({ ...opts })
    expect(code).toBe(1)
    expect(JSON.parse(err.join(""))).toMatchObject({ code: "NOT_FOUND" })
  })

  test("payload-less shell exits 1 with PARSE_EMPTY, never empty success", async () => {
    stubFetch(() => new Response("<html><body>empty shell</body></html>", { status: 200 }))
    const { err } = capture()
    const code = await runSearch({ ...opts })
    expect(code).toBe(1)
    expect(JSON.parse(err.join(""))).toMatchObject({ code: "PARSE_EMPTY" })
  })

  test("fetch throw exits 1 with SEARCH_FAILED", async () => {
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED")
    }) as unknown as typeof fetch
    const { err } = capture()
    const code = await runSearch({ ...opts })
    expect(code).toBe(1)
    expect(JSON.parse(err.join(""))).toMatchObject({ code: "SEARCH_FAILED" })
  })
})

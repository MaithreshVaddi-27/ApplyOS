import { describe, expect, test } from "bun:test"
// The listing-page parser lives in the provider SDK now. It is named
// parseRemoteOkJsonLd because that is what it reads: a JSON-LD JobPosting
// block, and nothing else.
import { parseRemoteOkJsonLd } from "../src/helpers.js"

describe("remoteok detail honesty (P-B1)", () => {
  test("page without JobPosting schema returns null (PARSE_ERROR, never invented rows)", () => {
    const html = `<html><head><title>Senior Backend Engineer at Acme Corp</title></head><body><h1>Senior Backend Engineer</h1><p>Great role.</p></body></html>`
    expect(parseRemoteOkJsonLd(html, "https://remoteok.com/remote-jobs/123", "123")).toBeNull()
  })
  test("empty page returns null", () => {
    expect(parseRemoteOkJsonLd("<html></html>", "https://remoteok.com/remote-jobs/123", "123")).toBeNull()
  })
  test("JobPosting JSON-LD still parses with honest fields", () => {
    const html = `<html><head><script type="application/ld+json">{"@type":"JobPosting","title":"Dev","hiringOrganization":{"name":"Acme"},"description":"<p>Work</p>","datePosted":"2026-10-01"}</script></head></html>`
    const d = parseRemoteOkJsonLd(html, "https://remoteok.com/remote-jobs/123", "123")
    expect(d).not.toBeNull()
    expect(d!.title).toBe("Dev")
    expect(d!.company).toBe("Acme")
    // The page stated no place, so the answer is null - not an empty string.
    expect(d!.location).toBeNull()
    expect(d!.date).toBe("2026-10-01")
  })
})

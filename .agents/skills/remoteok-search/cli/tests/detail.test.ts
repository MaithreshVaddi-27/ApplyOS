import { describe, expect, test } from "bun:test"
import { parseDetailFromHtml } from "../src/commands/detail.js"

describe("remoteok detail honesty (P-B1)", () => {
  test("page without JobPosting schema returns null (PARSE_ERROR, never invented rows)", () => {
    const html = `<html><head><title>Senior Backend Engineer at Acme Corp</title></head><body><h1>Senior Backend Engineer</h1><p>Great role.</p></body></html>`
    expect(parseDetailFromHtml(html, "https://remoteok.com/remote-jobs/123", "123")).toBeNull()
  })
  test("empty page returns null", () => {
    expect(parseDetailFromHtml("<html></html>", "https://remoteok.com/remote-jobs/123", "123")).toBeNull()
  })
  test("JobPosting JSON-LD still parses with honest fields", () => {
    const html = `<html><head><script type="application/ld+json">{"@type":"JobPosting","title":"Dev","hiringOrganization":{"name":"Acme"},"description":"<p>Work</p>","datePosted":"2026-10-01"}</script></head></html>`
    const d = parseDetailFromHtml(html, "https://remoteok.com/remote-jobs/123", "123")
    expect(d).not.toBeNull()
    expect(d!.title).toBe("Dev")
    expect(d!.company).toBe("Acme")
    expect(d!.location).toBe("")
    expect(d!.date).toBe("2026-10-01")
  })
})

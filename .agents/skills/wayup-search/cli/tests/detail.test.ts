import { describe, expect, test } from "bun:test"
import { parseWindowDataDetail } from "../src/helpers.js"

describe("wayup detail honesty (P-B2)", () => {
  test("og:title-only page returns null (PARSE_ERROR, never invented rows)", () => {
    const html = `<html><head><meta property="og:title" content="Software Engineer Intern" /><meta property="og:description" content="Great role" /></head><body><h1>Software Engineer Intern</h1></body></html>`
    expect(parseWindowDataDetail(html, "https://www.wayup.com/some-job-abc123/")).toBeNull()
  })
  test("empty page returns null", () => {
    expect(parseWindowDataDetail("<html></html>", "https://www.wayup.com/x/")).toBeNull()
  })
})

import { describe, expect, test } from "bun:test"
import { decodeHtmlEntities, stripHtmlTags } from "../src/helpers.js"
import { paginateJobs } from "../src/commands/search.js"

// Offline unit tests for P-M9 (strip-tags-then-decode-once) and the
// fromCharCode → fromCodePoint fix. No network access.

describe("stripHtmlTags (P-M9)", () => {
  test("encoded tags are NOT stripped: decode runs after tag-strip", () => {
    // `&lt;script&gt;` is literal text, not a real tag — it must survive.
    // (Old decode-first order turned it into a tag and stripped it.)
    const out = stripHtmlTags("&lt;script&gt;alert(1)&lt;/script&gt;")
    expect(out).toBe("<script>alert(1)</script>")
  })

  test("real script/style tags are still stripped", () => {
    const out = stripHtmlTags(
      "<script>alert(1)</script><style>.x{color:red}</style><p>hi</p>",
    )
    expect(out).not.toContain("alert(1)")
    expect(out).toContain("hi")
  })

  test("double-encoded entities decode exactly once", () => {
    // `&amp;amp;` → `&amp;` (one pass), NOT `&` (two passes).
    expect(stripHtmlTags("fish &amp;amp; chips")).toBe("fish &amp; chips")
    expect(stripHtmlTags("a &lt;b&gt; c")).toBe("a <b> c")
  })
})

describe("decodeHtmlEntities supplementary-plane (fromCodePoint)", () => {
  test("decimal emoji entity decodes to the real emoji", () => {
    // U+1F600 GRINNING FACE. fromCharCode(0x1f600) yields U+F600 (wrong);
    // fromCodePoint yields the surrogate pair for 😀.
    expect(decodeHtmlEntities("&#128512;")).toBe("😀")
    expect(decodeHtmlEntities("&#128512;")).toBe(String.fromCodePoint(128512))
  })

  test("hex emoji entity decodes to the real emoji", () => {
    expect(decodeHtmlEntities("&#x1F600;")).toBe("😀")
  })
})

describe("paginateJobs (P-M10)", () => {
  const jobs = [1, 2, 3, 4, 5]

  test("--limit 0 returns ALL results (careers-search convention)", () => {
    expect(paginateJobs(jobs, 1, 0)).toEqual([1, 2, 3, 4, 5])
  })

  test("positive limit slices the page window", () => {
    expect(paginateJobs(jobs, 1, 2)).toEqual([1, 2])
    expect(paginateJobs(jobs, 2, 2)).toEqual([3, 4])
    expect(paginateJobs(jobs, 3, 2)).toEqual([5])
  })
})

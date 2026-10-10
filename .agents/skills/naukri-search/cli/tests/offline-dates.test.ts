import { describe, expect, test } from "bun:test"
import { normalizeCardDate, parseJobCards, parsePostedAgo } from "../src/helpers.js"

// Offline unit tests for P-M15 (relative dates → ISO, never raw relative
// text in `date`). No network access.

describe("normalizeCardDate (P-M15)", () => {
  const dayMs = 86_400_000
  const todayIso = () => new Date().toISOString().slice(0, 10)

  test("'30+ Days Ago' resolves to the ISO date 30 days back", () => {
    const expected = new Date(Date.now() - 30 * dayMs).toISOString().slice(0, 10)
    expect(normalizeCardDate("30+ Days Ago")).toBe(expected)
  })

  test("relative labels resolve to ISO dates", () => {
    expect(normalizeCardDate("Just Now")).toBe(todayIso())
    const twoDays = new Date(Date.now() - 2 * dayMs).toISOString().slice(0, 10)
    expect(normalizeCardDate("2 Days Ago")).toBe(twoDays)
  })

  test("absolute dates pass through as YYYY-MM-DD", () => {
    expect(normalizeCardDate("2026-09-10")).toBe("2026-09-10")
  })

  test("unparseable labels become null (never raw text)", () => {
    // "Few Hours Ago" carries no number — null, not the raw string.
    expect(normalizeCardDate("Few Hours Ago")).toBeNull()
    expect(normalizeCardDate("garbage")).toBeNull()
    expect(normalizeCardDate(null)).toBeNull()
    expect(normalizeCardDate("")).toBeNull()
  })
})

describe("parsePostedAgo absolute-date fallback", () => {
  test("ISO strings parse so jobage filtering keeps working on ISO dates", () => {
    expect(parsePostedAgo("2026-09-10")).toBe(Date.parse("2026-09-10"))
  })

  test("relative labels still parse as before", () => {
    expect(Number.isNaN(parsePostedAgo("2 Days Ago"))).toBe(false)
    expect(Number.isNaN(parsePostedAgo("Just Now"))).toBe(false)
  })

  test("genuinely unknown shapes still return NaN (caller keeps the card)", () => {
    expect(Number.isNaN(parsePostedAgo("Few Hours Ago"))).toBe(true)
    expect(Number.isNaN(parsePostedAgo("some time in 2024"))).toBe(true)
    expect(Number.isNaN(parsePostedAgo(null))).toBe(true)
  })
})

describe("parseJobCards date (P-M15 end-to-end)", () => {
  test("HTML tuple dates are ISO, never raw relative text", () => {
    const mockHtml = `
      <div class="srp-jobtuple-wrapper" data-job-id="789101">
        <a class="title " href="https://www.naukri.com/job-listings-lead-data-scientist-789101">Lead Data Scientist</a>
        <a class="comp-name" title="Swiggy">Swiggy</a>
        <span class="loc-wrap" title="Bangalore, Karnataka">Bangalore, Karnataka</span>
        <span class="job-post-day">2 Days Ago</span>
      </div>
    `
    const cards = parseJobCards(mockHtml)
    expect(cards).toHaveLength(1)
    expect(cards[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(cards[0].date).not.toContain("Ago")
  })

  test("__NEXT_DATA__ footer labels are ISO too", () => {
    const mockNextDataHtml = `
      <html><body>
        <script id="__NEXT_DATA__" type="application/json">
          {"props":{"pageProps":{"initialState":{"searchResult":{"jobDetails":[
            {"jobId":"123456","title":"Backend Engineer","companyName":"Acme",
             "footerPlaceholderLabel":"3 Days Ago",
             "jdURL":"/job-listings-backend-engineer-acme-123456"}
          ]}}}}}
        </script>
      </body></html>`
    const cards = parseJobCards(mockNextDataHtml)
    expect(cards).toHaveLength(1)
    expect(cards[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

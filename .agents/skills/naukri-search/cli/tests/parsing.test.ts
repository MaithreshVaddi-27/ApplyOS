import { describe, expect, test } from "bun:test"
import {
  buildSearchUrl,
  type SearchOpts,
} from "../src/commands/search.js"
import {
  parseJobCards,
  parseJobDetail,
  clean,
  decodeHtmlEntities,
  slugify,
} from "../src/helpers.js"

describe("naukri helpers & URL builder", () => {
  test("slugifies strings for URLs", () => {
    expect(slugify("Senior Software Engineer (Backend)")).toBe("senior-software-engineer-backend")
    expect(slugify("  ---DevOps / SRE Lead--- ")).toBe("devops-sre-lead")
  })

  test("decodes html entities and cleans tags", () => {
    expect(decodeHtmlEntities("&quot;SDE-2&quot; &amp; &lt;Lead&gt; &#39;Role&#39;")).toBe(
      '"SDE-2" & <Lead> \'Role\'',
    )
    expect(clean("<div><strong>Senior Engineer</strong> &amp; Tech Lead</div>")).toBe(
      "Senior Engineer & Tech Lead",
    )
  })

  test("builds search URL with query and location", () => {
    const opts: SearchOpts = {
      query: "software engineer",
      location: "Bangalore",
      page: 1,
      format: "json",
    }
    const url = buildSearchUrl(opts)
    expect(url).toContain("keyword=software+engineer")
    expect(url).toContain("location=Bangalore")
    expect(url).not.toContain("pageNo=")
  })

  test("builds search URL with experience, salary and pagination", () => {
    const opts: SearchOpts = {
      query: "react developer",
      location: "Hyderabad",
      experience: 4,
      salary: "15-25",
      page: 2,
      format: "json",
    }
    const url = buildSearchUrl(opts)
    expect(url).toContain("keyword=react+developer")
    expect(url).toContain("location=Hyderabad")
    expect(url).toContain("experience=4")
    expect(url).toContain("salary=15-25")
    expect(url).toContain("pageNo=2")
  })
})

describe("naukri job card and detail parsing", () => {
  test("parses job cards from JSON embedded in __NEXT_DATA__", () => {
    const mockNextDataHtml = `
      <html>
        <body>
          <script id="__NEXT_DATA__" type="application/json">
            {
              "props": {
                "pageProps": {
                  "initialState": {
                    "searchResult": {
                      "jobDetails": [
                        {
                          "jobId": "123456",
                          "title": "Senior Backend Engineer",
                          "companyName": "Razorpay",
                          "placeholders": [
                            { "type": "location", "label": "Bangalore / Bengaluru" },
                            { "type": "experience", "label": "4-8 Yrs" },
                            { "type": "salary", "label": "25-35 LPA" }
                          ],
                          "createdDate": "Just Now",
                          "jdURL": "/job-listings-senior-backend-engineer-razorpay-123456"
                        }
                      ]
                    }
                  }
                }
              }
            }
          </script>
        </body>
      </html>
    `
    const cards = parseJobCards(mockNextDataHtml)
    expect(cards.length).toBe(1)
    expect(cards[0].id).toBe("123456")
    expect(cards[0].title).toBe("Senior Backend Engineer")
    expect(cards[0].company).toBe("Razorpay")
    expect(cards[0].location).toBe("Bangalore / Bengaluru")
    expect(cards[0].experience).toBe("4-8 Yrs")
    expect(cards[0].salary).toBe("25-35 LPA")
    expect(cards[0].url).toContain("naukri.com/job-listings-senior-backend-engineer-razorpay-123456")
  })

  test("parses job cards from modern HTML tuple wrappers", () => {
    const mockHtml = `
      <div class="srp-jobtuple-wrapper" data-job-id="789101">
        <a class="title " href="https://www.naukri.com/job-listings-lead-data-scientist-789101">Lead Data Scientist</a>
        <a class="comp-name" title="Swiggy">Swiggy</a>
        <span class="loc-wrap" title="Bangalore, Karnataka">Bangalore, Karnataka</span>
        <span class="exp-wrap" title="5-10 Yrs">5-10 Yrs</span>
        <span class="sal-wrap" title="30-45 Lacs PA">30-45 Lacs PA</span>
        <span class="job-post-day">2 Days Ago</span>
      </div>
    `
    const cards = parseJobCards(mockHtml)
    expect(cards.length).toBe(1)
    expect(cards[0].id).toBe("789101")
    expect(cards[0].title).toBe("Lead Data Scientist")
    expect(cards[0].company).toBe("Swiggy")
    expect(cards[0].location).toBe("Bangalore, Karnataka")
    expect(cards[0].experience).toBe("5-10 Yrs")
    expect(cards[0].salary).toBe("30-45 Lacs PA")
    expect(cards[0].date).toBe("2 Days Ago")
  })

  test("parses job detail page into structured fields", () => {
    const mockDetailHtml = `
      <html>
        <body>
          <h1 class="jd-header-title">Staff SRE Architect</h1>
          <div class="jd-header-comp-name"><a>Flipkart</a></div>
          <div class="location"><a>Bangalore Urban</a></div>
          <div class="exp">8 - 14 years</div>
          <div class="salary">45 - 60 Lacs PA</div>
          <section class="job-desc">
            We are looking for a Staff SRE Architect to design fault-tolerant multi-region systems.
          </section>
          <div class="key-skills">
            <a class="chip">Kubernetes</a>
            <a class="chip">Golang</a>
            <a class="chip">Distributed Systems</a>
          </div>
          <span>Role:</span> <span>DevOps Architect</span>
          <span>Industry Type:</span> <span>E-Commerce / Internet</span>
          <span>Functional Area:</span> <span>Engineering, DevOps</span>
          <span>Employment Type:</span> <span>Full Time, Permanent</span>
          <span>Education:</span> <span>B.Tech/B.E. in Any Specialization</span>
        </body>
      </html>
    `
    const detail = parseJobDetail(
      mockDetailHtml,
      "https://www.naukri.com/job-listings-staff-sre-architect-flipkart",
      "999888",
    )
    expect(detail.id).toBe("999888")
    expect(detail.title).toBe("Staff SRE Architect")
    expect(detail.company).toBe("Flipkart")
    expect(detail.location).toBe("Bangalore Urban")
    expect(detail.experience).toBe("8 - 14 years")
    expect(detail.salary).toBe("45 - 60 Lacs PA")
    expect(detail.description).toContain("Staff SRE Architect")
    expect(detail.skills).toEqual(["Kubernetes", "Golang", "Distributed Systems"])
    expect(detail.role).toBe("DevOps Architect")
    expect(detail.industry).toBe("E-Commerce / Internet")
    expect(detail.employmentType).toBe("Full Time, Permanent")
    expect(detail.education).toBe("B.Tech/B.E. in Any Specialization")
  })
})

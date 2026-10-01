import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "path"
import { parseCategoryPage, filterJobs, isRemoteFriendly, buildCategoryUrl } from "../src/commands/search.js"
import { parseDetailPage, slugFromId } from "../src/commands/detail.js"
import { toIsoDate } from "../src/helpers.js"

const FIXTURES = join(import.meta.dir, "fixtures")
const categoryHtml = readFileSync(join(FIXTURES, "category.html"), "utf-8")
const detailHtml = readFileSync(join(FIXTURES, "detail.html"), "utf-8")

describe("cutshort category page parsing (real __NEXT_DATA__ shape)", () => {
  const { jobs, liveJobCount } = parseCategoryPage(categoryHtml)

  test("extracts the dehydrated jobListData payload", () => {
    expect(jobs.length).toBe(2)
    expect(liveJobCount).toBeGreaterThan(jobs.length)
  })

  test("emits the /scrape Step 2 contract fields", () => {
    for (const job of jobs) {
      expect(typeof job.id).toBe("string")
      expect(job.id.length).toBeGreaterThan(0)
      expect(typeof job.title).toBe("string")
      expect(job.title.length).toBeGreaterThan(0)
      expect(typeof job.company).toBe("string")
      expect(typeof job.location).toBe("string")
      expect(job.url.startsWith("https://cutshort.io/job/")).toBe(true)
    }
  })

  test("keeps the posting date from jobFactSummary, normalized to YYYY-MM-DD", () => {
    expect(jobs[0]!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test("carries the extra fields /scrape presents", () => {
    expect(typeof jobs[0]!.salary).toBe("string")
    expect(Array.isArray(jobs[0]!.skills)).toBe(true)
    expect(typeof jobs[0]!.remoteType).toBe("string")
  })
})

describe("client-side filters", () => {
  const { jobs } = parseCategoryPage(categoryHtml)

  test("query filter matches title, company, and skills", () => {
    const byTitle = filterJobs(jobs, { format: "json", query: jobs[0]!.title.split(" ")[0] })
    expect(byTitle.length).toBeGreaterThanOrEqual(1)
    const bySkill = filterJobs(jobs, { format: "json", query: "spark" })
    expect(bySkill.some((j) => (j.skills ?? []).includes("Spark"))).toBe(true)
  })

  test("location filter is a substring match on locationsText", () => {
    const loc = jobs[0]!.location ?? ""
    const hit = filterJobs(jobs, { format: "json", location: loc.split(" ")[0] })
    expect(hit.some((j) => j.location?.includes(loc.split(" ")[0]))).toBe(true)
  })

  test("remote filter keeps only remote-friendly remoteType values", () => {
    const onsite = { ...jobs[0]!, remoteType: "remote_not_okay" }
    expect(isRemoteFriendly(onsite)).toBe(false)
    const remote = { ...jobs[0]!, remoteType: "remote_okay" }
    expect(isRemoteFriendly(remote)).toBe(true)
  })

  test("jobage keeps undated rows (absence is not staleness)", () => {
    const undated = { ...jobs[0]!, date: null }
    const kept = filterJobs([undated], { format: "json", jobage: 1 })
    expect(kept.length).toBe(1)
  })

  test("category URL resolves queries through the verified-slug alias map", () => {
    // "backend-jobs" does not exist on Cutshort (empty shell, HTTP 200) —
    // the alias map must resolve it to the verified backend-developer-jobs.
    expect(buildCategoryUrl({ format: "json", query: "backend" })).toBe("https://cutshort.io/jobs/backend-developer-jobs")
    expect(buildCategoryUrl({ format: "json", query: "software engineer" })).toBe("https://cutshort.io/jobs/software-development-jobs")
    expect(buildCategoryUrl({ format: "json", query: "internship" })).toBe("https://cutshort.io/jobs/internship-jobs")
    expect(buildCategoryUrl({ format: "json", category: "reactjs-jobs" })).toBe("https://cutshort.io/jobs/reactjs-jobs")
  })
})

describe("detail page parsing (real jobData shape)", () => {
  const job = parseDetailPage(detailHtml)

  test("finds the jobData query and reads the record", () => {
    expect(job).not.toBeNull()
    expect(job!.title).toContain("Software Engineer")
    expect(job!.company!.length).toBeGreaterThan(0)
  })

  test("description is stripped readable text, not HTML", () => {
    expect(job!.description).not.toMatch(/<\/?[a-z]+>/i)
    expect(job!.description!.length).toBeGreaterThan(50)
  })

  test("slug extraction accepts a full URL or a bare slug", () => {
    expect(slugFromId("https://cutshort.io/job/Some-Role-Company-YNwdZACO?x=1")).toBe("Some-Role-Company-YNwdZACO")
    expect(slugFromId("Some-Role-Company-YNwdZACO")).toBe("Some-Role-Company-YNwdZACO")
  })
})

describe("date normalization", () => {
  test("toIsoDate trims ISO timestamps to YYYY-MM-DD", () => {
    expect(toIsoDate("2026-09-29T09:49:28.748Z")).toBe("2026-09-29")
  })

  test("toIsoDate returns null for absent or unparseable values (never invented)", () => {
    expect(toIsoDate(undefined)).toBeNull()
    expect(toIsoDate(null)).toBeNull()
    expect(toIsoDate("")).toBeNull()
    expect(toIsoDate("ASAP")).toBeNull()
  })
})

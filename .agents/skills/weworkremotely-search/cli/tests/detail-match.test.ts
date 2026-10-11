import { describe, expect, test } from "bun:test"
import { findJob } from "../src/commands/detail.js"
import type { WWRJob } from "../src/helpers.js"

// Offline unit tests for P-M13 (substring id matching returned wrong
// postings). No network access.

const job = (over: Partial<WWRJob> = {}): WWRJob => ({
  id: "backend-dev-xyz1",
  title: "Backend Dev",
  company: "Acme",
  location: "Worldwide",
  date: "2026-10-01",
  url: "https://weworkremotely.com/remote-jobs/backend-dev-xyz1",
  salary: null,
  tags: [],
  ...over,
})

describe("findJob exact matching (P-M13)", () => {
  test("exact id wins (case-insensitive)", () => {
    const jobs = [job({ id: "Backend-Dev-XYZ1" })]
    expect(findJob(jobs, "backend-dev-xyz1", "backend-dev-xyz1")?.id).toBe(
      "Backend-Dev-XYZ1",
    )
  })

  test("exact url wins", () => {
    const jobs = [job()]
    expect(
      findJob(jobs, "https://weworkremotely.com/remote-jobs/backend-dev-xyz1", "backend-dev-xyz1")?.id,
    ).toBe("backend-dev-xyz1")
  })

  test("substring trap: 'dev' must NOT match 'backend-dev-xyz1'", () => {
    const jobs = [job()]
    expect(findJob(jobs, "dev", "dev")).toBeUndefined()
  })

  test("suffix trap: 'xyz' must NOT match id 'backend-dev-xyz1'", () => {
    const jobs = [job()]
    expect(findJob(jobs, "xyz", "xyz")).toBeUndefined()
  })

  test("unambiguous dash-anchored url-tail fallback still resolves", () => {
    const jobs = [
      job({ id: "a1", url: "https://weworkremotely.com/remote-jobs/frontend-aaa111" }),
      job({ id: "b2", url: "https://weworkremotely.com/remote-jobs/backend-bbb222" }),
    ]
    expect(findJob(jobs, "bbb222", "bbb222")?.id).toBe("b2")
  })

  test("ambiguous url-tail fallback resolves to nothing", () => {
    const jobs = [
      job({ id: "a1", url: "https://weworkremotely.com/remote-jobs/frontend-dup999" }),
      job({ id: "b2", url: "https://weworkremotely.com/remote-jobs/backend-dup999" }),
    ]
    expect(findJob(jobs, "dup999", "dup999")).toBeUndefined()
  })
})

import { describe, expect, test } from "bun:test"
import { matchRemotiveJob } from "../src/commands/detail.js"
import type { RemotiveJob } from "../src/helpers.js"

// Offline unit tests for P-M13 (substring id matching returned wrong
// postings). No network access.

const job = (over: Partial<RemotiveJob>): RemotiveJob => ({
  id: "1",
  title: "Backend Engineer",
  company: "Acme",
  location: "Worldwide",
  date: "2026-10-01",
  url: "https://remotive.com/remote-jobs/1-backend-engineer",
  salary: null,
  ...over,
})

describe("matchRemotiveJob (P-M13)", () => {
  test("exact id wins", () => {
    const jobs = [job({ id: "123" }), job({ id: "1234" })]
    expect(matchRemotiveJob(jobs, "123", "123")?.id).toBe("123")
  })

  test("exact url wins", () => {
    const jobs = [job({ id: "1", url: "https://remotive.com/remote-jobs/1-a" })]
    expect(
      matchRemotiveJob(jobs, "https://remotive.com/remote-jobs/1-a", "1")?.id,
    ).toBe("1")
  })

  test("substring trap: '234' must NOT match id '1234'", () => {
    const jobs = [job({ id: "1234", url: "https://remotive.com/remote-jobs/1234-dev" })]
    expect(matchRemotiveJob(jobs, "234", "234")).toBeUndefined()
  })

  test("suffix trap: '123' must NOT match url tail '-5123'", () => {
    const jobs = [job({ id: "9999", url: "https://remotive.com/remote-jobs/senior-dev-5123" })]
    expect(matchRemotiveJob(jobs, "123", "123")).toBeUndefined()
  })

  test("unambiguous dash-anchored url-tail fallback still resolves", () => {
    const jobs = [
      job({ id: "aaa", url: "https://remotive.com/remote-jobs/foo-777" }),
      job({ id: "bbb", url: "https://remotive.com/remote-jobs/bar-888" }),
    ]
    expect(matchRemotiveJob(jobs, "777", "777")?.id).toBe("aaa")
  })

  test("ambiguous url-tail fallback (two '-777' tails) resolves to nothing", () => {
    const jobs = [
      job({ id: "aaa", url: "https://remotive.com/remote-jobs/foo-777" }),
      job({ id: "bbb", url: "https://remotive.com/remote-jobs/bar-777" }),
    ]
    expect(matchRemotiveJob(jobs, "777", "777")).toBeUndefined()
  })
})

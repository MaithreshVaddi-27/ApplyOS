import { describe, expect, test } from "bun:test"
import { matchRemoteOkJob } from "../src/commands/detail.js"
import type { RemoteOkJob } from "../src/helpers.js"

// Offline unit tests for P-M13 (substring id matching returned wrong
// postings). No network access.

const job = (over: Partial<RemoteOkJob>): RemoteOkJob => ({
  id: "1",
  title: "Backend Engineer",
  company: "Acme",
  location: "",
  date: "2026-10-01",
  url: "https://remoteok.com/remote-jobs/1-backend-engineer",
  ...over,
})

describe("matchRemoteOkJob (P-M13)", () => {
  test("exact numeric id wins", () => {
    const jobs = [job({ id: "123" }), job({ id: "1234" })]
    expect(matchRemoteOkJob(jobs, "123", "123")?.id).toBe("123")
  })

  test("exact slug wins", () => {
    const jobs = [job({ id: "9", slug: "senior-dev-9" })]
    expect(matchRemoteOkJob(jobs, "senior-dev-9", "9")?.id).toBe("9")
  })

  test("exact url wins", () => {
    const jobs = [job({ id: "5", url: "https://remoteok.com/remote-jobs/dev-5" })]
    expect(
      matchRemoteOkJob(jobs, "https://remoteok.com/remote-jobs/dev-5", "5")?.id,
    ).toBe("5")
  })

  test("substring trap: '123' must NOT match id '1234' or tail '-5123'", () => {
    const jobs = [
      job({ id: "1234", slug: "dev-1234", url: "https://remoteok.com/remote-jobs/dev-1234" }),
      job({ id: "9999", slug: "senior-dev-5123", url: "https://remoteok.com/remote-jobs/senior-dev-5123" }),
    ]
    expect(matchRemoteOkJob(jobs, "123", "123")).toBeUndefined()
  })

  test("unambiguous dash-anchored url-tail fallback still resolves", () => {
    const jobs = [
      job({ id: "aaa", slug: "foo-777", url: "https://remoteok.com/remote-jobs/foo-777" }),
      job({ id: "bbb", slug: "bar-888", url: "https://remoteok.com/remote-jobs/bar-888" }),
    ]
    expect(matchRemoteOkJob(jobs, "777", "777")?.id).toBe("aaa")
  })

  test("ambiguous url-tail fallback resolves to nothing", () => {
    const jobs = [
      job({ id: "aaa", slug: "foo-777", url: "https://remoteok.com/remote-jobs/foo-777" }),
      job({ id: "bbb", slug: "bar-777", url: "https://remoteok.com/remote-jobs/bar-777" }),
    ]
    expect(matchRemoteOkJob(jobs, "777", "777")).toBeUndefined()
  })
})

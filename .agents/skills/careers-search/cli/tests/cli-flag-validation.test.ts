import { describe, expect, test } from "bun:test"
import { runCLI } from "./helpers.js"

describe("careers-cli flag validation & errors", () => {
  test("returns help with --help and exits 0", async () => {
    const res = await runCLI(["--help"])
    expect(res.exitCode).toBe(0)
    expect(res.stdout).toContain("careers-cli")
    expect(res.stdout).toContain("SEARCH FLAGS")
  })

  test("rejects unknown commands", async () => {
    const res = await runCLI(["invalid-command"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("UNKNOWN_COMMAND")
  })

  test("rejects unknown flags for search", async () => {
    const res = await runCLI(["search", "--bogus-flag"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("UNKNOWN_FLAG")
  })

  test("rejects unknown flags for detail", async () => {
    const res = await runCLI(["detail", "123", "--unknown"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("UNKNOWN_FLAG")
  })

  test("rejects missing argument for detail", async () => {
    const res = await runCLI(["detail"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("MISSING_ARG")
  })

  test("rejects missing argument for discover", async () => {
    const res = await runCLI(["discover"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("MISSING_ARG")
  })

  test("rejects invalid page number", async () => {
    const res = await runCLI(["search", "--page", "-5"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_PAGE")
  })

  test("rejects invalid board", async () => {
    const res = await runCLI(["search", "--board", "indeed"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_BOARD")
  })

  test("rejects invalid type", async () => {
    const res = await runCLI(["search", "--type", "contract"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_TYPE")
  })

  test("rejects invalid stage", async () => {
    const res = await runCLI(["search", "--stage", "alumni"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_STAGE")
  })

  test("rejects invalid format", async () => {
    const res = await runCLI(["search", "--format", "xml"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_FORMAT")
  })

  test("rejects valueless value-flag --query", async () => {
    const res = await runCLI(["search", "--query"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_ARG")
  })

  test("rejects valueless value-flag --board", async () => {
    const res = await runCLI(["search", "--board"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_ARG")
  })

  test("rejects valueless --board for detail", async () => {
    const res = await runCLI(["detail", "123", "--board"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_ARG")
  })

  test("rejects non-numeric --jobage", async () => {
    const res = await runCLI(["search", "--jobage", "abc"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_JOBAGE")
  })

  test("rejects zero --jobage", async () => {
    const res = await runCLI(["search", "--jobage", "0"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_JOBAGE")
  })

  test("rejects non-integer --jobage", async () => {
    const res = await runCLI(["search", "--jobage", "14abc"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_JOBAGE")
  })

  test("companies command lists the registry", async () => {
    const res = await runCLI(["companies", "--format", "table"])
    expect(res.exitCode).toBe(0)
    expect(res.stdout).toContain("Amazon")
    expect(res.stdout).toContain("greenhouse/groww")
  })

  test("discover detects greenhouse URLs", async () => {
    const res = await runCLI(["discover", "https://job-boards.greenhouse.io/swiggy/jobs/1004321"])
    expect(res.exitCode).toBe(0)
    const out = JSON.parse(res.stdout)
    expect(out.board).toBe("greenhouse")
    expect(out.slug).toBe("swiggy")
    expect(out.id).toBe("1004321")
  })

  test("discover detects workday tenant URLs", async () => {
    const res = await runCLI(["discover", "https://flipkart.wd3.myworkdayjobs.com/en-US/Flipkart/job/SDE-2_1234"])
    expect(res.exitCode).toBe(0)
    const out = JSON.parse(res.stdout)
    expect(out.board).toBe("workday")
    expect(out.slug).toBe("flipkart/Flipkart")
    expect(out.id).toBe("SDE-2_1234")
  })

  test("discover detects regional (eu) greenhouse boards", async () => {
    const res = await runCLI(["discover", "https://job-boards.eu.greenhouse.io/groww/jobs/4970739101"])
    expect(res.exitCode).toBe(0)
    const out = JSON.parse(res.stdout)
    expect(out.board).toBe("greenhouse")
    expect(out.slug).toBe("groww")
    expect(out.id).toBe("4970739101")
  })

  test("discover detects amazon /en/jobs/ detail URLs", async () => {
    const res = await runCLI(["discover", "https://www.amazon.jobs/en/jobs/1234567"])
    expect(res.exitCode).toBe(0)
    const out = JSON.parse(res.stdout)
    expect(out.board).toBe("amazon")
    expect(out.id).toBe("1234567")
  })

  test("discover reports unknown hosts without failing", async () => {
    const res = await runCLI(["discover", "https://careers.example.com/jobs/1"])
    expect(res.exitCode).toBe(0)
    const out = JSON.parse(res.stdout)
    expect(out.board).toBeNull()
  })
})

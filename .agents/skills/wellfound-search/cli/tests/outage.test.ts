import { describe, expect, test } from "bun:test"
import { isOutageEmpty } from "../src/commands/search.js"

// Offline unit tests for P-M11 (a total fetch/parse failure must exit 1,
// never masquerade as an empty board). No network access.

describe("isOutageEmpty (P-M11)", () => {
  test("every fetch failed, zero rows → outage", () => {
    expect(isOutageEmpty(2, false, 0)).toBe(true)
  })

  test("single fetch failed, zero rows → outage", () => {
    expect(isOutageEmpty(1, false, 0)).toBe(true)
  })

  test("all fetches ok, zero rows → genuine empty, not outage", () => {
    expect(isOutageEmpty(0, false, 0)).toBe(false)
  })

  test("rows were parsed but filtered to zero → not outage", () => {
    expect(isOutageEmpty(1, true, 0)).toBe(false)
    expect(isOutageEmpty(0, true, 0)).toBe(false)
  })

  test("non-empty result → never outage", () => {
    expect(isOutageEmpty(2, true, 5)).toBe(false)
    expect(isOutageEmpty(0, true, 5)).toBe(false)
  })
})

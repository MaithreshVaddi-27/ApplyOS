// Origin: clean-room 2026-10-11, own fixtures, no network. Author: OpenCode agent.
import { describe, expect, test } from "bun:test";
import { pickArray } from "../src/guards";

describe("pickArray", () => {
  test("passes arrays through untouched", () => {
    const arr = [{ id: 1 }];
    expect(pickArray(arr, ["jobs"])).toBe(arr);
  });
  test("reads top-level keys in order", () => {
    expect(pickArray({ jobs: [1], data: [2] }, ["jobs", "data"])).toEqual([1]);
    expect(pickArray({ data: [2] }, ["jobs", "data"])).toEqual([2]);
  });
  test("walks dot-paths for nested envelopes", () => {
    expect(pickArray({ data: { data: [3] } }, ["data.data", "opportunities"])).toEqual([3]);
    expect(pickArray({ opportunities: [4] }, ["data.data", "opportunities"])).toEqual([4]);
  });
  test("unknown shapes yield [], never null or throws", () => {
    expect(pickArray({ surprise: [] }, ["data.data", "opportunities"])).toEqual([]);
    expect(pickArray(null, ["jobs"])).toEqual([]);
    expect(pickArray("jobs", ["jobs"])).toEqual([]);
    expect(pickArray({ jobs: "not-an-array" }, ["jobs"])).toEqual([]);
  });
});

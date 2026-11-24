// Phase 4.7 stage six — parity for the four careers-search enterprise surfaces.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  amazonDetail, amazonSearch,
  eightfoldDetail, eightfoldSearch,
  salesforceDetail, salesforceSearch,
  workdayDetail, workdaySearch,
} from "../src/connectors/enterprise.js";

const FIXTURES = join(import.meta.dir, "fixtures");
const FEEDS = JSON.parse(readFileSync(join(FIXTURES, "cli-enterprise-feeds.json"), "utf8"));
const EXPECTED = JSON.parse(readFileSync(join(FIXTURES, "cli-enterprise-expected.json"), "utf8"));

const BOARDS: Record<string, { slug: string; company: string }> = {
  amazon: { slug: "india", company: "Amazon" },
  workday: { slug: "jiostar/JioStar/102", company: "JioStar" },
  salesforce: { slug: "salesforce", company: "Salesforce" },
  eightfold: { slug: "acme", company: "Acme" },
};

const DETAIL_PAYLOADS: Record<string, unknown> = {
  workday: { jobPostingInfo: { title: "Assistant Manager", jobDescription: "<p>Build <b>things</b></p>", location: "Mumbai", startDate: "2026-01-01" } },
  eightfold: { position: { id: "ef-1", name: "Data Engineer", description: "<p>Pipeline work</p>", location: "Bengaluru" } },
};
const HTML = `<html><head><title>Software Engineer | Salesforce</title></head><body><div class="job-description"><p>Build the cloud</p></div></body></html>`;

function stubFetch(board: string): typeof fetch {
  return (async (url: unknown) => {
    const href = String(url);
    let payload: unknown = FEEDS[board];
    if (board === "workday" && href.includes("/wday/cxs/") && !href.endsWith("/jobs")) payload = DETAIL_PAYLOADS.workday;
    if (board === "eightfold" && href.includes("/jobs/")) payload = DETAIL_PAYLOADS.eightfold;
    return {
      status: 200, ok: true,
      json: async () => JSON.parse(JSON.stringify(payload)),
      text: async () => HTML,
    };
  }) as unknown as typeof fetch;
}

async function withStub<T>(board: string, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = stubFetch(board);
  try { return await fn(); }
  finally { globalThis.fetch = original; }
}

const SEARCH: Record<string, any> = {
  amazon: amazonSearch, workday: workdaySearch,
  salesforce: salesforceSearch, eightfold: eightfoldSearch,
};
const DETAIL: Record<string, any> = {
  amazon: amazonDetail, workday: workdayDetail,
  salesforce: salesforceDetail, eightfold: eightfoldDetail,
};

for (const board of Object.keys(BOARDS)) {
  test(`${board}: the CLI surface reproduces the retired connector's rows`, async () => {
    for (const [name, opts] of [["noQuery", { query: undefined, maxPages: 1 }], ["withQuery", { query: "engineer", maxPages: 1 }]] as const) {
      const rows = await withStub(board, () => SEARCH[board](BOARDS[board], opts));
      expect(rows).toEqual(EXPECTED[board][name]);
    }
  });

  test(`${board}: the CLI surface reproduces the retired connector's detail string`, async () => {
    const captured = EXPECTED[board];
    if (!captured.detailId) return;
    const detail = await withStub(board, () => DETAIL[board](BOARDS[board], captured.detailId));
    expect(detail).toBe(captured.detail);
  });
}

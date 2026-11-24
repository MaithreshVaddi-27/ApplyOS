// Phase 4.7 stage six — parity for the four careers-search ATS surfaces.
// The oracle was captured from the pre-migration connectors, not hand-written.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ashbyDetail, ashbySearch,
  greenhouseDetail, greenhouseSearch,
  leverDetail, leverSearch,
  smartrecruitersDetail, smartrecruitersSearch,
} from "../src/connectors/ats.js";

const FIXTURES = join(import.meta.dir, "fixtures");
const FEEDS = JSON.parse(readFileSync(join(FIXTURES, "cli-ats-feeds.json"), "utf8"));
const EXPECTED = JSON.parse(readFileSync(join(FIXTURES, "cli-ats-expected.json"), "utf8"));

const BOARDS: Record<string, { slug: string; company: string }> = {
  greenhouse: { slug: "groww", company: "Groww" },
  lever: { slug: "cred", company: "CRED" },
  smartrecruiters: { slug: "Freshworks", company: "Freshworks" },
  ashby: { slug: "notion", company: "Notion" },
};

const DETAIL_PAYLOADS: Record<string, unknown> = {
  greenhouse: { title: "Assistant Manager - Internal Audit", content: "<p>Build &lt;b&gt;things&lt;/b&gt;</p>" },
  smartrecruiters: {
    name: "Sales Manager Southern Brazil",
    location: { city: "Guarulhos", country: "br" },
    releasedDate: "2026-11-24",
    jobAd: { sections: { description: { title: "About", text: "<p>We build</p>" } } },
  },
};

function stubFetch(board: string): typeof fetch {
  return (async (url: unknown) => {
    const isDetail =
      board === "greenhouse" ? String(url).includes("/jobs/") :
      board === "smartrecruiters" ? String(url).includes("/postings/") : false;
    const payload = isDetail ? DETAIL_PAYLOADS[board] : FEEDS[board];
    return {
      status: 200, ok: true,
      json: async () => JSON.parse(JSON.stringify(payload)),
      text: async () => JSON.stringify(payload),
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
  greenhouse: greenhouseSearch,
  lever: leverSearch,
  smartrecruiters: smartrecruitersSearch,
  ashby: ashbySearch,
};
const DETAIL: Record<string, any> = {
  greenhouse: greenhouseDetail,
  lever: leverDetail,
  smartrecruiters: smartrecruitersDetail,
  ashby: ashbyDetail,
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

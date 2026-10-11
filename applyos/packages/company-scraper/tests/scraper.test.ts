// Origin: clean-room 2026-10-07, own fixtures, no network. Author: OpenCode agent.
import { describe, expect, test, afterEach } from "bun:test";
import { parseRegistry, resolveTargets } from "../src/registry";
import { detectBoard } from "../src/detect";
import { mapGreenhouse } from "../src/connectors/greenhouse";
import { mapLever, leverDescription } from "../src/connectors/lever";
import { mapSmartRecruiters } from "../src/connectors/smartrecruiters";
import { srDescription } from "../src/connectors/smartrecruiters";
import { mapAmazon, searchAmazon, detailAmazon } from "../src/connectors/amazon";
import { workdayDate, mapWorkday, mapWorkdayDetail } from "../src/connectors/workday";
import { applyClientFilters } from "../src/search";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("registry", () => {
  test("parses flat entries and resolves filters", () => {
    const text = `# comment
- company: Groww
  board: greenhouse
  slug: groww
  region: india
  category: india-product
- company: CRED
  board: lever
  slug: cred
  region: india
  category: india-product
`;
    const entries = parseRegistry(text);
    expect(entries).toHaveLength(2);
    expect(resolveTargets(entries, { region: "india" })).toHaveLength(2);
    expect(resolveTargets(entries, { board: "lever" })[0].company).toBe("CRED");
    expect(resolveTargets(entries, { company: "groww" })[0].slug).toBe("groww");
  });
});

describe("detectBoard", () => {
  test("routes known hosts", () => {
    expect(detectBoard("https://www.amazon.jobs/en/jobs/123").board).toBe("amazon");
    expect(detectBoard("https://job-boards.greenhouse.io/groww/jobs/1").board).toBe("greenhouse");
    expect(detectBoard("https://jobs.lever.co/cred/abc").board).toBe("lever");
    expect(detectBoard("https://jobs.smartrecruiters.com/Freshworks/1").board).toBe("smartrecruiters");
    expect(detectBoard("https://acme.wd3.myworkdayjobs.com/en-US/Acme/job/SDE_123").board).toBe("workday");
    expect(detectBoard("https://acme.wd3.myworkdayjobs.com/en-US/Acme/job/SDE_123").slug).toBe("acme/Acme/3");
    expect(detectBoard("https://example.com/x").board).toBe("unknown");
  });
});

describe("mappers use null dates, never invented", () => {
  test("greenhouse maps fixture", () => {
    const rows = mapGreenhouse("Groww", "groww", [
      { id: 1, title: "SDE Intern", absolute_url: "https://x/1", location: { name: "Bengaluru" }, updated_at: "2026-10-01T00:00:00Z" },
      { id: 2, title: "No date role", absolute_url: "https://x/2" },
    ]);
    expect(rows[0].postedDate).toBe("2026-10-01");
    expect(rows[1].postedDate).toBeNull();
  });
  test("lever maps createdAt and renders lists", () => {
    const rows = mapLever("CRED", "cred", [
      { id: "a", text: "Backend Intern", hostedUrl: "https://x/a", categories: { location: "Bengaluru" }, createdAt: Date.parse("2026-09-20T00:00:00Z") },
    ]);
    expect(rows[0].postedDate).toBe("2026-09-20");
    expect(leverDescription({ id: "a", text: "t", hostedUrl: "u", description: "<p>Hi</p>", lists: [{ text: "Req", content: "<li>A</li>" }] })).toContain("Req");
  });
  test("smartrecruiters builds posting urls", () => {
    const rows = mapSmartRecruiters("Freshworks", "Freshworks", [{ id: "9", name: "PM Intern", location: { city: "Chennai", country: "India" }, releasedDate: "2026-09-25T00:00:00Z" }]);
    expect(rows[0].url).toContain("smartrecruiters.com/Freshworks/9");
  });
  test("smartrecruiters id/url key on the stable slug, not the display name", () => {
    const rows = mapSmartRecruiters("Freshworks Inc", "Freshworks", [{ id: "9", name: "PM Intern" }]);
    expect(rows[0].id).toBe("smartrecruiters:Freshworks:9");
    expect(rows[0].url).toContain("smartrecruiters.com/Freshworks/9");
    expect(rows[0].company).toBe("Freshworks Inc");
  });
  test("amazon keeps null on garbage dates", () => {
    const rows = mapAmazon([{ id: 7, title: "SDE", posting_date: "not a date", job_path: "/en/jobs/7" }]);
    expect(rows[0].postedDate).toBeNull();
  });
  test("smartrecruiters description accepts array and keyed sections", () => {
    const arrayShape = srDescription({ sections: [{ title: "Role", text: "<p>Do things</p>" }] });
    const keyedShape = srDescription({ sections: { companyDescription: { title: "About", text: "<p>We build</p>" } } });
    expect(arrayShape).toContain("Do things");
    expect(keyedShape).toContain("We build");
    expect(srDescription(undefined)).toBe("");
  });
  test("workday parses relative dates, null otherwise", () => {
    expect(workdayDate("Posted 5 Days Ago")).not.toBeNull();
    expect(workdayDate("sometime")).toBeNull();
    expect(mapWorkday("Acme", "acme", [{ title: "SDE", externalPath: "job/1" }])[0].postedDate).toBeNull();
  });
  test("workday title-less rows map to Untitled instead of crashing", () => {
    const rows = mapWorkday("Acme", "acme", [{}]);
    expect(rows[0].title).toBe("Untitled");
    expect(rows[0].id).toContain("workday:acme:");
  });
  test("workday detail maps jobPostingInfo, strips html, null date when absent", () => {
    const d = mapWorkdayDetail("Acme", "acme", "wd3", "Flipkart", "job/9", {
      title: "SDE 2", jobDescription: "<p>Build <b>things</b></p>", location: "Bengaluru",
    });
    expect(d.posting.title).toBe("SDE 2");
    expect(d.posting.company).toBe("Acme");
    expect(d.posting.url).toContain("acme");
    expect(d.posting.url).toContain("job/9");
    expect(d.description).toContain("Build things");
    expect(d.description).not.toContain("<p>");
    expect(d.posting.postedDate).toBeNull();
  });
  test("workday detail prefers postedOn over startDate for the date", () => {
    const d = mapWorkdayDetail("Acme", "acme", "wd3", "Flipkart", "job/9", {
      title: "SDE 2", postedOn: "Posted 5 Days Ago", startDate: "2026-01-01",
    });
    expect(d.posting.postedDate).not.toBeNull();
  });
  test("workday detail throws not-found when jobPostingInfo is absent", () => {
    expect(() => mapWorkdayDetail("Acme", "acme", "wd3", "Flipkart", "job/9", undefined)).toThrow(/not found/);
  });
});

describe("amazon truncation", () => {
  const job = (id: number) => ({ id, title: `SDE ${id}`, job_path: `/en/jobs/${id}` });
  function stubJobs(n: number): void {
    const jobs = Array.from({ length: n }, (_, i) => job(i + 1));
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ jobs }), { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
  }
  test("limit slices the full page and flags truncation (matched>sliced)", async () => {
    stubJobs(5);
    const r = await searchAmazon("sde", 2);
    expect(r.rows).toHaveLength(2);
    expect(r.truncated).toBe(true);
  });
  test("no truncation when the page holds everything asked for", async () => {
    stubJobs(3);
    const r = await searchAmazon("sde", 0);
    expect(r.rows).toHaveLength(3);
    expect(r.truncated).toBe(false);
  });
  test("a full server page still flags may-hold-more", async () => {
    stubJobs(100);
    const r = await searchAmazon("sde", 0);
    expect(r.truncated).toBe(true);
  });
});

describe("client filters", () => {
  const base = mapGreenhouse("Groww", "groww", [
    { id: 1, title: "SDE Intern", absolute_url: "https://x/1", location: { name: "Bengaluru" } },
    { id: 2, title: "Senior Backend", absolute_url: "https://x/2", location: { name: "Remote" } },
  ]);
  test("student stage keeps internships only", () => {
    expect(applyClientFilters(base, { stage: "student" })).toHaveLength(1);
  });
  test("remote-global keeps remote rows", () => {
    expect(applyClientFilters(base, { stage: "remote-global" })).toHaveLength(1);
  });
  test("location filter is client-side", () => {
    expect(applyClientFilters(base, { location: "bengaluru" })[0].title).toBe("SDE Intern");
  });
});

describe("amazon detail", () => {
  function stubAmazonJobs(jobs: unknown[]): void {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ jobs }), { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
  }
  test("returns the matched posting, not the first row", async () => {
    stubAmazonJobs([
      { id: 7, title: "SDE I", job_path: "/en/jobs/7", description: "Build things", qualifications: "BS" },
      { id: 8, title: "SDE II", job_path: "/en/jobs/8", description: "Build more", qualifications: "MS" },
    ]);
    const d = await detailAmazon("8");
    expect(d.id).toBe("amazon:8");
    expect(d.title).toBe("SDE II");
  });
  test("throws not-found when the id matches nothing", async () => {
    stubAmazonJobs([{ id: 7, title: "SDE I", job_path: "/en/jobs/7" }]);
    await expect(detailAmazon("999")).rejects.toThrow(/amazon posting not found/);
  });
});

describe("lever dates", () => {
  const posting = (createdAt: number) => ({ id: "a1", text: "SDE", hostedUrl: "https://x", createdAt });
  test("createdAt is read as milliseconds", () => {
    const [row] = mapLever("Acme", "acme", [posting(1728000000000)]);
    expect(row.postedDate).toBe("2024-10-04");
  });
  test("a seconds-epoch value lands in 1970 (assumption pin: API sends ms)", () => {
    const [row] = mapLever("Acme", "acme", [posting(1728000000)]);
    expect(row.postedDate).toBe("1970-01-21");
  });
});

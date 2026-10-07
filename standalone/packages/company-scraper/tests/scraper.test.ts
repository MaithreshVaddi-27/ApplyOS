// Origin: clean-room 2026-10-07, own fixtures, no network. Author: OpenCode agent.
import { describe, expect, test } from "bun:test";
import { parseRegistry, resolveTargets } from "../src/registry";
import { detectBoard } from "../src/detect";
import { mapGreenhouse } from "../src/connectors/greenhouse";
import { mapLever, leverDescription } from "../src/connectors/lever";
import { mapSmartRecruiters } from "../src/connectors/smartrecruiters";
import { srDescription } from "../src/connectors/smartrecruiters";
import { mapAmazon } from "../src/connectors/amazon";
import { workdayDate, mapWorkday } from "../src/connectors/workday";
import { applyClientFilters } from "../src/search";

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
    const rows = mapSmartRecruiters("Freshworks", [{ id: "9", name: "PM Intern", location: { city: "Chennai", country: "India" }, releasedDate: "2026-09-25T00:00:00Z" }]);
    expect(rows[0].url).toContain("smartrecruiters.com/Freshworks/9");
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

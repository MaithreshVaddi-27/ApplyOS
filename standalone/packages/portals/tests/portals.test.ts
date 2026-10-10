// Origin: clean-room 2026-10-07, own fixtures, no network. Author: OpenCode agent.
import { describe, expect, test } from "bun:test";
import { mapRemoteOk } from "../src/remoteok";
import { mapRemotive } from "../src/remotive";
import { mapUnstop } from "../src/unstop";
import { mapFreehire } from "../src/freehire";

describe("portal mappers", () => {
  test("remoteok skips header rows and keeps null-safe dates", () => {
    const rows = mapRemoteOk([
      { id: 1, position: "Backend Dev", company: "Acme", location: "Worldwide", date: "2026-10-05T00:00:00Z", url: "https://remoteok.com/x/1" },
      { id: 2, url: "https://remoteok.com/x/2" },
      { id: 3, position: "No date role", company: "Acme", url: "https://remoteok.com/x/3", date: "" },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].postedDate).toBe("2026-10-05");
    expect(rows[1].postedDate).toBeNull();
  });
  test("remotive maps fixture", () => {
    const rows = mapRemotive([
      { id: 9, title: "SDE Intern", company_name: "Beta", candidate_required_location: "India", publication_date: "2026-09-30T12:00:00", url: "https://remotive.com/x/9" },
    ]);
    expect(rows[0]).toMatchObject({ portal: "remotive", location: "India", postedDate: "2026-09-30" });
  });
  test("garbage dates null out instead of leaking raw slices", () => {
    const ro = mapRemoteOk([
      { id: 1, position: "R", company: "A", url: "https://remoteok.com/x/1", date: "not-a-date" },
    ]);
    expect(ro[0].postedDate).toBeNull();
    const rm = mapRemotive([
      { id: 1, title: "R", company_name: "A", publication_date: "yesterday-ish", url: "https://remotive.com/x/1" },
    ]);
    expect(rm[0].postedDate).toBeNull();
    const us = mapUnstop([
      { id: 1, title: "R", start_date: "soon", public_url: "https://unstop.com/o/1" },
    ]);
    expect(us[0].postedDate).toBeNull();
    const usOk = mapUnstop([
      { id: 2, title: "R", start_date: "2026-10-01T00:00:00Z", public_url: "https://unstop.com/o/2" },
    ]);
    expect(usOk[0].postedDate).toBe("2026-10-01");
  });
  test("unstop/freehire coerce non-string payload fields via asText", () => {
    const us = mapUnstop([
      { id: 7, title: 12345 as unknown as string, location: 99 as unknown as string, public_url: "https://unstop.com/o/7" },
    ]);
    expect(us[0].title).toBe("12345");
    expect(us[0].location).toBe("99");
    const fh = mapFreehire([
      { id: 8, title: "R", company: 777 as unknown as string, url: "https://freehire.me/x/8" },
    ]);
    expect(fh[0].company).toBe("777");
  });
});

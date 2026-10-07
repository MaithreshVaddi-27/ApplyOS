// Origin: clean-room 2026-10-07, own fixtures, no network. Author: OpenCode agent.
import { describe, expect, test } from "bun:test";
import { mapRemoteOk } from "../src/remoteok";
import { mapRemotive } from "../src/remotive";

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
});

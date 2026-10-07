// Origin: clean-room 2026-10-07, own fixtures, no network. Author: OpenCode agent.
import { describe, expect, test } from "bun:test";
import { parseWwrRss, mapWwr } from "../src/weworkremotely";
import { mapFreehire } from "../src/freehire";
import { mapUnstop } from "../src/unstop";

describe("stream-2 mappers", () => {
  test("wwr parses rss items and recovers company from title", () => {
    const xml = `<rss><channel><item><title>Backend Dev</title><link>https://x/1</link><pubDate>Mon, 06 Oct 2026 00:00:00 GMT</pubDate><dc:creator>Acme</dc:creator></item><item><title></title><link></link></item></channel></rss>`;
    const rows = mapWwr(parseWwrRss(xml));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ portal: "weworkremotely", company: "Acme", postedDate: "2026-10-06" });
  });
  test("wwr recovers employer folded into the title", () => {
    const rows = mapWwr([{ title: "Proxify AB: Senior Backend Developer", link: "https://x/9", pubDate: "Mon, 06 Oct 2026 00:00:00 GMT" }]);
    expect(rows[0]).toMatchObject({ company: "Proxify AB", title: "Senior Backend Developer" });
  });
  test("freehire keeps null-safe dates and urls", () => {
    const rows = mapFreehire([
      { id: 1, title: "SDE", company: "A", url: "https://x/1", date: "2026-10-01T00:00:00Z" },
      { id: 2, title: "No url", company: "A" },
      { id: 3, title: "Bad date", company: "A", url: "https://x/3", date: "soon" },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[1].postedDate).toBeNull();
  });
  test("unstop maps fixture with fallbacks", () => {
    const rows = mapUnstop([
      { id: 5, title: "Hackathon", organisation: { name: "TCS" }, public_url: "https://unstop.com/o/5", start_date: "2026-09-01" },
      { id: 6, name: "", organisation: { name: "X" } },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ portal: "unstop", company: "TCS", postedDate: "2026-09-01" });
  });
});

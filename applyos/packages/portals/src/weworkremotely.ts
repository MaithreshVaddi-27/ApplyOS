// Origin: clean-room 2026-10-07, derived from public We Work Remotely RSS feeds. Author: OpenCode agent.
import { fetchText, stripHtml } from "@applyos/core";
import type { JobPosting } from "@applyos/core";

export interface RawWwrItem {
  title?: string;
  company?: string;
  location?: string;
  pubDate?: string;
  link?: string;
  guid?: string;
}

/** Minimal RSS item parser for WWR feeds (no XML dep — regex over item blocks). */
export function parseWwrRss(xml: string): RawWwrItem[] {
  const items: RawWwrItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = m[1];
    const pick = (tag: string): string => {
      const r = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\/${tag}>`, "i"));
      return r ? stripHtml(r[1]).trim() : "";
    };
    items.push({
      title: pick("title"),
      company: pick("dc:creator") || pick("author"),
      location: pick("location"),
      pubDate: pick("pubDate"),
      link: pick("link"),
      guid: pick("guid"),
    });
  }
  return items;
}

export function mapWwr(items: RawWwrItem[]): JobPosting[] {
  return items
    .filter((i) => i.title && i.link)
    .map((i) => {
      const t = Date.parse(i.pubDate ?? "");
      // WWR folds the employer into the title ("Acme: Senior Backend …");
      // recover it when the feed carries no author field.
      let company = (i.company || "").trim();
      let title = (i.title ?? "Untitled").trim();
      if (!company && title.includes(":")) {
        const [head, ...rest] = title.split(":");
        if (head.length <= 60 && rest.join(":").trim()) {
          company = head.trim();
          title = rest.join(":").trim();
        }
      }
      return {
        id: `weworkremotely:${i.guid || i.link}`,
        title,
        company: company || "Unknown",
        location: (i.location || "Remote").trim(),
        postedDate: Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10),
        url: (i.link ?? "").trim(),
        portal: "weworkremotely",
        source: "adapter" as const,
      };
    });
}

const FEEDS = [
  "https://weworkremotely.com/categories/remote-programming-jobs.rss",
  "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
  "https://weworkremotely.com/categories/remote-data-science-jobs.rss",
];

export async function searchWwr(
  query: string,
  limit: number,
  fetchFn: (url: string) => Promise<string> = (u) => fetchText(u).then((r) => r.text),
): Promise<{ rows: JobPosting[]; truncated: boolean }> {
  const all: RawWwrItem[] = [];
  const errors: string[] = [];
  for (const feed of FEEDS) {
    try {
      all.push(...parseWwrRss(await fetchFn(feed)));
    } catch (e) {
      errors.push(`${feed}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (!all.length && errors.length) {
    throw new Error(`weworkremotely: all ${FEEDS.length} feeds failed (${errors.join("; ")})`);
  }
  const q = query.toLowerCase();
  const matched = q
    ? all.filter((i) => `${i.title} ${i.company}`.toLowerCase().includes(q))
    : all;
  const sliced = limit === 0 ? matched : matched.slice(0, limit);
  return { rows: mapWwr(sliced), truncated: matched.length > sliced.length };
}

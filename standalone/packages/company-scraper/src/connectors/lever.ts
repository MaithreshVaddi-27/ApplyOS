// Origin: clean-room 2026-10-07, derived from public Lever postings API docs. Author: OpenCode agent.
import { fetchJson, stripHtml } from "../../../core/src/index";
import type { JobPosting } from "../../../core/src/index";

export interface RawLeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  categories?: { location?: string; commitment?: string };
  description?: string;
  lists?: { text: string; content: string }[];
  createdAt?: number;
}

export function mapLever(company: string, slug: string, postings: RawLeverPosting[]): JobPosting[] {
  return postings.map((p) => ({
    id: `lever:${slug}:${p.id}`,
    title: (p.text ?? "Untitled").trim(),
    company,
    location: (p.categories?.location ?? "Unknown").trim(),
    postedDate: p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : null,
    url: p.hostedUrl,
    portal: "lever",
    source: "adapter" as const,
  }));
}

export function leverDescription(p: RawLeverPosting): string {
  const sections = (p.lists ?? []).map((s) => `${s.text}\n${stripHtml(s.content ?? "")}`).join("\n\n");
  return stripHtml(p.description ?? "").slice(0, 2000) + (sections ? `\n\n${sections}`.slice(0, 2000) : "");
}

export async function searchLever(
  company: string,
  slug: string,
  query: string,
  limit: number,
): Promise<{ rows: JobPosting[]; truncated: boolean }> {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;
  const { json } = await fetchJson(url);
  const postings = (Array.isArray(json) ? json : []) as RawLeverPosting[];
  const q = query.toLowerCase();
  const matched = q
    ? postings.filter((p) => `${p.text} ${p.categories?.location ?? ""}`.toLowerCase().includes(q))
    : postings;
  const cap = limit === 0 ? matched.length : matched.slice(0, limit).length;
  return { rows: mapLever(company, slug, matched.slice(0, limit === 0 ? undefined : limit)), truncated: matched.length > cap };
}




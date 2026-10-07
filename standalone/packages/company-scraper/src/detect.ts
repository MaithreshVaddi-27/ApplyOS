// Origin: clean-room 2026-10-07, own URL-pattern table. Author: OpenCode agent.

export interface DetectedBoard {
  board: "amazon" | "greenhouse" | "lever" | "smartrecruiters" | "workday" | "unknown";
  slug?: string;
  hint: string;
}

/** Identify which supported board owns a careers URL (used by `discover` + detail routing). */
export function detectBoard(url: string): DetectedBoard {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { board: "unknown", hint: "not a URL" };
  }
  const host = u.hostname.toLowerCase();
  const path = u.pathname;
  if (host.includes("amazon.jobs")) return { board: "amazon", hint: "amazon.jobs search/detail API" };
  if (host.includes("greenhouse.io") || host.includes("job-boards.greenhouse.io")) {
    const slug = path.split("/").filter(Boolean)[0];
    return { board: "greenhouse", slug, hint: `boards-api.greenhouse.io/v1/boards/${slug ?? "<slug>"}/jobs` };
  }
  if (host.includes("lever.co")) {
    const slug = path.split("/").filter(Boolean)[0];
    return { board: "lever", slug, hint: `api.lever.co/v0/postings/${slug ?? "<slug>"}?mode=json` };
  }
  if (host.includes("smartrecruiters.com")) {
    return { board: "smartrecruiters", hint: "api.smartrecruiters.com/v1/companies/<id>/postings" };
  }
  if (host.includes("myworkdayjobs.com")) {
    return { board: "workday", hint: "<tenant>.wdN.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs" };
  }
  return { board: "unknown", hint: "no supported board pattern matched" };
}


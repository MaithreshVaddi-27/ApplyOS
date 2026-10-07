// Origin: clean-room 2026-10-07, derived from RFC 9309 + live robots.txt files. Author: OpenCode agent.

/** Minimal robots.txt gate: fetch once, cache per host, honor Disallow for our path. */
const cache = new Map<string, string[]>();

export function parseDisallows(robotsTxt: string): string[] {
  const rules: string[] = [];
  let inWildcard = false;
  for (const raw of robotsTxt.split("\n")) {
    const line = raw.split("#")[0].trim();
    if (/^user-agent\s*:/i.test(line)) {
      inWildcard = line === "*" || /user-agent\s*:\s*\*/i.test(line);
      continue;
    }
    if (inWildcard) {
      const m = line.match(/^disallow\s*:\s*(\S*)/i);
      if (m && m[1]) rules.push(m[1].trim());
    }
  }
  return rules;
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return "/";
  }
}

export async function robotsAllows(targetUrl: string, timeoutMs = 10_000): Promise<{ allowed: boolean; reason: string }> {
  let origin: string;
  try {
    origin = new URL(targetUrl).origin;
  } catch {
    return { allowed: false, reason: "unparseable-url" };
  }
  if (!cache.has(origin)) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(`${origin}/robots.txt`, { signal: ctrl.signal });
      clearTimeout(timer);
      cache.set(origin, res.ok ? parseDisallows(await res.text()) : []);
    } catch {
      cache.set(origin, []);
    }
  }
  const path = pathOf(targetUrl);
  const blocked = (cache.get(origin) ?? []).some((rule) => rule !== "/" && path.startsWith(rule));
  return blocked ? { allowed: false, reason: `robots-disallow:${path}` } : { allowed: true, reason: "ok" };
}

/** Test hook: seed or clear the in-memory robots cache. */
export const __robotsCache = cache;

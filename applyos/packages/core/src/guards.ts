// Origin: clean-room 2026-10-11, envelope checks factored out of the 9 fetch sites. Author: OpenCode agent.

/**
 * First array found at any of the given dot-paths (e.g. "data.data",
 * "opportunities"), or the payload itself when it already is an array.
 * Anything else yields [] — callers keep their current empty-result behavior.
 */
export function pickArray(json: unknown, paths: string[]): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    const root = json as Record<string, unknown>;
    for (const p of paths) {
      let cur: unknown = root;
      for (const key of p.split(".")) {
        if (!cur || typeof cur !== "object") {
          cur = undefined;
          break;
        }
        cur = (cur as Record<string, unknown>)[key];
      }
      if (Array.isArray(cur)) return cur;
    }
  }
  return [];
}

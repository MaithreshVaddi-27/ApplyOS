# Public API

> **Status:** `PARTIAL`. The CLI surface is `IMPLEMENTED` and stable. The JSON schemas are
> `IMPLEMENTED` in shape but **not yet versioned** — the versioning policy below is `PROPOSED`
> and lands in Phase 7.

---

## 1. What counts as public API

| Surface | Stable? | Consumers |
|---|---|---|
| `applyos <command>` CLI | Yes, from Phase 1 | Humans, scripts, agents |
| `applyos … --format json` | Yes, from Phase 3 | Scripts, the TUI, the dashboard |
| Provider CLI envelope `{meta, results}` | Yes (ADR-0006) | `/scrape`, external tooling |
| `JobPosting` row shape | Yes | Every adapter, every consumer |
| Tracker CSV schema | **Not versioned yet** | `/outcome`, `/html-report`, `/notion-sync`, `/rank` |
| `seen_jobs.json` shape | Internal | `/scrape`, `/rank` |
| `input/` and `output/` layout | Yes | The candidate, `/setup` |
| Python tool CLIs (`tools/*.py`) | Internal, but stable in practice | The specs, CI |
| `salary_lookup.py` | Partly public | `/setup`, `/apply` |

---

## 2. The CLI surface

```
applyos <command> [flags]
```

| Command | Purpose | Phase |
|---|---|---|
| `scrape` | Unified fan-in across the enabled provider set | `IMPLEMENTED` |
| `rank` | Gates + scoring + shortlist | `IMPLEMENTED` |
| `apply` | Tailored application pack for one posting | `IMPLEMENTED` |
| `apply --batch <file.json>` | One pack per entry, sequentially, with per-row isolation | `IMPLEMENTED` |
| `tracker` | Read, write, migrate the tracker | `PROPOSED` — Phase 7 |
| `eval` | Run the offline evaluation suite | `PROPOSED` — Phase 9 |
| `profile` | Read/validate the machine-readable profile | `PROPOSED` — Phase 6 |
| `doctor` | Verify the toolchain (bun, python, lualatex, poppler) and the workspace | `PROPOSED` — Phase 1 |

`doctor` is deliberately first in the sequence of new commands: it is the cheapest possible
answer to "why is this not working", and Phase 1's baseline already knows what a correct
environment looks like.

### 2.1 Global flags

| Flag | Applies to | Meaning |
|---|---|---|
| `--format json\|table\|plain` | all | Output format. Default `json` for machine surfaces, `table` for humans |
| `--help`, `-h` | all | Usage. Exit 0 |
| `--version` | all | Prints the core version. `PROPOSED` — Phase 1 |

### 2.2 Exit codes

| Code | Meaning |
|---|---|
| 0 | Success — the operation completed |
| 1 | Failure — the operation did not produce a usable result |

**The rule.** A command that produced nothing because everything failed is a **failure**, not an
empty success. `applyos apply --batch` implements this exactly: it exits 0 when at least one
pack was built, and 1 when none was (`cli.ts:246-248`). A batch that built nothing must never be
mistaken for success.

---

## 3. The JSON surface

Every `--format json` output is a single JSON document on stdout with a stable top-level shape.

### 3.1 `scrape --format json`

```json
{
  "results": [ { "id": "...", "title": "...", "company": "...",
                 "location": null, "postedDate": null, "url": "...",
                 "portal": "naukri", "source": "adapter" } ],
  "meta": {
    "total": 42,
    "truncated": false,
    "elapsedMs": 812,
    "notes": [
      { "portal": "company-boards", "ok": true, "truncated": false },
      { "portal": "remotive", "ok": false, "error": "HTTP 503 for https://…" }
    ]
  }
}
```

Contract:
- `results` is always present, possibly empty.
- `meta.notes` carries **one entry per source**, including failures. A failed source is a note,
  never an exception and never a silent omission.
- `meta.total` is the count *before* the limit slice; `truncated` says whether the slice dropped
  rows.

### 3.2 `rank --format json`

```json
{
  "ranked": [
    { "score": 78, "verdict": "Strong", "posting": { … }, "strengths": ["…"], "gaps": ["…"] }
  ],
  "rejected": [
    { "posting": { … }, "reasons": ["stale: posted 91d ago (> 30d window)"] }
  ],
  "elapsedMs": 1430
}
```

### 3.3 `apply --format json`

```json
{
  "pack": {
    "posting": { … },
    "score": 78,
    "verdict": "Strong",
    "resumeMarkdown": "…",
    "pitch": "…",
    "followUp": "…",
    "gaps": ["kubernetes"],
    "traces": [ { "text": "…", "source": "01-candidate-profile.md#achievements" } ]
  },
  "gated": [ { "gate": "stale", "verdict": "PASS", "note": "" } ]
}
```

`gated` carries every gate's verdict, including the `"not evaluated"` notes — so a consumer can
distinguish "checked and passed" from "could not be checked".

---

## 4. Versioning policy

### 4.1 The rules

1. **A top-level JSON output gains fields; it does not lose or change them** within a major
   version. A consumer that ignores unknown fields keeps working.
2. **A renamed or retyped field is a breaking change** and requires a major version bump.
3. **`meta` gains a `schemaVersion` field** in Phase 7. Its presence signals the versioning
   regime is live.
4. **The provider envelope keeps the ADR-0006 shape.** `meta.count`, `meta.page`, `results[]`
   with `id/title/company/location/date/url`.
5. **Null semantics never change.** A field's meaning as "the source did not state it" is
   permanent. A field never changes from `null` to `""` or vice versa.

### 4.2 Deprecation

A deprecated field is kept for one minor version, marked in its own documentation, and removed
in the next major. A `meta.deprecations` array names each removed field and its replacement.

### 4.3 The tracker schema

`PROPOSED` — Phase 7.

```json
{ "schemaVersion": 2, "columns": ["date", "company", …], "migrations": ["1->2"] }
```

The CSV stays CSV. The schema version and the migration function live beside it.

---

## 5. Stability tiers

| Tier | Meaning | Example |
|---|---|---|
| **Stable** | Will not break without a major version | `applyos scrape --format json`, the provider envelope |
| **Evolving** | May gain fields or commands in a minor version | `applyos rank --format json` |
| **Internal** | May change in any release; not part of the contract | `seen_jobs.json` internals, `tools/*.py` arguments |

**The rule for internal surfaces:** they are internal to a repo, but a **fork** may depend on
them. When a fork dependency is known, promote the surface a tier and record it in
[../OPEN_QUESTIONS.md](../OPEN_QUESTIONS.md).

---

## 6. Error codes

Stable identifiers. The message is human text and may change; the code may not.

| Code | Meaning | Where |
|---|---|---|
| `MISSING_CREDENTIALS` | A required environment variable is absent | Provider CLIs, SDK |
| `INVALID_FORMAT` | `--format` is not `json`, `table`, or `plain` | Provider CLIs, `applyos` |
| `INVALID_SALARY` | `--salary` could not be parsed | `unstop-search`, `naukri-search` |
| `batch-file` | The batch file is missing, invalid, or has an entry without a `ref` | `applyos apply --batch` (`cli.ts:208`) |
| `profile-not-found` | `--profile` path does not exist | `applyos apply` (`apply.ts:130`) |
| `profile-invalid` | The profile is not valid JSON, or has the wrong shape | `applyos apply` (`apply.ts:150`) |
| `missing-arg` | A required argument was not supplied | `applyos` (`cli.ts:143`) |
| `unknown-command` | The command is not recognised | `applyos` (`cli.ts:256`) |
| `apply-failed` | The apply flow could not complete | `applyos apply` (`cli.ts:187`) |

**Unknown codes must be handled gracefully.** A consumer that receives a code it does not know
treats it as non-fatal and surfaces it verbatim.

---

## 7. The stable provider envelope

```json
{
  "meta": { "count": 12, "page": 1 },
  "results": [
    { "id": "…", "title": "…", "company": "…", "location": null, "date": null, "url": "…" }
  ]
}
```

Contract details in [provider-sdk.md](./provider-sdk.md#6-the-cli-surface). The two rules that
matter most to a consumer:

1. `meta.count` equals `results.length`. (An audit finding: `weworkremotely` reported
   `meta.count` ≠ `results.length`.)
2. `null` means "the source did not state it". Never omitted, never a placeholder string.

---

## 8. What is deliberately not an API

| Surface | Why it is not public |
|---|---|
| The agent's prompt text | It is a prompt, not an interface; it changes with model quality |
| `.claude/skills/*` file contents | Internal to the spec layer; the *behaviour* is the contract, the prose is not |
| The `applyos` package's internal module layout | Refactoring is expected to change it |
| LaTeX template internals | Only the compiled output is a contract |
| The `framework_version` marker semantics | A drift detector, not a contract |

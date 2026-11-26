# Phase 11 — Security and production hardening

> **Status:** `IMPLEMENTED` · **Depends on:** Phase 8 (and every other phase informs it) ·
> **Risks:** [R-09 through R-15, R-20, R-21](../roadmap/risks.md)

---

## Outcome

The threat model is **written down**, the known gaps are **closed**, and the residual risks are
**stated honestly** rather than implied.

---

## Why now

ApplyOS already has strong *configuration* security — `tools/security_guards.py` fails PRs that
widen the allowlist, add lifecycle scripts, or weaken the gitignore rules, and `78813db` hardened
it further after finding three holes. What it does not have is:

1. A **written threat model** that enumerates the trust boundaries, the assets, and the
   attacker capabilities.
2. The **known gaps closed** — the audit's T-M4 (POSIX-only commands) and P-M12 (an unbounded
   detail fan-out) are recorded and unfixed.
3. A **data-flow inventory** that says exactly what leaves the machine and what does not.

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Phase 8 | soft | Complete — the runtime surface informs the threat model |
| Phases 1–10 | soft | Each phase's design is input to the threat model |

**This phase can start partially at any time.** The specific gap fixes below are independent of
the other phases and should be landed as they are found.

---

## Affected modules

| Path | Change |
|---|---|
| `SECURITY.md` | Expanded with the threat-model summary and the residual risks |
| `docs/security/threat-model.md` | **New** — the full model |
| `docs/security/privacy.md` | **New** — the data-flow inventory |
| `docs/security/security-testing.md` | **New** — the testing strategy |
| `tools/security_guards.py` | Extended with the new guards |
| `.claude/skills/job-application-assistant/09-web-research.md` | The POSIX-only `curl` pattern (T-M4) |
| `.claude/commands/add-template.md` | The POSIX-only `curl` pattern (T-M4) |
| `.agents/skills/weworkremotely-search/cli/src/commands/detail.ts` | The unbounded detail fan-out (P-M12) |
| `.github/workflows/ci.yml` | A security job |

---

## Tasks

### 11.1 — Write the threat model

**Deliverable.** `docs/security/threat-model.md`.

**Required sections.**

| Section | Contents |
|---|---|
| **Scope** | What is in the model and what is not |
| **Assets** | The profile, the tracker, the salary data, the document archive, the search history, the credentials |
| **Trust boundaries** | The candidate's machine; the AI runtime; the job boards; the MCP servers; the model provider |
| **Attacker capabilities** | A malicious job posting; a hostile board; a compromised dependency; a malicious MCP server; a careless candidate |
| **Abuse cases** | Prompt injection through a posting; exfiltration through a provider; credential theft; the public-remote mistake |
| **Mitigations** | What exists today, per case |
| **Residual risk** | What is **not** mitigated, stated plainly |
| **Security properties** | The invariants a change must not break |

**The three residual risks that must be stated, not buried.**

1. **Instruction-level defences are not a sandbox.** `SECURITY.md:17` already says this. The threat
   model must name it as a residual risk with a mitigation path (the model's native web tools are
   outside the Bash allowlist's reach).
2. **A provider runs with the agent's file access.** It is code in the candidate's own fork,
   reviewed by them. If a registry is ever built, this becomes a much larger problem — see
   [../design/plugin-architecture.md](../design/plugin-architecture.md).
3. **The profile lives in tracked files.** A candidate who ignores the `/setup` privacy warning can
   publish it. The warning is not a block, and the reason it is not a block is recorded.

### 11.2 — Write the privacy data-flow inventory

**Deliverable.** `docs/security/privacy.md`.

**A table of every path that can carry personal data, and where it goes.**

| Path | Contains | Leaves the machine? | Enforcement |
|---|---|---|---|
| `input/**` | CV, LinkedIn export, diplomas, references | No | gitignore + guard |
| `output/cv/**` | Tailored documents | No | gitignore + guard |
| `output/applications/**` | Archives | No | gitignore + guard |
| `workspace/**` | State, tracker, sync state | No | gitignore + guard |
| `salary_data.json` | Salary benchmarks | No | gitignore + guard |
| `output/research/*.md` | Search-result notes | No | **Tracked** — the candidate must keep them free of personal data |
| `/notion-sync` | Filenames only | **Yes — filenames** | One-way; the candidate opts in |
| The model provider | Whatever the agent sends in its context | **Yes** | Outside ApplyOS's control; the candidate's model provider's policy applies |
| Job boards | The search query | **Yes** | Unavoidable; the query is generic by design |

**Requirement.** The last two rows are the honest ones. ApplyOS cannot prevent the agent from
sending context to a model provider, and it cannot avoid sending a search query to a board. Both
should be documented rather than glossed.

### 11.3 — Fix the POSIX-only command patterns (T-M4)

**Deliverable.** `09-web-research.md:51,68` and `add-template.md:114,135` no longer depend on
POSIX-only shell syntax.

**Requirement.** Windows is a supported CI platform and a supported candidate platform. The
current pattern — `cd "$SCRATCHPAD" && curl …` — fails there.

**Options.** (a) Use a Python helper for the retry, since Python is already a hard prerequisite.
(b) Specify both a POSIX and a Windows form in the spec. **Recommendation:** (a) — one
implementation, no platform branch.

### 11.4 — Fix the unbounded detail fan-out (P-M12)

**Deliverable.** `weworkremotely-search/cli/src/commands/detail.ts` has an overall deadline.

**Evidence.** Audit finding P-M12: the cache-miss detail path fans out to ~10 RSS feeds with 5
retries and no overall timeout — *"multi-minute `/scrape` hang."*

**Requirement.** Every fan-out path has a total deadline, and exceeding it produces a typed
error rather than a hang.

**Broader requirement.** The Phase 4 SDK's fetch layer must enforce a **total deadline per
operation**, not just per request. A timeout per request is not a timeout.

### 11.5 — Extend the security guards

**Deliverable.** New guards in `tools/security_guards.py`.

| Guard | Rationale |
|---|---|
| No spec may invoke a command outside the allowlist | A spec is executable instructions; an unapproved command is a permission bypass |
| No spec may write outside the allowed roots | The personal-data boundary |
| No `curl`/`wget` invocation in a spec without an allowlist entry | Direct network access from a spec bypasses the polite-fetch path |
| Every provider CLI's `dependencies` must be empty | ADR-0006's zero-dependency promise |
| The provider SDK's `dependencies` must be empty | ADR-0004 and ADR-0006 |

**Requirement.** Each guard has a **negative test** — a fixture that violates it and must fail.

### 11.6 — Write the security testing strategy

**Deliverable.** `docs/security/security-testing.md`.

**Contents.**
- The guard suite and what each guard catches.
- The manual review checklist for a change that touches a trust boundary.
- The prompt-injection review checklist for a spec that reads posting text.
- The dependency-review process.
- The self-audit procedure (how to check ApplyOS's own security posture).
- The disclosure process (mirroring `SECURITY.md`).

### 11.7 — Document the operational requirements

**Deliverable.** A section in `docs/security/security-testing.md`.

**These cannot be solved in the repository:**

| Requirement | Why |
|---|---|
| Branch protection with required checks and review | `SECURITY.md` and the CI header both state that a PR can edit the workflow itself |
| Human review of workflow and settings diffs | The same reason |
| A private repository for the candidate's own search | The profile is in tracked files |
| A model provider with a privacy policy the candidate accepts | Outside ApplyOS's control |

**Requirement.** Recording these honestly is more useful than implying the repository's CI is a
complete defence. It is not, and `SECURITY.md` already says so.

---

## Tests

| Suite | Change |
|---|---|
| `tests/test_security_guards.py` | Extended — a negative test per new guard |
| `tests/test_check_specs.py` | Extended — the allowlist and root guards (Phase 8) |
| `.agents/skills/weworkremotely-search/cli/tests/` | Extended — the deadline |
| `.claude/skills/job-application-assistant/` | The spec change is checked by the conformance checker |

---

## Acceptance criteria

- [x] `docs/security/threat-model.md` exists with every required section.
- [x] The three residual risks are stated explicitly — plus two more the model found. They are
      also in `SECURITY.md`'s summary.
- [x] `docs/security/privacy.md` contains the full data-flow inventory, including the two honest
      rows (model provider and job boards).
- [x] `docs/security/security-testing.md` exists with the guard table, boundary and injection
      checklists, dependency process, self-audit and disclosure.
- [x] T-M4 is fixed — `tools/fetch_page.py` and `tools/extract_text.py` replaced the POSIX-only
      `cd … && curl` and multi-line `python3 -c` patterns; the guard asserts none remain.
- [x] P-M12 is fixed — `providerFetch` now enforces a total deadline over retries and backoff, and
      the WWR detail sweep passes it to every feed. Three tests cover it.
- [x] Every new security guard has a negative test — `tests/test_security_guards_phase11.py`.
- [x] `SECURITY.md` links to the threat model and stays accurate.
- [x] The operational requirements are recorded in the threat model and the testing strategy.
- [ ] The whole suite is green on three operating systems.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Writing a threat model that overstates the security posture | medium | high | The residual-risk section is mandatory and must name what is *not* mitigated |
| The guards are too strict and block legitimate work | medium | medium | Each guard has a documented escape hatch and a negative test that proves it fires |
| The new guards conflict with the SDK's design | medium | medium | The SDK's zero-dependency requirement is the same rule the provider CLIs already follow |
| The operational requirements are read as optional | medium | high | They are listed in the threat model under "cannot be solved in the repository", and cross-linked from `SECURITY.md` |

---

## Rollback

| Change | Rollback |
|---|---|
| The threat model | A document. It cannot break the build. But it should not be deleted — it is the record |
| The guard extensions | Each guard is independent and can be removed individually |
| The POSIX fix | Revert the spec change |
| The deadline fix | Revert the connector change. **Do not revert this one** — it is a hang fix |

---

## Definition of done

- [ ] All acceptance criteria pass in CI on three operating systems.
- [ ] `docs/security/` has all four documents.
- [x] `SECURITY.md` links to the threat model and remains accurate.
- [x] `docs/roadmap/risks.md` R-09 through R-15, R-20, R-21 are updated with their outcomes.
- [x] `docs/IMPLEMENTATION_STATUS.md` reflects the closed gaps.
- [x] `CHANGELOG.md` has an `[Unreleased]` entry.

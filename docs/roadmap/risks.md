# Risk Register

> Every risk here was derived from repository evidence, not from general anxiety. Each entry
> names the evidence, the impact, and a mitigation that is actually part of the plan.
> **Status:** `PROPOSED` — Phase 11 validates this register against the converged architecture.

---

## 1. Risk scoring

| Dimension | Scale |
|---|---|
| **Likelihood** | `low` · `medium` · `high` · `certain` (already happening) |
| **Impact** | `low` · `medium` · `high` · `critical` (data loss, privacy breach, or a wrong answer that costs a candidate an opportunity) |

---

## 2. Architecture risks

### R-01 — The engine and the spec layer stay disconnected · **likelihood: high · impact: critical** — **MITIGATED 2026-11-13**

**Evidence.** No `.claude/commands/*.md` invokes the `applyos` binary. `PROJECT_MAP.md:37-40` draws
the engine as a dashed edge. The engine's 168 tests protect code no workflow reaches.

**Impact.** Two implementations of every deterministic rule. A fix to `gates.ts` does not change
what a candidate sees. The repository carries the maintenance cost of a second implementation
without any of the benefit.

**Mitigation.** ADR-0007 → Phase 2. Shadow mode first, per-step rollback.

**What Phase 2 delivered.** ADR-0007 is **accepted**. The divergence is now machine-visible:
`tools/spec_parity.py` compares the spec, the tooling, and the engine, and fails on any
unlisted difference. `applyos contract` publishes the shared contract so the spec layer reads
the field names instead of guessing them. The Stage Profile's `engine:` line controls how much
of the search the engine runs, defaulting to `off`.

**Residual.** The convergence is *started*, not finished. The engine's scoring model, its gate
set, and the tracker/archive writers are still Phase 5 and Phase 7 work. The ratchet keeps the
remaining gap from widening.

### R-02 — Two incompatible scoring models · **likelihood: certain · impact: high** — **DIAGNOSED 2026-11-13**

**Evidence.** The spec layer uses 4 dimensions with stage weights
(`30/15/15/40` for student) and 5 bands. The engine uses 3 factors
(`0.40/0.35/0.25` for student) and 3 bands (`≥70`, `≥45`). A candidate using `/rank` and a
developer using `applyos rank` get different answers for the same posting.

**Impact.** Whichever one ships becomes "the" score, and the other is confusing. A reviewer
cannot tell which is right.

**Mitigation.** Q2 → Phase 5. One weight table, one band set, one `modelVersion`.

**What Phase 2 established.** `tools/spec_parity.py` settled the direction by evidence: the
**Python tooling already matches the spec exactly**, value for value. The **engine is the
outlier**. Q2 is therefore answered — the spec's 4-dimension model with 5 bands is canonical,
and the engine adopts it in Phase 5. The remaining differences are enumerated in
`docs/parity-known-differences.json` and gated by the parity harness.

### R-03 — Five boards implemented twice · **likelihood: certain · impact: medium**

**Evidence.** `remoteok`, `remotive`, `weworkremotely`, `unstop`, `freehire` exist in both
`.agents/skills/` and `applyos/packages/portals/`, with different contracts and different
parsers.

**Impact.** A parsing fix reaches one consumer. The 2026-10-09 audit found exactly this: four
contract violations in the CLIs that the engine's versions did not have, and vice versa.

**Mitigation.** ADR-0008 → Phase 4. Migrate one board at a time, each verified against its
predecessor.

### R-04 — `freehire`'s engine endpoint is unverified and always fails · **likelihood: certain · impact: low**

**Evidence.** `applyos/PROVENANCE.md`: *"freehire endpoint unverified, fails loudly per-source"*.
It is still wired into the fan-in at `apps/cli/src/scrape.ts:113`.

**Impact.** Every engine scrape pays a guaranteed-failing fetch — a wasted request and a
misleading note in the run summary.

**Mitigation.** Phase 4 removes it until the endpoint is verified.

### R-05 — The provider SDK becomes a second contract that drifts from the CLI contract · **likelihood: medium · impact: high**

**Evidence.** ADR-0006 already establishes one contract. A TypeScript SDK beside it would be a
second one unless the CLI becomes a surface *over* the SDK.

**Impact.** The exact drift ADR-0002 exists to prevent, one layer down.

**Mitigation.** The SDK is the single implementation; the CLI is a thin surface. Contract tests
run against both.

---

## 3. Correctness risks

### R-06 — Silent wrong answers, the failure class this project exists to prevent · **likelihood: medium · impact: critical**

**Evidence.** The 2026-10-09 audit recorded **3 blockers** and **18+ majors** of this shape:
a fabricated location, a filter that silently did nothing, a gate that could never fire, a
`NaN` salary filter that kept every row, a summary that reported "no jobs" during an outage.

**Impact.** A candidate applies to the wrong roles, or misses the right ones, with no error
message. This is the worst outcome ApplyOS can produce.

**Mitigation.** The null discipline ([../engineering/standards.md](../engineering/standards.md#2-the-null-discipline));
contract tests in every provider suite; **Phase 9 delivered the measurement**: an offline corpus
with provenance, four runners (gates, dedupe, documents, ranking), a committed baseline and a CI
tolerance gate. The first run measured a 0.0000 false-reject rate and a 0.6667 dedupe false-merge
rate — the latter is a real finding the evaluation now guards against. See
[../engineering/evaluation.md](../engineering/evaluation.md).

### R-07 — A spec's prose drifts from the code's behaviour · **likelihood: high · impact: medium**

**Evidence.** Realised at least twice: the `cd cv` path bug (audit D-B1) and the phantom-command
list corrected in `CLAUDE.md:47-52`. `docs/AUDIT_2026-10-09.md` D-M1 through D-M9 are nine more
instances.

**Impact.** A candidate follows a step that does not work, or an agent follows a step that
produces the wrong file.

**Mitigation.** Phase 8's spec conformance tests; Phase 1's link and path checker.

### R-08 — The seen store grows without bound · **likelihood: high · impact: low**

**Evidence.** `tools/rank_state.py` exists because the store *"grows for the life of the
workspace"*. `sweep` retires expired entries but the file is never compacted.

**Impact.** Disk growth over a long search. Token cost is already avoided by the projection
design.

**Mitigation.** Q9 → Phase 3.

---

## 4. Security and privacy risks

### R-09 — The candidate publishes their profile to a public repository · **likelihood: medium · impact: critical**

**Evidence.** `/setup` writes the profile into **tracked** files. `README.md` warns: *"Run your
own search from a private repository."* A fork of a public template cannot be made private.

**Impact.** Name, email, phone number, employment history, salary expectations, and the entire
application history published.

**Mitigation.** `/setup` Step 0 checks the remote's visibility **before** writing anything and
warns loudly. `tools/security_guards.py` prevents the personal-data paths from being tracked
in the first place. **This is the highest-consequence risk in the project.**

**Residual.** A candidate who ignores the warning can still publish. The check is a warning, not
a block — blocking would prevent a legitimate private-repo workflow.

### R-10 — A nested `.gitignore` re-includes personal data · **likelihood: low (fixed) · impact: critical**

**Evidence.** Fixed in `78813db`: *"A nested `.gitignore` outranks the root rules for its own
directory, so `output/.gitignore` containing `!main_*.*` re-included compiled CVs while the
required root rule stayed present and the guard still reported OK."*

**Mitigation.** Every nested ignore file is now held to a reviewed-negation list.

### R-11 — The permission allowlist is widened · **likelihood: low (fixed) · impact: high**

**Evidence.** Fixed in `78813db`: blanket wildcards (`bun *`, `python *`) previously satisfied
all twelve per-portal entries. `permissions.defaultMode` was unchecked, so `bypassPermissions`
made the allowlist moot.

**Mitigation.** Blanket grants are refused for any action; coverage requires the whole tool path;
`defaultMode` is checked; `.claude/settings.local.json` is read too.

### R-12 — Prompt injection through a job posting · **likelihood: medium · impact: high**

**Evidence.** `SECURITY.md:11-13` describes the combination precisely: *"an LLM with file access
reads untrusted web content (job postings) alongside your personal data (CV, profile, application
history)."*

**Impact.** The agent follows an instruction embedded in a posting — to fetch a URL, to include a
skill, to change a file.

**Mitigation.** Instruction-level rules in every spec that reads a posting: the posting is data,
never instructions; links inside it are never fetched; research starts from the company identity
the user confirmed. The Grounding Audit removes any claim the profile does not support.

**Residual — stated honestly.** `SECURITY.md:17`: *"Instruction-level defenses raise the bar;
they are not a sandbox."* The allowlist governs Bash; the model's native WebFetch/WebSearch are
outside its reach. Phase 11 documents this formally rather than leaving it implicit.

### R-13 — A dependency compromise · **likelihood: low · impact: high**

**Evidence.** The engine and all provider CLIs have **zero runtime dependencies**, which is the
strongest mitigation available. `tools/security_guards.py` refuses package lifecycle scripts
and scans the manifests of `.agents/**` and `applyos/`. `dependency-review` runs in CI and
skips gracefully when the dependency graph is unavailable.

**Mitigation.** Keep the zero-dependency property; the SDK must not introduce one.

### R-14 — A third-party provider plugin exfiltrates data · **likelihood: low · impact: critical**

**Evidence.** Today, a provider is code in the candidate's own fork — reviewed by them. See
[../design/plugin-architecture.md](../design/plugin-architecture.md).

**Impact.** A provider with the agent's file access could read `workspace/` and `output/`.

**Mitigation.** Layer 2 (fork) is the primary path and is already implemented. Layer 3 (a
runtime registry) is deliberately deferred until a trust model exists.

### R-15 — The model exfiltrates via WebFetch or WebSearch · **likelihood: low · impact: critical**

**Evidence.** `SECURITY.md:14`: *"the allowlist governs Bash commands - the model's native
WebFetch/WebSearch tools are outside its reach, which is exactly why the instruction-level rules
above exist."*

**Mitigation.** Instruction-level rules. Phase 11 documents the residual risk and proposes
runtime-level containment for runtimes that support it.

---

## 6. Maintenance risks

### R-16 — Documentation drift · **likelihood: certain · impact: medium**

**Evidence.** Present at the time of this blueprint: `PROJECT_MAP.md` says 456 tests (actual
492), 3 methodology skills (actual 9), and lists a `.zcode/` directory that does not exist.
`lint_skills.py` reports 34 skills where the audit said 20.

**Impact.** A contributor trusts the wrong document. This is the mechanism behind R-07.

**Mitigation.** Phase 1: correct the documents, add a link/path checker, and adopt the rule that
**no document states a count that CI computes**.

### R-17 — The bootstrap is incomplete · **likelihood: certain (today) · impact: medium**

**Evidence.** The README's install loop covers `.agents/skills/*-search/cli` but not `applyos/`.
`bun test` in `applyos/` fails on a fresh clone with `Cannot find module '@applyos/core'`.

**Impact.** A contributor concludes the engine is broken.

**Mitigation.** Phase 1's bootstrap script.

### R-18 — The Bun version drifts · **likelihood: medium · impact: low**

**Evidence.** `applyos/.bun-version` pins **1.4.3**; the local machine has **1.4.2**; the
engine's devDependency pins `@types/bun 1.4.2`.

**Mitigation.** `applyos doctor` reports the mismatch.

### R-19 — A provider's CLI diverges from the shared contract · **likelihood: medium · impact: medium**

**Evidence.** `cli-shared/src/flags.ts` encodes four tokenizer modes because the boards really do
differ. `cli-shared/README.md` records that `fetchWithBackoff` and table renderers were
deliberately **not** unified.

**Impact.** A "simplification" that unifies them changes behaviour that tests pin.

**Mitigation.** The four modes stay. `cli-shared/README.md`'s "Deliberately NOT here" section is
the record; the SDK design must preserve it.

### R-20 — A POSIX-only command breaks a supported platform · **likelihood: medium · impact: medium**

**Evidence.** Audit finding **T-M4**: `09-web-research.md` used `cd "$SCRATCHPAD" && curl` and a
multi-line `python3 -c` string; Windows is a supported CI platform.

**Mitigation — closed in Phase 11.** One cross-platform implementation each: `tools/fetch_page.py`
and `tools/extract_text.py`, stdlib-only like every other tool. The two spec files call them; a
security guard fails any direct `curl`/`wget` or `cd … && …` reintroduced into a spec.

### R-21 — A detail fetch hangs a whole scrape · **likelihood: medium · impact: high**

**Evidence.** Audit finding **P-M12**: `weworkremotely/commands/detail.ts:31-42` fans out to ~10
RSS feeds with no overall timeout — *"multi-minute `/scrape` hang."*

**Impact.** A candidate's search appears to hang with no explanation.

**Mitigation — closed in Phase 11.** The SDK's `providerFetch` now enforces a total deadline over
all attempts and backoff, with a wall-clock race so a fetch that ignores its AbortSignal cannot
overrun it. The WWR detail sweep passes that deadline to every feed and raises a typed `timeout`
error when it is exceeded. Three tests cover the deadline, the retry boundary and the ordinary
no-deadline policy.

---

## 7. Project risks

### R-22 — Scope inflation · **likelihood: high · impact: medium**

**Evidence.** The competitor reference has 4,213 commits and a dashboard TUI, a web UI, an
evals directory, and a batch runner. The temptation to match it is real.

**Impact.** A small, sharp, India-focused tool becomes a large, unfocused one.

**Mitigation.** `CONTRIBUTING.md`'s bar: *"Speculative infrastructure — complexity must be
argued from a problem that exists."* This roadmap's [explicit non-goals](../architecture/target-architecture.md#7-explicit-non-goals)
list what is deliberately excluded.

### R-23 — The project depends on one agent or model · **likelihood: medium · impact: high**

**Evidence.** `/gmail-sync` requires `mcp__claude_ai_Gmail__*`; `/notion-sync` requires
`mcp__notion__*`. Both names are Claude-specific. A candidate on Codex or Antigravity cannot run
those two commands.

**Impact.** The "runtime-agnostic" claim is partially true — ten of thirteen commands work
everywhere; two need an MCP server that may not be configured.

**Mitigation.** Phase 8 documents the dependency precisely and defines a provider-neutral MCP
binding name. Q11 decides whether a degraded mode is worth building.

### R-24 — An external contributor cannot find the extension point · **likelihood: medium · impact: medium**

**Evidence.** `/add-portal` exists and is well specified, but it lives in a `.claude/commands/`
file. A contributor looking at `applyos/` finds no provider interface.

**Impact.** Contributions land in the wrong place, or not at all.

**Mitigation — closed in Phase 12.** Phase 4's SDK gave providers one documented interface; Phase 12
added a complete worked example (`examples/example-search/`), a seven-step funnel in
`CONTRIBUTING.md`, a worked walkthrough in `docs/developer/adding-a-portal.md` §9, and a one-command
check (`python tools/check_contribution.py`). The README links all three, and the example has its
own CI job so it cannot silently rot. Marketing-specific boards still belong in a private fork, but
the extension point is now discoverable from the landing page.

---

## 8. Risk summary

| ID | Risk | Likelihood | Impact | Phase |
|---|---|---|---|---|
| R-01 | Engine and spec layer stay disconnected | high | critical | 2 |
| R-02 | Two incompatible scoring models | certain | high | 5 |
| R-03 | Five boards implemented twice | certain | medium | 4 |
| R-04 | `freehire` engine adapter always fails | certain | low | 4 |
| R-05 | SDK drifts from the CLI contract | medium | high | 4 |
| R-06 | Silent wrong answers | medium | critical | 3, 4, 9 |
| R-07 | Spec prose drifts from code behaviour | high | medium | 1, 8 |
| R-08 | Seen store grows without bound | high | low | 3 |
| R-09 | Profile published to a public repo | medium | critical | 1 |
| R-10 | Nested `.gitignore` re-includes data | low (fixed) | critical | 11 |
| R-11 | Permission allowlist widened | low (fixed) | high | 11 |
| R-12 | Prompt injection via a posting | medium | high | 11 |
| R-13 | Dependency compromise | low | high | 11 |
| R-14 | Third-party plugin exfiltrates data | low | critical | 4, 12 |
| R-15 | Model exfiltrates via WebFetch | low | critical | 11 |
| R-16 | Documentation drift | certain | medium | 1 |
| R-17 | Bootstrap is incomplete | certain | medium | 1 |
| R-18 | Bun version drift | medium | low | 1 |
| R-19 | Provider CLI diverges from the contract | medium | medium | 4 |
| R-20 | POSIX-only command breaks Windows | medium | medium | 11 |
| R-21 | Detail fetch hangs a scrape | medium | high | 11 |
| R-22 | Scope inflation | high | medium | every |
| R-23 | Depends on one agent or model | medium | high | 8 |
| R-24 | Extension point is not discoverable | medium | medium | 4, 12 |

**Four risks are `certain` or `high` with `critical` impact.** R-01, R-02, R-06, and R-09 are the
four the roadmap must move first.

---

## 9. Reviewing this register

Phase 11 revisits every entry. For each:

1. Is the risk still real? (A fix may have landed.)
2. Is the impact still right? (Convergence may have changed it.)
3. Is the mitigation still the right one?
4. Are there new risks from the converged architecture?

A risk that is closed does not disappear — it moves to a "closed" section with the PR that
closed it, so the history stays auditable.

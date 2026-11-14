# Phase 8 — AI agents and runtime adapters

> **Status:** `PROPOSED` · **Depends on:** Phases 1, 2 ·
> **Risks:** [R-23](../roadmap/risks.md) ·
> **Resolves:** [Q11](../OPEN_QUESTIONS.md#q11--do-the-gmail-sync-and-notion-sync-mcp-dependencies-have-a-portable-fallback--non-blocking)

---

## Outcome

Every runtime reaches ApplyOS through **one invocation shape**, and the specs are **checked**,
not just trusted.

---

## Why now

ApplyOS's central claim is that it runs under any AGENTS.md-compatible agent. Two commands
break that claim today: `/gmail-sync` requires `mcp__claude_ai_Gmail__*` and `/notion-sync`
requires `mcp__notion__*` — both Claude-specific MCP namespaces. A candidate on Codex or
Antigravity cannot run them at all.

Meanwhile, the specs' correctness is checked only structurally. A spec that says "read
`output/cv/main_*`" when the file is `resume_*` passes every test. The audit found this class
of bug twice.

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Phase 1 (the link checker) | hard | Complete |
| Phase 2 (the engine is reachable) | hard | Complete |

---

## Affected modules

| Path | Change |
|---|---|
| `AGENTS.md` | The routing table becomes an invocation contract |
| `.opencode/command/*.md` | Thin pointers, unchanged in shape |
| `.codex/agents/gemini-research-expert.toml` | Resolved — the deprecated mirrors |
| `.claude/agents/gemini-research-expert.md` | Resolved |
| `.opencode/agent/gemini-research-expert.md` | Resolved |
| `tools/check_specs.py` | **New** — the spec conformance checker |
| `.github/workflows/ci.yml` | The conformance job |
| `docs/design/public-api.md` | The invocation contract is documented |

---

## Tasks

### 8.1 — Define the invocation contract

**Deliverable.** A documented shape every runtime uses:

```
applyos <command> [flags] --format json
```

**Requirements.**
- **One command, one flag vocabulary.** The same flag means the same thing in every command.
- **The JSON output is the contract.** A runtime that cannot run a shell reads the same JSON.
- **No runtime-specific behaviour.** Nothing in the core or the specs branches on which agent is
  running.

**Requirement.** The contract is documented in `docs/design/public-api.md` and referenced from
`AGENTS.md`.

### 8.2 — Rewrite `AGENTS.md` as a routing table over the contract

**Deliverable.** `AGENTS.md` keeps its role as the universal entry point but points at
`applyos <command>` rather than describing workflows.

**Requirements.**
- The 13-command routing table stays.
- The "India + global-remote edition" content stays — it is the product's identity.
- The "thin-pointer design" section is updated to reflect that the pointer target is now the
  invocation contract as well as the spec.

**Requirement.** `AGENTS.md` remains readable to an agent that has never seen the repo. It is
the first file any runtime reads.

### 8.3 — Resolve the deprecated `gemini-research-expert` mirrors

**Deliverable.** A decision.

**Evidence.** Three copies are marked `DEPRECATED 2026-10-10`: the `gemini -p` binary they
shell out to was removed on 2026-10-07. They are retained as a record, and a test keeps the three
in sync. But `.claude/agents/` is auto-loaded by Claude Code, so a runtime advertises a subagent
that fails on every invocation.

**Options.**
- (a) **Delete all three.** The record lives in git history.
- (b) Keep the marks, and move them out of the auto-loaded directories.
- (c) Replace them with a working research agent that uses the workflow's own WebFetch/WebSearch
  path.

**Recommendation.** (c), if the research subagent has a real role; otherwise (a). The specs
already have a research path — `09-web-research.md` — so a subagent that merely *runs* it adds
little. **Recommendation: (a), with the reasoning recorded.**

### 8.4 — Write the spec conformance checker

**Deliverable.** `tools/check_specs.py`.

**Checks.**

| # | Check | Bug it prevents |
|---|---|---|
| 1 | Every file path mentioned in a spec exists | The `cd cv` class (audit D-B1) |
| 2 | Every command a spec invokes is in the permission allowlist | A spec invoking an unapproved command |
| 3 | Every command a spec names exists in the repository | A spec invoking a command that was renamed |
| 4 | Every file a spec writes is under an allowed root | A spec writing outside `input/`, `output/`, `workspace/`, or the tracked profile files |
| 5 | Every status literal in a spec is in the tracker vocabulary | A spec inventing a status |
| 6 | Steps are numbered, ordered, and non-reachable-forward | A spec that skips a step |
| 7 | Every spec's "Files written" list matches the paths it actually names | A spec that under-declares its writes |
| 8 | Every spec declares its contracts | A spec without an invariant |

**Tests.** A self-test with a fixture spec that deliberately violates each rule.

**CI.** A `spec-conformance` job, green from the first run.

### 8.5 — Make the MCP dependencies portable

**Deliverable.** The `/gmail-sync` and `/notion-sync` specs depend on **capabilities**, not on a
specific vendor's tool names.

**Approach.** Define the capability each command needs (`gmail.search`, `gmail.thread`,
`notion.database`, `notion.page`) and specify the binding as a runtime-provided namespace.
Where a runtime provides a differently-named binding, the spec documents the mapping.

**Requirement.** The commands must not **require** an MCP server to exist. A candidate without
one gets a clear message: *"This command needs a Gmail-capable tool binding. Your runtime
provides: …"* — not a stack trace.

**Q11.** Decide whether a degraded mode exists (manual status entry only). **Recommendation:**
yes — the tracker is the source of truth and a human can always update a row. The command
becomes an accelerator, not a requirement.

### 8.6 — Document the agent-facing surface

**Deliverable.** A section in `docs/developer/` describing how an agent uses ApplyOS: the
invocation contract, the JSON shapes, the approval gates, and the untrusted-content rule.

### 8.7 — Extend the adapter parity test

**Deliverable.** `tests/test_runtime_adapters.py` asserts that every command in the
`AGENTS.md` routing table is reachable through the invocation contract.

---

## Tests

| Suite | Change |
|---|---|
| `tests/test_check_specs.py` | **New** — the conformance checker's self-tests |
| `tests/test_runtime_adapters.py` | Extended: the invocation contract and the MCP-capability mapping |
| `tests/test_skill_mirrors.py` | Unchanged |
| `tests/test_allowlist_pairing.py` | Extended: spec invocations are in the allowlist |

---

## Acceptance criteria

- [ ] The invocation contract is documented in `docs/design/public-api.md`.
- [ ] `AGENTS.md` routes to the contract and keeps the India/global-remote identity.
- [ ] Every command in the routing table is reachable through the contract.
- [ ] The `gemini-research-expert` mirrors are resolved, and the resolution is recorded.
- [ ] `tools/check_specs.py` runs in CI and is green.
- [ ] Every spec declares its contracts.
- [ ] `/gmail-sync` and `/notion-sync` degrade gracefully without an MCP server.
- [ ] The agent-facing surface is documented.
- [ ] The whole suite is green on three operating systems.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The conformance checker flags existing specs and gets disabled | high | medium | Run it as a report first; fix the specs in the same phase; only then make it a gate |
| Making the commands MCP-optional weakens their contract | medium | medium | The MCP path stays the primary; the degraded path is explicitly manual |
| `AGENTS.md` becomes thinner and less useful | medium | medium | The India guidance and the routing table stay; only the invocation detail moves |
| The deprecation removal loses something | low | low | Git history is the record |

---

## Rollback

| Change | Rollback |
|---|---|
| The invocation contract | It is additive; the specs keep their existing invocations |
| `AGENTS.md` | Revert the file. It is one file with a CI-checked structure |
| The conformance checker | Make it non-blocking |
| The MCP capability mapping | Revert to the vendor-specific names |
| The `gemini-research-expert` removal | Restore the three files from git |

---

## Definition of done

- [ ] All acceptance criteria pass in CI on three operating systems.
- [ ] Q11 is closed in `docs/OPEN_QUESTIONS.md`.
- [ ] `docs/IMPLEMENTATION_STATUS.md` moves the runtime-adapter rows to their new state.
- [ ] `docs/design/public-api.md` documents the invocation contract.
- [ ] `docs/developer/` gains the agent-facing surface.
- [ ] `CHANGELOG.md` has an `[Unreleased]` entry.

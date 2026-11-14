# Security Testing

> **Status:** `PROPOSED` — Phase 11 produces the reviewed version.
> **What exists today:** the guard suite in `tools/security_guards.py` and the CI jobs. This
> document describes what they cover, what a human must still check, and what cannot be tested
> from inside the repository.

---

## 1. The automated layer

### 1.1 `tools/security_guards.py`

Runs in CI as the `security-guards` job. It is the repository's most security-relevant piece of
code.

| Guard | What it catches | Closed hole |
|---|---|---|
| Allowlist presence | A missing allowlist entry | — |
| **Blanket-grant refusal** | `bun *`, `python *`, or any wildcard-only grant standing in for a specific rule | `78813db` — one `bun *` previously satisfied all twelve per-portal entries |
| **Whole-path coverage** | A grant for `bun` that does not name the full tool path | `78813db` |
| **Allowlist parity** | `.claude/settings.json` and `opencode.json` disagreeing, in **either** direction | `78813db` — parity was one-directional |
| **`permissions.defaultMode`** | `bypassPermissions` shipping beside an untouched allowlist | `78813db` — it made every allowlist entry moot |
| **`settings.local.json` read** | A session-hook vector hidden in the local settings file | `78813db` — Claude Code merges both files |
| **Gitignore rules** | A required personal-data rule being removed | — |
| **Nested gitignore negations** | `output/.gitignore` containing `!main_*.*` | `78813db` — a nested file outranks the root rule for its directory, so the required root rule could stay present while CVs were re-included |
| **Package lifecycle scripts** | A `postinstall` in any manifest | — |
| **Manifest scope** | A `package.json` outside `.agents/**` — specifically `applyos/` | `78813db` — a second `bun install` surface with its own tracked lockfile |
| **Hooks allowlist** | An unexpected hook registration | — |

**Every guard has a negative test** in `tests/test_security_guards.py` — a fixture that violates it
and must fail. A guard without a negative test is a comment.

### 1.2 The CI jobs

| Job | Security property |
|---|---|
| `security-guards` | SP-1 through SP-7 (see [threat-model.md](./threat-model.md#7-security-properties)) |
| `placeholder-integrity` | SP-13 — personal data was not committed in place of a placeholder |
| `python-tests` | The guards themselves are correct, including their negative cases |
| `dependency-review` | Newly introduced vulnerable dependencies. **Skips gracefully** when the dependency graph is unavailable, and says so in a workflow warning |
| `latex-smoke` | The compiled document's text layer is extractable — SP-14 |
| `cli-checks` | Every provider CLI typechecks and passes its own suite |

### 1.3 The workflow's own posture

| Property | How |
|---|---|
| Read-only permissions | `permissions: contents: read` |
| Pinned actions | Every action is pinned to a commit SHA, not a tag |
| No live network calls | The `APPLYOS_LIVE_TESTS` gate |
| Weekly full matrix | The TeX Live 2022 leg runs on a schedule and on manual dispatch |
| Manual trigger | `workflow_dispatch` |

**The honest limit, stated in the workflow's own header:**

> Deliberately NOT here: live smoke tests of the job-portal CLIs. They hit real portals
> (network-flaky, and the linkedin-search skill is personal-use only per its own ToS warning —
> CI-automated requests would violate that).

---

## 2. The human layer

Automation cannot check everything. A reviewer must verify these.

### 2.1 When a change touches a trust boundary

- [ ] Does the change make a network call? Which host, what data, what User-Agent?
- [ ] Does it change the permission allowlist? Then both files, in parity.
- [ ] Does it add a dependency? Then the zero-dependency promise is broken — justify it in the PR.
- [ ] Does it write a file outside `input/`, `output/`, `workspace/`, or the tracked profile files?
- [ ] Does it read personal data it does not need to?
- [ ] Does it change the robots, pacing, or retry policy?

### 2.2 When a change touches a spec that reads posting text

- [ ] Does the spec still state that the posting is data, never instructions?
- [ ] Does it still forbid fetching URLs found inside posting text?
- [ ] Does the research path still start from the user-confirmed company identity?
- [ ] Does the Grounding Audit still cover every claim?
- [ ] Could a malicious posting influence anything *other* than the parse?

### 2.3 When a change touches a provider

- [ ] Does it fetch only public or documented endpoints?
- [ ] Does it identify itself honestly, rather than impersonating a browser to bypass a block?
- [ ] Does it obey the pacing and retry policy?
- [ ] Does it fail loudly on a shape change, rather than returning an empty page that reads as
      "no jobs"?
- [ ] Are its tests offline?
- [ ] Does it use zero runtime dependencies?

### 2.4 When a change touches the CI workflow or the guards

- [ ] Is the change itself checked? (It is not, by definition — a PR can edit the workflow that
      checks it. Branch protection is the backstop.)
- [ ] Does it widen any permission?
- [ ] Does it add a live network call?
- [ ] Does it unpick an action SHA?
- [ ] Does it raise `permissions`?

### 2.5 When a change touches the profile files

- [ ] Are the placeholders still intact in the tracked template?
- [ ] Does the change avoid writing personal data into a tracked file?
- [ ] Does the `/setup` privacy check still run **before** anything is written?

---

## 3. The self-audit procedure

How to check ApplyOS's own security posture.

### 3.1 Automated

```
python tools/security_guards.py
python -m unittest discover -s tests -t . -k security
python tools/lint_skills.py
```

### 3.2 Manual

| Check | How |
|---|---|
| No personal data is tracked | `git ls-files \| grep -E '^(input\|output\|workspace)/'` must be empty |
| The placeholders survive | `grep -rn '\[YOUR_NAME\]' .claude/skills/job-application-assistant/01-candidate-profile.md` |
| The allowlists are narrow | Read `opencode.json` — every entry names a whole tool path |
| No lifecycle scripts | `grep -rn '"preinstall"\|"postinstall"\|"prepare"\|"install"' --include=package.json .` |
| The actions are pinned | `grep -n 'uses:' .github/workflows/ci.yml` — every line must have a SHA |
| The CI permissions are read-only | `grep -n 'permissions:' .github/workflows/ci.yml` |
| No live network in CI | `grep -rn 'APPLYOS_LIVE_TESTS' .agents/skills/*/cli/tests/` — every live block is gated |
| The deprecated subagent is marked | `grep -rn 'DEPRECATED' .claude/agents/ .opencode/agent/ .codex/agents/` |

### 3.3 Periodically

| Cadence | Review |
|---|---|
| Every release | The threat model's residual risks are still accurate |
| Every dependency change | The zero-dependency property |
| Every new MCP integration | A new external trust boundary |
| Every new spec command | The allowlist covers it |

---

## 4. What cannot be tested from inside the repository

| Requirement | Why it is outside | Where it belongs |
|---|---|---|
| Branch protection with required checks | Repository settings, not files | The maintainer |
| Human review of workflow and settings diffs | A process, not a check | The maintainer |
| A private repository for the candidate's search | The candidate's choice | `/setup`'s warning |
| The model provider's retention policy | Another organisation | The candidate's choice |
| The job boards' own integrity | Another organisation | Out of scope |

**Recording these is more useful than implying the repository's CI is a complete defence.** The CI
workflow's own header says it plainly: *"these guards catch accidents and casual attempts, not a
determined author."*

---

## 5. The disclosure process

Mirrors [`SECURITY.md`](../../SECURITY.md):

1. Report privately via **GitHub private vulnerability reporting**.
2. If unavailable, open a public issue that describes the **class** of problem without a working
   recipe.
3. A response is expected within a few days; credit is offered unless declined.
4. Public disclosure is coordinated with the patch.

---

## 6. Phase 11's additions to this strategy

| Addition | Rationale |
|---|---|
| A guard for spec-invoked commands outside the allowlist | A spec is executable instructions; an unapproved command is a permission bypass |
| A guard for spec writes outside the allowed roots | The personal-data boundary |
| A guard for `curl`/`wget` in a spec without an allowlist entry | Direct network access bypassing the polite-fetch path |
| A guard that the provider SDK's `dependencies` is empty | ADR-0004 and ADR-0006 |
| A total-deadline requirement on every fan-out path | Audit finding P-M12 — a per-request timeout is not an operation timeout |
| A portability check for POSIX-only commands | Audit finding T-M4 — Windows is a supported platform |
| The manual checklists above, as a review template | Automation cannot check intent |

**Each guard ships with a negative test.** A guard without one is a comment.

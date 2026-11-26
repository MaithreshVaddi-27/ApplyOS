# Threat model

> Phase 11. This model describes what ApplyOS actually does today. Where a risk is not mitigated,
> it is stated under **Residual risk** rather than implied by a cheerful description of controls.

## Scope

**In scope:** the repository's specs, the Python tooling, the engine CLI, the provider CLIs and the
SDK, the LaTeX/document pipeline, the local workspace files, and the CI workflow that guards them.

**Out of scope:** the candidate's model provider's own security, their OS and browser, the job
boards' own security, and a legal judgement about whether a given posting's terms permit scraping.
ApplyOS gives the candidate the facts to decide that last one; it does not decide for them.

## Assets

| Asset | Where | Why it matters |
|---|---|---|
| Candidate profile | `.claude/skills/job-application-assistant/01–09*.md`, `CLAUDE.md` | Identity, work history, references — the most sensitive data in the repo |
| Tracker | `workspace/job_search_tracker.csv` | Application history: where the candidate applied and how it went |
| Salary benchmarks | `salary_data.json` | Negotiation-sensitive local data |
| Document archive | `output/applications/**` | Submitted CVs and posting text |
| Search history | `workspace/seen_jobs.json`, `workspace/*_sync.json` | What the candidate looked at, when |
| Credentials | Never in the repo | An API key read from an environment variable |
| CI permissions | `.claude/settings.json`, `opencode.json`, hooks, CI workflow | The ability to run code on every fork user's machine |

## Trust boundaries

| Boundary | Crosses when | Control |
|---|---|---|
| Candidate's machine ↔ AI runtime | The agent reads a spec and runs a command | Bash allowlist; no blanket code-executing wildcards |
| Candidate's machine ↔ job boards | A provider CLI fetches a public endpoint | Honest UA, robots gate, page caps, pacing |
| Candidate's machine ↔ MCP servers | `/gmail-sync`, `/notion-sync` | Capability bindings; explicit approval; one-way sync |
| The agent ↔ model provider | Any prompt/response | Outside ApplyOS's control — see residual risk 1 |
| Third-party content ↔ the agent | A posting, email or outcome file is read | Untrusted-data rule: never instructions; never fetch its links |
| Developer ↔ CI | A PR changes workflow or settings | Guards + review; a PR can edit the workflow itself |

## Attacker capabilities

- **A malicious job posting** with hidden text that instructs the reader to exfiltrate a profile.
- **A hostile board** that returns huge bodies, endless pagination, or a login wall disguised as a result.
- **A compromised dependency** in a CLI or the SDK.
- **A malicious MCP server** that returns a plausible "status update" to steer a tracker write.
- **A careless candidate** who commits a personalised profile to a public fork.

## Abuse cases and mitigations

| Case | Mitigation in place |
|---|---|
| Prompt injection in a posting | The untrusted-content rule in `/apply`, `/scrape` and the agent-facing doc; commands never follow posting text |
| Exfiltration through a provider | Provider CLIs have zero runtime dependencies, an honest UA and fixed endpoints; specs forbid fetching links found in posting bodies |
| Credential theft from a repo | `.gitignore` rules for `.env` and personal data, guarded in CI; credentials are read from env vars only |
| Public-remote mistake | The privacy warning in `/setup` and `README.md`; a fork must be private |
| Permission bypass via a spec | `tools/check_specs.py` checks spec invocations against the allowlist and write roots; `security_guards.py` rejects direct `curl`/`wget` in a spec |
| CI supply-chain injection | Lifecycle scripts and `trustedDependencies` are forbidden in every manifest; actions pinned to SHAs |
| Fan-out hang (P-M12, fixed Phase 11) | The SDK's `providerFetch` enforces a **total** deadline over retries and backoff; the WWR detail sweep passes it to every feed |

## Residual risk — stated, not buried

1. **Instruction-level defences are not a sandbox.** The allowlist governs the Bash tool; it does
   not govern content the model reads through its native web tools. A posting can still attempt to
   steer the model itself. Mitigation path: keep the untrusted-content rule in every spec, prefer
   narrow tool scopes, and treat any surprising action as untrusted until traced. This cannot be
   fully closed inside a repository.
2. **A provider runs with the agent's file access.** Provider code is in the candidate's own fork,
   reviewed by them. Today there is no third-party registry; if one is ever built, the trust model
   changes completely — see `docs/design/plugin-architecture.md`.
3. **The profile lives in tracked files.** A candidate who ignores the `/setup` privacy warning can
   publish it. The warning is deliberately not a hard block: the framework must work in a public
   template repo where placeholders are tracked, and distinguishing a placeholder from a real profile
   reliably is not possible without the candidate's say-so. The candidate must use a private repo.
4. **The model provider sees the context.** Whatever the agent puts in a prompt leaves the machine
   under the provider's policy, not ApplyOS's. ApplyOS cannot prevent it and does not claim to.
5. **Search queries leave the machine.** A board must receive the query to answer it. Queries are
   generic by design ("python engineer"), never the profile text.

## Security properties — invariants a change must not break

- Nothing under `input/`, `output/`, `workspace/` or `salary_data.json` is committed.
- Every runtime command is in the allowlist; no blanket code-executing wildcard is added.
- Specs are executable instructions: no direct network command, no write outside the allowed roots.
- Provider CLIs and the SDK have zero runtime dependencies.
- A posting is data, never instructions; a spec never fetches a URL found in a posting body.
- Every fan-out path has a total deadline, not merely a per-request timeout.
- The tracker has one writer contract; a new surface must not write rows directly.

## Cannot be solved in the repository

Branch protection with required checks, human review of workflow and settings diffs, a private
repository for the candidate's own search, and a model provider whose privacy policy the candidate
accepts. These are recorded in `docs/security/security-testing.md` and are the real backstop.

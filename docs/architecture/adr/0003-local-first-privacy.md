# ADR-0003: Local-first privacy is a hard constraint, not a default

**Date**: 2026-07
**Status**: accepted
**Deciders**: ApplyOS maintainers

## Context

ApplyOS handles the most sensitive data a person has: their CV, employment history, salary
expectations, application history, and every draft document produced from those. An agentic
workflow reads this data alongside untrusted web content in the same context window.

The project's users are individuals running a personal job search — often students and early-career
professionals. "Your data might be uploaded to an LLM provider" is a disqualifying property for
this audience, not a terms-of-service checkbox.

The threat is real and structural: an LLM with file access reading untrusted job postings
alongside a CV is one prompt injection away from exfiltration.

## Decision

**Personal data never leaves the machine.** Concretely:

1. `input/**`, `output/**` (except tracked `.gitkeep` and `output/research/*.md` notes),
   `workspace/**`, and `salary_data.json` are gitignored and CI-enforced.
2. There is no backend, no account, no telemetry, and no analytics.
3. `/notion-sync` syncs **filenames only** — never document content.
4. The candidate must run their own search from a **private** repository; a fork of a public
   template is always public.

## Alternatives Considered

### Alternative 1: "Data stays local unless the user opts in"
- **Pros**: Simpler; the product could offer hosted features.
- **Cons**: An opt-in is one checkbox away from being on by default, and a hosted feature makes
  the project a service with an operational burden and a legal surface.
- **Why not**: The audience is exactly the group for whom the default must be safe.

### Alternative 2: Encrypt the profile and sync it
- **Pros**: Convenience without plaintext exposure.
- **Cons**: Encryption does not stop the server from seeing the plaintext after decryption, so it
  does not change the core property. It adds key management, which is worse than no sync.
- **Why not**: It buys the appearance of the guarantee without the guarantee.

### Alternative 3: Rely on instruction-level rules alone
- **Pros**: Zero enforcement cost.
- **Cons**: The model is not a sandbox. `SECURITY.md:17` states this plainly.
- **Why not**: Instruction-level rules raise the bar; they are not sufficient on their own. So
  they are kept *and* backed by CI.

## Consequences

### Positive
- The project can be forked, self-hosted, and audited by anyone.
- No breach of ApplyOS's own infrastructure is possible, because there is no infrastructure.
- `/notion-sync` is a genuinely optional, one-way, filename-only convenience.

### Negative
- No cross-device sync, no shared team workspace, no hosted collaboration.
- The candidate must run the toolchain locally: Python, Bun, LaTeX.
- Every distribution decision must preserve the property — including a future npm package
  (Phase 12) and any TUI (Phase 10).

### Risks
- **A future feature leaks data.** The permission allowlist in `opencode.json` /
  `.claude/settings.json` is the control surface, and `tools/security_guards.py` fails any PR
  that widens it, adds a package lifecycle script, or weakens the gitignore rules. That guard was
  itself hardened in `78813db` after three holes were found (nested `.gitignore` negations,
  blanket wildcard grants, and an unchecked `permissions.defaultMode`).
- **The model exfiltrates via WebFetch/WebSearch.** The allowlist governs Bash only; the model's
  native web tools are outside its reach. This is stated honestly in `SECURITY.md:14` and is the
  reason the untrusted-content rules are instruction-level and repeated in every spec.
  Phase 11 documents this residual risk formally.

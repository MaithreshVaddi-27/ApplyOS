# Phase 1 — Repository baseline and developer setup

> **Status:** `IMPLEMENTED` (2026-11-13) · **Gate:** none ·
> **Risks:** [R-07, R-09, R-16, R-17, R-18](../roadmap/risks.md) ·
> **Resolves:** [Q4](../OPEN_QUESTIONS.md#q4--is-project_mapmd82-correct-about-a-zcode-directory--non-blocking--resolved-2026-11-13),
> [Q7](../OPEN_QUESTIONS.md#q7--what-is-the-actual-install-experience-on-a-fresh-machine--non-blocking--resolved-2026-11-13)

## What shipped

| Task | Deliverable | State |
|---|---|---|
| 1.1 | `scripts/bootstrap.sh`, `scripts/bootstrap.ps1` | Done — both idempotent, both verified by running them |
| 1.2 | `applyos/apps/cli/src/doctor.ts` + `applyos/apps/cli/tests/doctor.test.ts` | Done — 28 tests |
| 1.3 | `tools/check_links.py` + `tests/test_check_links.py` + the CI `docs` job | Done — 23 tests |
| 1.4 | Documentation corrections | Done — `PROJECT_MAP.md`, `docs/AUDIT_2026-10-09.md`, `README.md`, `SETUP.md`, `CLAUDE.md`, `CHANGELOG.md`, `docs/README.md` |
| 1.5 | Toolchain alignment | Done — `@types/bun` 1.4.3 and `bun-types` ^1.4.3 across all six engine packages; `applyos/bun.lock` regenerated |
| 1.6 | Blueprint linked from the documentation index | Done |

**Verification after the phase.** 526 Python tests pass (1 skipped), 196 engine tests pass, 6/6
engine typechecks, all 12 portal CLI suites green, and all four repository guards report OK.

**Not verified locally:** the LaTeX smoke leg — this machine has no `lualatex`, no Poppler, and
no `pypdf`. CI's two `latex-smoke` legs cover it there.

**One design decision was reversed during the phase.** The doctor was first written to **fail**
on any GitHub remote once a profile existed. That would have cried wolf on exactly the
private-repository setup the project recommends, because doctor stays offline and cannot see the
visibility. The rule is now: a *known-public* remote with a populated profile fails; an
*unknown* visibility is a warning; `--check-remote` opts into the one network call.

---


## Outcome

A fresh clone reaches a green verification state with **one command**, and every document in
the repository tells the truth about the repository.

---

## Why now

Every later phase assumes a contributor can get to a green state and can trust the
documentation. Right now neither holds:

- `bun test` in `applyos/` fails on a fresh clone with `Cannot find module '@applyos/core'`,
  because the README's install loop covers the twelve provider CLIs but not the engine.
- `PROJECT_MAP.md` states 456 tests (actual: 492), 3 methodology skills (actual: 9), and lists
  a `.zcode/` directory that does not exist.
- The local toolchain is missing `lualatex` and Poppler, so two CI legs could not be run here.

Phase 1 is cheap, independent, and removes the friction from every phase that follows.

---

## Dependencies

**None.** This phase can start immediately.

---

## Affected modules

| Path | Change |
|---|---|
| `README.md` | Install section; test-count references |
| `SETUP.md` | Prerequisites; the `applyos/` install step |
| `PROJECT_MAP.md` | Correct counts, skills, and the `.zcode/` row |
| `docs/README.md` | Link the new blueprint tree |
| `CONTRIBUTING.md` | The bootstrap command in "Claims get verified" |
| `scripts/bootstrap.*` | **New** — the one-command installer |
| `applyos/apps/cli/src/cli.ts` | Add the `doctor` command |
| `applyos/apps/cli/src/doctor.ts` | **New** |
| `tools/check_links.py` | **New** — the link and path checker |
| `.github/workflows/ci.yml` | Add the link-check and Mermaid jobs |

---

## Tasks

### 1.1 — Write the bootstrap script

**Deliverable.** `scripts/bootstrap.sh` (bash) and `scripts/bootstrap.ps1` (PowerShell), both
performing the same steps:

1. Check `python` ≥ 3.10, `bun`, `lualatex`, and (`pdftotext` or `pypdf`).
2. `bun install` in `applyos/`.
3. `bun install` in each `.agents/skills/*/cli/`.
4. Run the full verification suite and print a summary.

**Requirements.**
- **Fail loudly and specifically.** "LaTeX is not installed — `/apply` Step 5 cannot compile
  documents. See SETUP.md#latex." is useful; "setup failed" is not.
- **Idempotent.** Running it twice is a no-op.
- **Never touch personal data.** It must not read, write, or move anything under `input/`,
  `output/`, or `workspace/`.
- **Report a summary.** What was checked, what was installed, what is missing.

**Tests.** A test that the script exists, is syntactically valid for both shells, and contains
the `applyos` install step (the omission that caused this work).

### 1.2 — Add `applyos doctor`

**Deliverable.** `applyos/apps/cli/src/doctor.ts` and the dispatch entry in `cli.ts`.

**Checks.** Bun version vs `.bun-version` · Python version · `lualatex` presence and
`moderncv` availability · `pdftotext`/`pdfinfo`/`pypdf` · workspace link resolvability ·
per-provider-CLI install state · `input/`, `output/`, `workspace/` presence and writability ·
profile presence and detected stage/document type · `salary_data.json` presence · whether the
git remote is public (a privacy warning).

**Exit codes.** 0 when every required check passes; 1 when a required check fails, listing the
failures.

**Tests.** Unit tests for the check functions with a fake environment; a CLI-level test for the
exit code.

**Evidence.** The design is in [../design/cli-design.md](../design/cli-design.md#7-the-doctor-command-proposed).

### 1.3 — Add a link and path checker

**Deliverable.** `tools/check_links.py`.

**Checks.**
1. Every relative Markdown link in `docs/`, `.claude/`, and the root `*.md` resolves.
2. Every **file path** mentioned in a command spec exists — this is the `cd cv` class of bug
   (audit D-B1).
3. Every `bun run .agents/skills/<x>/cli/src/cli.ts` mentioned in a spec points at a skill that
   exists.
4. Every `python tools/<x>.py` mentioned in a spec exists.
5. Every Mermaid block parses.

**Tests.** A self-test with a fixture directory containing a deliberately broken link and a
deliberately wrong path.

**CI.** A new `docs` job that runs it. It must not be allowed to fail silently — a checker that
is red on day one and stays red gets ignored.

### 1.4 — Correct the drifted documentation

| Document | Correction |
|---|---|
| `PROJECT_MAP.md:96` | "456-test suite" → the actual number, or a link to the command. **Prefer the command** — see [../engineering/standards.md](../engineering/standards.md#32-the-drift-problem-and-the-rules-that-address-it) |
| `PROJECT_MAP.md:78` | "the three methodology skills" → the actual set, or "the methodology skills" |
| `PROJECT_MAP.md:82` | Remove the `.zcode/` row, or create the directory. **Decision:** the evidence (`AGENTS.md` routes ZCode through the routing table; no `.zcode/` exists) says remove the row. Record it in Q4's resolution. |
| `PROJECT_MAP.md:83` | ".github/ — Lint + security guards + 456 tests" → the command |
| `docs/AUDIT_2026-10-09.md` | Add a header note: *"Superseded in part by `78813db`; see `docs/IMPLEMENTATION_STATUS.md` for the current ledger."* **Do not rewrite the audit** — it is a historical record |
| `README.md` | Add `applyos/` to the install loop; add the bootstrap command |
| `SETUP.md` | Same; document the `lualatex` minimal package set |
| `CLAUDE.md` | Cross-link the blueprint; no workflow changes |
| `CHANGELOG.md` | An `[Unreleased]` entry |

**Do not change** `AGENTS.md`'s routing table or any spec's workflow content in this phase.

### 1.5 — Align the toolchain version story

**Deliverable.** The `.bun-version` pin (1.4.3), the `@types/bun` devDependency (1.4.2), and the
`bun.lock` are reconciled, and `doctor` reports the difference.

**Requirement.** Do **not** bump to a version the CI matrix has not exercised. The safe move is
to align the *devDependency* to the pinned runtime (1.4.3) and let CI verify — not to change the
runtime pin.

### 1.6 — Add the blueprint to the documentation index

**Deliverable.** `docs/README.md` gains a section linking the new tree. `README.md` gains a link
to `docs/PROJECT_BLUEPRINT.md`.

---

## Tests

| Suite | Change |
|---|---|
| `tests/test_readme_assets.py` | Assert the README references the bootstrap command and `applyos/` install |
| `tests/test_check_links.py` | **New** — the link checker's own tests, including negative cases |
| `applyos/apps/cli/tests/doctor.test.ts` | **New** — the doctor checks and exit codes |
| `tests/test_setup_command.py` | Assert `SETUP.md` documents the `applyos/` install step |

**Full gate before merging.**

```
python -m unittest discover -s tests -t .
python tools/lint_skills.py
python tools/security_guards.py
python tools/check_links.py
cd applyos && bun run test && bun run --filter "*" typecheck
for d in .agents/skills/*/cli; do (cd "$d" && bun run test); done
```

---

## Acceptance criteria

- [ ] `scripts/bootstrap.sh` and `scripts/bootstrap.ps1` exist, are idempotent, and install
      `applyos/` as well as the provider CLIs.
- [ ] A fresh clone on a machine with the documented prerequisites reaches a green state via
      the bootstrap command alone.
- [ ] `applyos doctor` exists, reports every check, and exits 1 when a required check fails.
- [ ] `tools/check_links.py` runs in CI and is green.
- [ ] `PROJECT_MAP.md` contains no count that CI computes and no path that does not exist.
- [ ] `docs/AUDIT_2026-10-09.md` carries a supersession note and is otherwise unmodified.
- [ ] Every relative link in `docs/`, `.claude/`, and the root markdown files resolves.
- [ ] Every Mermaid block in the blueprint renders.
- [ ] `CHANGELOG.md` has an `[Unreleased]` entry describing the phase.
- [ ] `docs/IMPLEMENTATION_STATUS.md` records the new tools.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The link checker fails on pre-existing broken links and gets disabled | medium | medium | Run it first as a report; land the fixes in the same PR; only then make it a gate |
| The bootstrap script behaves differently on PowerShell and bash | medium | medium | Both scripts produce the same output; a test asserts the same checklist appears in both |
| The doctor command adds a dependency the zero-dependency promise forbids | low | high | `doctor` uses only `node:fs`, `node:child_process`, `node:path` — no packages |
| The documentation corrections conflict with a concurrent PR | low | low | Merge documentation corrections in their own PR, before the tooling PR |

---

## Rollback

Every task in this phase is additive or a documentation correction.

- The bootstrap script can be deleted; the README keeps the manual loop as a fallback.
- `doctor` can be removed from the dispatch; nothing depends on it.
- The link checker can be made non-blocking; it never blocks the repository from being used.
- The documentation corrections are independent and can be reverted individually.

**Worst case if the whole phase is abandoned:** the repository is exactly as it is today, minus
the documentation corrections, which are improvements regardless.

---

## Definition of done

- [ ] All acceptance criteria pass in CI on ubuntu, windows, and macos.
- [ ] `docs/IMPLEMENTATION_STATUS.md` — the "Local environment gaps" and "Infrastructure" rows
      are updated.
- [ ] `docs/OPEN_QUESTIONS.md` — Q4 and Q7 are closed with the resolution recorded.
- [ ] `docs/DECISION_LOG.md` — any decision made here is recorded.
- [ ] `docs/CHANGE_IMPACT_MATRIX.md` — §7 gains the new commands.
- [ ] `CHANGELOG.md` — an `[Unreleased]` entry.
- [ ] `README.md` and `SETUP.md` point at the bootstrap command.

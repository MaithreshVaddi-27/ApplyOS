# Releasing ApplyOS

> Phase 12 (12.6). A release is a **vetting checkpoint on `main`**, not an automated consequence
> of a merge. The decision is manual at one maintainer's scale: automating the judgement about
> what is ready is the wrong trade until there are several releases' worth of history.

## When to release

A release is warranted when `main` has accumulated a coherent set of changes that a candidate
would want to pull into their private fork — typically a completed blueprint phase or a set of
correctness fixes. It is **not** warranted by a single trivial commit, and a release is never a
way to "ship" an untested idea.

The `framework_version` markers are the mechanism that makes a release safe for a candidate who
has personalised their fork. Each release tells them exactly which of their customised files a
release touched, so they can decide whether to take the change.

## Procedure

1. **Freeze scope.** Confirm the release contains one coherent story. No half-finished phase.
2. **Run the full gate suite** (the same thing CI runs):
   ```bash
   python tools/check_contribution.py
   ```
   This runs the Python tool tests, every guard (lint, security, spec conformance, links, spec
   parity), the evaluation suites, the engine tests and typechecks, and the worked-example checks
   — all offline. LaTeX compiles and dependency review stay in CI.
3. **Run the framework-version guard** and resolve any marker that changed without a bump:
   ```bash
   python tools/check_framework_version.py
   ```
4. **Update `CHANGELOG.md`.** Move the `[Unreleased]` entries into a new `## [X.Y.Z] - YYYY-MM-DD`
   section with the date, and leave an empty `[Unreleased]` above it. Follow Keep a Changelog.
   Every user-visible change gets a line; internal refactors are noted under their phase entry.
5. **Bump `framework_version` in every spec file the release changed.** The guard in step 3 tells
   you which ones. Mirror any `.claude/` skill or command to its `.agents/` counterpart byte-for-byte
   (`tests/test_skill_mirrors.py` enforces this).
6. **Tag the release** on `main`, annotated, with the version and a short summary:
   ```bash
   git tag -a vX.Y.Z -m "Release X.Y.Z: <one-line summary>"
   git push origin vX.Y.Z
   ```
7. **Create a GitHub Release** from the tag with the CHANGELOG section as the notes. There is no
   npm publication and no binary artifact — distribution is "clone the repo" (Q6 resolved to
   publish nothing).
8. **Verify** that CI is green on the tag and that the CHANGELOG version matches the tag.

## Versioning

Semantic-style versions `X.Y.Z`:

- **X (major)** — a breaking change to the CLI surface, the spec routing table, or the tracker
  contract. Since Phase 10 the CLI surface is additive-only within a major version, so a major
  bump is a deliberate, documented break.
- **Y (minor)** — a new capability, a completed blueprint phase, a new portal, or a new evaluation
  suite.
- **Z (patch)** — a correctness fix, a doc correction, or a guard improvement with no new
  behaviour.

`framework_version` on a spec file is **not** the same number as the release semver: it is a
per-file marker that tells a candidate their local copy of *that file* diverged. A release may
bump only the markers of files it touched.

## Automation: deliberately manual

`release-please` and a release workflow are **not** used. The reason is recorded in the phase
spec: at one maintainer's scale the release is a judgement about readiness, and automating that
judgement is the wrong trade. Revisit when there are several releases' history and the judgement
has become mechanical. When that happens, automate steps 4–8 and keep step 1 human.

## Rollback

A release cannot be "unreleased" from a candidate's fork. If a published tag is broken:

1. Do not delete the tag. Add a `## [X.Y.Z+1]` patch release with the fix.
2. If the break is severe, mark the GitHub Release as a pre-release with a prominent warning
   pointing to the fix, and document it in `docs/UPGRADES_YYYY-MM-DD.md`.
3. The in-repo path never changes: `main` stays the source of truth, so a candidate who has not
   pulled the bad tag is unaffected.

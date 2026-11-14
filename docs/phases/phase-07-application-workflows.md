# Phase 7 — Application workflows and tracking

> **Status:** `PROPOSED` · **Depends on:** Phases 2, 3, 6 ·
> **Risks:** [R-03](../roadmap/risks.md)

---

## Outcome

The tracker has a **versioned schema with a migration function**, and the application archive
follows one documented naming and content rule.

---

## Why now

`workspace/job_search_tracker.csv` is the highest-fanout contract in the repository. It is
written by `/apply`, `/outcome`, and `/gmail-sync`, and read by `/rank`, `/html-report`, and
`/notion-sync`. It has **no schema version**, **no migration path**, and **no single source for
its status vocabulary** — the vocabulary lives in prose inside `/outcome`'s spec and is
reproduced by `/gmail-sync` and `/notion-sync`.

Any change to a column name or a status spelling breaks five commands and silently corrupts
every candidate's history.

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Phase 2 | hard | Complete |
| Phase 3 (the shared contract and error vocabulary) | hard | Complete |
| Phase 6 (the profile and the manifest) | hard | Complete |

---

## Affected modules

| Path | Change |
|---|---|
| `workspace/job_search_tracker.csv` | The data (gitignored — the schema, not the file, is what changes) |
| `applyos/packages/core/src/tracker.ts` | **New** — the schema, the reader, the writer, the migration |
| `tools/rank_state.py` | Uses the shared schema for the tracker's read-only view |
| `.claude/commands/outcome.md` | The status vocabulary and the column list move to the shared definition |
| `.claude/commands/apply.md` | Step 6b writes through the shared writer |
| `.claude/commands/gmail-sync.md` | Step 7a writes through the shared writer |
| `.claude/commands/html-report.md` | Step 1 reads through the shared reader |
| `.claude/commands/notion-sync.md` | Step 2 reads through the shared reader |

---

## Tasks

### 7.1 — Define the tracker schema

**Deliverable.** `applyos/packages/core/src/tracker.ts` exports the column list, the status
vocabulary, and the type definitions.

**Requirements.**
- The 14 columns stay, in the same order. `cover_letter_file` **stays in the header** and stays
  empty — the spec is explicit: *"The `cover_letter_file` column is legacy and stays in the
  header."*
- The status vocabulary is the 9 canonical underscore spellings. The legacy space spellings
  (`no response`, `offer declined`) are **accepted on read and never written**.
- `interview_only` is archive-only and never a tracker status.

**Requirement.** The vocabulary must be **readable from one place** by all six commands. Today it
is prose in one spec and duplicated prose in two others.

### 7.2 — Write the reader and the writer

**Deliverable.** Typed read and write functions.

**Requirements.**
- The writer **never restructures the file**: no column reordering, no row reordering, no
  rewriting of untouched rows.
- Updates are **idempotent**. Writing the same status twice produces the same file.
- The writer preserves the exact byte content of rows it does not touch, including fields the
  current code would reformat.

**Test.** A test writes a fixture tracker, applies one update, and asserts every untouched byte
is identical.

### 7.3 — Write the migration function

**Deliverable.** `migrate(from: number, to: number, csv: string): string`.

**Requirements.**
- Migrations are **explicit and versioned**: `migrate(1, 2, rows)`.
- Each migration is **pure** — same input, same output.
- A migration that would lose information **fails loudly** rather than dropping the row.
- The legacy status spellings are handled by a **read-time normalisation**, not a migration, so
  a workspace never has to be rewritten to be readable.

### 7.4 — Add `schemaVersion`

**Deliverable.** A version marker alongside the tracker.

**Requirement.** Where it lives is a decision: a sidecar file (`workspace/.tracker_version`), a
header comment (impossible in CSV), or a first-row convention. **Recommendation:** a sidecar
file. A missing sidecar means version 1, which is the current format.

### 7.5 — Move the archive layout rules into one definition

**Deliverable.** The `<company>_<role>/` naming rule, the file set, and the "never overwrite"
rule are defined once and referenced by `/apply`, `/outcome`, `/interview`, and `/gmail-sync`.

**Requirements.**
- The "archived version is the submitted version" rule — archive files are **copied, never
  moved**, and never overwritten once written.
- The normalisation rule for `<company>` and `<role>` slugs.

### 7.6 — Route every writer through the shared code

**Deliverable.** `/apply`, `/outcome`, and `/gmail-sync` write through the shared writer.

**Requirement.** The specs keep their approval gates, their prose, and their error handling. They
change only the write call.

### 7.7 — Add `applyos tracker` commands

**Deliverable.** `applyos tracker list`, `set`, and `migrate`.

**Requirements.**
- `list` — read-only, with `--status` and `--format`.
- `set` — updates one row's status, notes, and date. **No confirmation prompt** — the CLI never
  prompts; the agent asks the human, not the CLI.
- `migrate` — applies a version migration, with `--dry-run` as the default.

### 7.8 — Add the tracker's own evaluation hooks

**Deliverable.** The tracker reads and writes are exercised by the Phase 9 evaluation.

**Requirement.** The evaluation needs a labelled tracker fixture to measure whether the status
vocabulary and the writer behave correctly across versions.

---

## Tests

| Suite | Change |
|---|---|
| `applyos/packages/core/tests/tracker.test.ts` | **New** — the schema, reader, writer, migration |
| `tests/test_tracker_status_vocab.py` | Extended: the vocabulary comes from the shared source |
| `tests/test_outcome_followup.py` | Unchanged in expectations |
| `tests/test_apply_records_application.py` | Unchanged in expectations |
| `tests/test_gmail_sync_command.py` | Unchanged in expectations |
| `tests/test_html_report_command.py` | Unchanged in expectations |
| `tests/test_notion_sync_command.py` | Unchanged in expectations |

**The requirement that matters.** The four command specs' existing tests must pass **unmodified**.
If a command's test needs changing because of the shared writer, the writer changed behaviour
— that is a bug.

---

## Acceptance criteria

- [ ] The tracker has one schema definition, read by all six commands.
- [ ] The 14 columns and their order are unchanged.
- [ ] `cover_letter_file` remains in the header and remains empty.
- [ ] The 9 canonical status spellings are the only ones written.
- [ ] The legacy space spellings are still read.
- [ ] The writer preserves untouched rows byte-for-byte.
- [ ] Updates are idempotent.
- [ ] A migration function exists, is pure, and fails loudly rather than losing data.
- [ ] `schemaVersion` is present and additive.
- [ ] The archive layout rules are defined in one place.
- [ ] `/apply`, `/outcome`, and `/gmail-sync` write through the shared writer.
- [ ] `applyos tracker list|set|migrate` exists.
- [ ] The four existing command test suites pass unmodified.
- [ ] The whole suite is green on three operating systems.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The shared writer reformats a row it did not touch | medium | high | A byte-equality test on untouched rows |
| A migration loses data | low | critical | Migrations are pure and fail loudly; a fixture-based test covers each one |
| A candidate's existing tracker becomes unreadable | low | critical | The schema version defaults to 1 when absent; the read path accepts version 1 unchanged |
| The specs become less readable because they now call code | medium | medium | The specs keep the prose, the approval gates, and the error handling. Only the write call changes |
| A status spelling is changed and a stored status becomes unknown | medium | medium | The vocabulary is frozen for the version; a migration handles any future change |

---

## Rollback

| Change | Rollback |
|---|---|
| The shared writer | The specs revert to their inline writes. The tracker format is unchanged either way. |
| `schemaVersion` | Additive. Removing it returns the file to version 1 semantics. |
| The migration function | Unused until invoked; removing it changes nothing |
| `applyos tracker` | New commands; removing them changes nothing |
| The archive rules | The definitions move back into the specs |

---

## Definition of done

- [ ] All acceptance criteria pass in CI on three operating systems.
- [ ] `docs/IMPLEMENTATION_STATUS.md` records the versioned tracker contract.
- [ ] `docs/design/document-formats.md` §5.2 documents the schema version and the migration.
- [ ] `docs/design/public-api.md` §4.3 documents the tracker versioning policy.
- [ ] `docs/CHANGE_IMPACT_MATRIX.md` §6 reflects the tracker's new ownership.
- [ ] `CHANGELOG.md` has an `[Unreleased]` entry.

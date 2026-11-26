# Phase 6 — Candidate profiles and the document engine

> **Status:** `IMPLEMENTED` · **Depends on:** Phases 2, 3 ·
> **Risks:** [R-06, R-09](../roadmap/risks.md)

---

## Outcome

The candidate profile exists in a **machine-readable** form alongside the markdown, and every
generated document carries a **machine-checkable claim manifest**.

---

## Why now

Two problems block Phase 9's document-fidelity evaluation:

1. **The profile is only readable by an agent.** `01-candidate-profile.md` is markdown prose with
   a specific shape, but nothing validates it. The engine's `loadProfile` expects a **JSON**
   profile with a completely different shape (`apply.ts:141-151`), and the two are unrelated.
   The `gates.ts:34` comment says *"file wiring lands in Phase 5"* — it never did.
2. **Grounding is a model instruction, not an artefact.** The Grounding Audit checks every claim
   against three sources. It works, but nothing records the result, so nothing can verify it.

Both are prerequisites for evaluation. Neither requires changing the LaTeX pipeline — ADR-0005
stands.

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Phase 2 | hard | Complete |
| Phase 3 (the shared contract) | hard | Complete |
| Phase 9 needs the manifest | forward | This phase delivers it |

---

## Affected modules

| Path | Change |
|---|---|
| `.claude/skills/job-application-assistant/01-candidate-profile.md` | The markdown stays; a JSON twin is derived |
| `applyos/packages/docgen/src/manifest.ts` | **New** — the Document Manifest |
| `applyos/packages/docgen/src/profile.ts` | **New** — the profile reader and validator |
| `applyos/packages/docgen/src/pack.ts` | Emits the manifest |
| `.claude/commands/apply.md` | Step 2's Grounding Audit writes the manifest |
| `.claude/commands/setup.md` | Step 3 derives the JSON profile |
| `applyos/apps/cli/src/apply.ts` | Uses the shared profile reader |
| `tools/verify_pdf.py` | **New flag** — `--manifest` cross-check |

---

## Tasks

### 6.1 — Define the profile schema

**Deliverable.** A documented JSON schema for the candidate profile.

```json
{
  "schemaVersion": 1,
  "name": "…",
  "email": "…",
  "phone": "+91 XXXXX XXXXX",
  "location": "Hyderabad",
  "stage": "fresher",
  "graduationYear": 2026,
  "skills": ["python", "react"],
  "experience": [ { "role": "…", "company": "…", "period": "…",
                    "bullets": [ { "text": "…", "source": "01-candidate-profile.md#…" } ] } ],
  "education": [ { "degree": "…", "school": "…" } ],
  "documentType": "cv",
  "salary": { "stipendFloor": 20000, "ctcFloor": 6 },
  "source": { "profile": "01-candidate-profile.md", "generated": "<timestamp>" }
}
```

**Requirements.**
- **The markdown remains the source of truth.** The JSON is *derived* from it, never
  independently edited. The `source` field names the file it came from.
- Every experience bullet carries a `source` pointing at the profile section it came from. This
  is what makes grounding checkable.
- The schema validates the *shape* only. It does not judge whether a skill is real.

### 6.2 — Write the validator

**Deliverable.** `applyos/packages/docgen/src/profile.ts`.

**Requirements.**
- Fail loud with a specific message naming the field: *"profile invalid: skills[2] must be a
  string"* — not *"invalid profile"*.
- Reject a profile whose `source` does not exist.
- Warn (not fail) when a bullet has no `source`, because that is a grounding gap, not a
  malformed file.

**Tests.** A suite of malformed profiles, each asserting the specific message.

### 6.3 — Derive the JSON profile during `/setup`

**Deliverable.** `/setup` Step 3 writes the JSON profile alongside the markdown.

**Requirements.**
- The markdown write is unchanged and still the primary artefact.
- The derivation is idempotent — re-running `/setup` produces the same JSON.
- The derivation is **read-only** with respect to the markdown.

**Alternative considered.** Making the JSON the source of truth and generating the markdown from
it. Rejected: the markdown is human-editable, diff-friendly, and is what the candidate reads.
The JSON must follow the human, not the reverse.

### 6.4 — Define the Document Manifest

**Deliverable.** `applyos/packages/docgen/src/manifest.ts`.

```json
{
  "documentVersion": 1,
  "documentType": "resume",
  "posting": { "url": "…", "title": "…", "company": "…" },
  "profile": "01-candidate-profile.md",
  "claims": [
    { "text": "Reduced p99 latency by 40%",
      "source": "01-candidate-profile.md#achievements",
      "grounded": true }
  ],
  "ungrounded": [],
  "gaps": ["kubernetes"],
  "pageBudget": { "document": "resume", "pages": 1, "required": 1 },
  "ats": { "extractable": true, "chars": 2841 }
}
```

**Requirements.**
- `claims` is the complete set of factual claims in the document. `ungrounded` is the subset the
  Grounding Audit could not source — **it must be empty in a delivered document**.
- `gaps` is the explicit list of things the posting wanted that the candidate does not have.
  Gaps are reported, never stuffed.
- `pageBudget` records the required and actual page count, so a regression is visible without
  opening the PDF.

### 6.5 — Emit the manifest from `/apply`

**Deliverable.** `/apply` Step 2 writes `output/cv/<DOC_STEM>.manifest.json` next to the `.pdf`.

**Requirements.**
- The Grounding Audit in Step 2 populates `claims` and `ungrounded`.
- A claim with no source **is removed from the document** before it is compiled — the manifest
  records the removal in `ungrounded`, and the document does not contain it.
- The manifest is written **after** the document is final, so it describes what was actually
  delivered.

### 6.6 — Cross-check the manifest against the PDF

**Deliverable.** `tools/verify_pdf.py --manifest <file>` verifies that every claim's text
appears in the PDF's extracted text layer.

**Requirement.** This closes the loop: a claim in the manifest that is not in the PDF means the
manifest and the document disagree. A claim in the PDF that is not in the manifest means the
document contains an unsourced claim — the exact failure the Grounding Audit exists to prevent.

**This is the highest-value check in the project.** It turns a model instruction into a
mechanical gate.

### 6.7 — Wire the engine to the shared profile reader

**Deliverable.** `applyos apply --profile` uses the Phase 6 reader.

**Requirement.** The engine's ad-hoc JSON shape (`apply.ts:123-153`) is replaced by the shared
schema. The `profile-not-found` and `profile-invalid` error codes are preserved exactly.

### 6.8 — Harden the LaTeX pipeline's edge cases

**Deliverable.** Two guards added to `verify_pdf.py` or the compile step.

| Guard | Why |
|---|---|
| The compiled PDF's page count must equal the budget | The budget is already asserted in CI for the stock templates; this applies it per generated document |
| The phone placeholder must not be `[YOUR_PHONE]` | A bare `_` is a LaTeX subscript and aborts the compile. The rule is documented in `/setup` and `/reset`; a check makes it enforceable |

---

## Tests

| Suite | Change |
|---|---|
| `applyos/packages/docgen/tests/profile.test.ts` | **New** — the validator |
| `applyos/packages/docgen/tests/manifest.test.ts` | **New** |
| `applyos/packages/docgen/tests/pack.test.ts` | Extended: the manifest is emitted |
| `tests/test_verify_pdf.py` | Extended: `--manifest` |
| `tests/test_document_types.py` | Extended: the page budget per document |
| `tests/test_setup_command.py` | Extended: the JSON profile derivation |
| `tests/test_placeholder_integrity.py` | Extended: the phone placeholder |

---

## Acceptance criteria

- [x] A documented profile schema exists with a validator. — `docgen/src/profile.ts`, field-level
      errors, `schemaVersion: 1`, documented in `docs/design/document-formats.md` §7.5.
- [x] `/setup` derives the JSON profile idempotently, and the markdown remains the source of truth. —
      Step 2a writes `~/.applyos/profile.json`; `tests/test_setup_command.py` guards it.
- [x] Every generated document has a manifest beside it. — `/apply` Step 5d writes
      `<DOC_STEM>.manifest.json` after compilation; `buildPack` emits it.
- [x] `ungrounded` is empty in every delivered document. — `verify_pdf.py --manifest` fails on a
      non-empty list.
- [x] `verify_pdf.py --manifest` passes for a generated document. — `tests/test_verify_pdf.py`.
- [x] A manifest/document mismatch fails the check. — A claim missing from the PDF text layer, or
      an ungrounded claim present in it, raises `VerificationError`.
- [x] The page budget is asserted per generated document, not only for the stock templates. — The
      manifest's `pageBudget.required` is compared with the compiled PDF's actual pages.
- [x] The engine uses the shared profile reader, with the error codes unchanged. — `apply.ts` calls
      `loadProfileFile`; `profile-not-found` and `profile-invalid` prefixes are preserved.
- [x] The LaTeX pipeline itself is **unchanged** — ADR-0005 stands. No compile step was edited.
- [ ] The whole suite is green on three operating systems.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The JSON profile drifts from the markdown | high | medium | The JSON is derived, never hand-edited; `source` names the file; a test regenerates and compares |
| The manifest is written by the same process that made the error | medium | critical | The PDF cross-check is mechanical: it compares the manifest against the *extracted text of the compiled PDF*, not against the generator's own state |
| The manifest is too strict and blocks legitimate documents | medium | medium | `ungrounded` non-empty is a **warning** in the manifest and an **error** only in CI |
| The two profile formats coexist confusingly | medium | low | The JSON is documented as derived; `/setup` writes both; the markdown is the one the candidate edits |

---

## Rollback

| Change | Rollback |
|---|---|
| The JSON profile | The markdown is untouched; the derivation is skipped |
| The manifest | Delete the file; the documents are unaffected |
| The PDF cross-check | The flag is opt-in; `verify_pdf.py` behaves as before without it |
| The engine's profile reader | Revert to the ad-hoc reader; the error codes are preserved either way |

---

## Definition of done

- [ ] All acceptance criteria pass in CI on three operating systems.
- [x] `docs/IMPLEMENTATION_STATUS.md` records the profile schema and the manifest.
- [x] `docs/design/document-formats.md` documents the schema (§7.5) and the manifest (§7.4).
- [x] `docs/design/product-requirements.md` moves FR-3.6 and FR-6.4 to `IMPLEMENTED`.
- [x] `CHANGELOG.md` has an `[Unreleased]` entry.

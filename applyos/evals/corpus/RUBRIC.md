# Labelling rubric — committed before any label was assigned

This rubric was written on 2026-11-26, before the corpus items below were labelled. It is the rule
source for every `labelMethod: "rule"` label in the corpus. A `manual` or `candidate` label may
disagree with it; that disagreement is recorded in `rationale`, never smoothed away.

## Candidate frame (the reference profile for these labels)

- Stage: `fresher` (graduated 2026; 0–2 years' experience).
- Targets: backend/software roles in India or remote; skills Python, SQL, React.
- Deal-breakers: requires 5+ years, requires citizenship/residency the candidate does not hold,
  requires an on-site location outside the accepted set, or requires a working language other than
  English (the framework is English-only).
- Accepts: a stale posting **with a flag** (it is still visible to the human); a bond or low CTC
  **with a flag** (information, not a veto).

## Labels

| Label | Rule |
|---|---|
| `keep` | A role the candidate would want to see: within skill reach, no hard deal-breaker. |
| `keep_with_flag` | Worth seeing, but one informational condition applies (stale, bond, low CTC, notice period, timezone). The flag must name that condition. |
| `reject` | Hard deal-breaker: seniority far beyond the candidate, a citizenship/residency requirement, or an unaccepted location. |

A label is **never** derived by running gates over the item. The gates are what the evaluation
measures; using them to label would make the score trivially perfect and prove nothing. Labels come
from this rubric applied to the redacted text by a maintainer with the frame above.

## Dedupe pairs

- `duplicate` — the same requisition: tracking parameters, trailing slash or fragment differ; or the
  posting is a multi-city spread of one requisition ID at one company.
- `distinct` — different requisitions: a shared numeric ID at **different companies**, different
  IDs at the same company, or a date-shaped path segment that looks ID-like but is not.

## Documents

- A claim is `grounded` if its `source` names a profile section that actually contains the fact.
- `ungrounded` in a delivered manifest must be empty.
- A page budget is `compliant` when actual pages equal required pages.

## Ranking

- Two runs of the same deterministic scorer over the same postings and profile must produce the same
  score (σ = 0) and the same order (Spearman ρ = 1). A perturbation of the **order of input rows**
  must not change either — that is the stability property under test.

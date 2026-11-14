# Evaluation

> **Status:** `PROPOSED`. **No evaluation harness exists in the repository today.** No metric in
> this document is measured. Every number below is either a design target to be validated or
> explicitly marked `UNKNOWN`.
> **Phase:** 9. See [../phases/phase-09-evaluation.md](../phases/phase-09-evaluation.md).

---

## 1. Why this exists

ApplyOS makes decisions that affect a candidate's livelihood:

- a gate **rejects** a posting,
- a score **ranks** postings,
- a document **omits** a claim,
- a dedupe rule **merges** two postings.

Each of those decisions is currently justified by a unit test that proves the code does what it
was written to do. None of them proves that **what it was written to do is the right thing**.

The audit of 2026-10-09 found three blockers and dozens of majors of exactly this shape:
implementations that were correct against their own contract while being wrong against the
candidate's interest — a fabricated location, a gate that could never fire, a filter that
silently did nothing. All were fixed by making the code match the contract. Nothing measured
whether the *contract* was right.

**Evaluation closes that loop.**

---

## 2. Principles

| Principle | Consequence |
|---|---|
| **Offline and deterministic** | No network, no model calls. The same corpus must produce the same numbers on every machine, every run. |
| **Committed corpus** | The labelled fixtures are in the repository, with a schema and a provenance note. |
| **Committed baseline** | A JSON file of the last accepted results. CI fails when a metric moves beyond its tolerance. |
| **No invented numbers** | Until a metric is measured it is `UNKNOWN`. This document contains no invented values. |
| **Measure the outcome, not the implementation** | "The gate rejects 4% of good postings" is an outcome. "The gate calls `staleGate`" is not. |
| **Report distributions, not averages** | Averages hide the tail. A gate that rejects 0% of good postings and 2% of bad ones is not "95% accurate". |

---

## 3. The four evaluations

### 3.1 Gate precision and recall

**The question.** When a gate rejects a posting, is the rejection right? And when it lets one
through, should it have rejected it?

**The corpus.** A set of postings, each labelled:

| Label | Meaning |
|---|---|
| `KEEP` | The candidate would want to see this |
| `REJECT` | The candidate would not want to see this |
| `KEEP_WITH_FLAG` | Worth seeing, but worth flagging (a bond, a low CTC) |

Labelling is subjective, so the corpus records **how** a label was assigned: by hand, by the
candidate, or by a documented rule. Disagreement is recorded rather than smoothed.

**Metrics.**

| Metric | Definition |
|---|---|
| False-reject rate | Rejected postings that were labelled `KEEP`, over all `KEEP` postings |
| False-accept rate | Kept postings that were labelled `REJECT`, over all `REJECT` postings |
| Flag precision | Of the flagged postings, the fraction that deserved the flag |
| Per-gate breakdown | The same four numbers, split by gate |

**The reporting rule.** The headline number is the **false-reject rate**, because a false reject
costs the candidate a real opportunity, while a false accept costs them one scroll.

**Why the current design is expected to do well.** Three of the seven gates never auto-fail
(`ctc`, `bond`, and — except for the two hard cases — `location`). `ctcGate` carries the comment
*"Indian postings mix fixed/variable/ESOP, so never auto-fail"*. A conservative gate design should
produce a low false-reject rate. **This is a hypothesis, not a measurement.**

**What would invalidate it.** If the false-reject rate is high, the gates are too aggressive and
the fix is to convert FAILs to FLAGs, not to loosen the corpus labels.

### 3.2 Dedupe precision and recall

**The question.** Do two postings a human would call the same posting collapse — and do two
different postings stay separate?

**The corpus.** Labelled *pairs* of postings:

| Label | Meaning |
|---|---|
| `SAME` | A human would say these are one posting |
| `DIFFERENT` | A human would say these are different postings |

**Metrics.** Pairwise precision and recall, plus a breakdown by pair kind: tracking-parameter
variants, trailing-slash variants, hash variants, multi-city requisition spreads, and
near-misses (different companies, different roles with the same ID).

**The known hard case.** `collapseReqSpread` groups by `company | requisition-id`, where the
requisition ID is the first `[0-9a-f-]{8,}` path segment that is not a calendar date
(`dedupe.ts:93-111`). Two postings from different companies that happen to share an ID are
separated by the company key. Two postings from the same company with different IDs are
separate. A posting whose URL contains a date-shaped segment is protected by the date guard.
**The corpus must probe all three edges.**

### 3.3 Document fidelity

**The question.** Does every claim in a generated document trace back to the profile — and does
the document keep its page budget?

**The corpus.** A set of postings plus a profile. For each, the generated document and its
manifest.

**Metrics.**

| Metric | Definition |
|---|---|
| Ungrounded-claim rate | Claims in the document with no source in the profile, over all claims |
| Gap preservation | Gaps identified during evaluation that appear in the manifest's `gaps` |
| Page-budget compliance | Documents within their required page count |
| ATS extractability | Documents whose text layer yields the expected characters |

**The dependency.** This evaluation requires the **Document Manifest** (Phase 6). Without it,
"grounded" is a model judgement with no artifact to check.

**The known weakness.** The manifest records what the generator *believed* it sourced. It does
not independently verify that the sourced profile entry says what the claim says. A future
evaluation could sample claims and have a human or a second model verify the semantic match.
That is a known limitation, recorded rather than hidden.

### 3.4 Ranking stability

**The question.** If the ranker runs twice over the same corpus, how much does the ordering
move?

**Method.** Run the ranker twice with different agent seeds (or, for the deterministic engine
model, over perturbed inputs) and measure:

| Metric | Definition |
|---|---|
| Spearman ρ | Rank correlation between the two runs |
| Top-k overlap | How many of the top 10 are the same |
| Band churn | How many postings changed band |
| Score σ | Standard deviation of the score for a stable posting |

**Why it matters.** The spec layer's ranker is a model; the engine's is arithmetic. This
evaluation quantifies the difference. A model-based ranker with high churn is still usable — the
candidate reviews the shortlist — but the number is worth knowing.

**It also measures something uncomfortable.** The spec layer's own guidance says *"±5 pts is
noise; only band changes are signal."* Ranking stability is how that claim gets checked.

---

## 4. The corpus

### 4.1 Layout

```
applyos/evals/
├── corpus/
│   ├── postings/          # labelled postings
│   │   ├── <id>.json
│   │   └── ...
│   ├── pairs/             # labelled dedupe pairs
│   ├── documents/         # posting + profile + expected manifest properties
│   └── MANIFEST.json      # provenance, schema version, label provenance per item
├── baselines/
│   ├── gates.json
│   ├── dedupe.json
│   ├── documents.json
│   └── ranking.json
├── runners/
│   ├── gates.ts
│   ├── dedupe.ts
│   ├── documents.ts
│   └── ranking.ts
└── README.md
```

### 4.2 Provenance

Every corpus item records where it came from and how it was labelled:

```json
{
  "id": "posting-0042",
  "source": { "portal": "naukri", "url": "…", "captured": "2026-10-05" },
  "labels": {
    "keep": false,
    "flag": [],
    "labelMethod": "manual",
    "labelledBy": "maintainer",
    "rationale": "B2B SaaS role, 6+ years required; candidate is a fresher"
  }
}
```

**The licence question.** Job postings are third-party content. The corpus must not
redistribute them. The resolution — recorded here as a constraint Phase 9 must satisfy — is to
store **minimal, redacted excerpts sufficient for the evaluation** (title, company, a
paragraph of description, the fields the gates read), and to state the provenance of each. A
full-posting corpus of live board content is not redistributable.

### 4.3 Building the corpus

A one-time task, documented and reproducible, run by a maintainer with domain knowledge:

1. Collect postings across the four boards of the market×stage matrix.
2. Apply the label rubric.
3. Record the label provenance.
4. Redact to the minimum the evaluation needs.
5. Commit with a schema version.

**The corpus must not be generated by the code it evaluates.** A corpus built by the gate
implementation would trivially score 100% and prove nothing.

---

## 5. The baseline file

```json
{
  "schemaVersion": 1,
  "generatedAt": "<commit timestamp>",
  "corpusHash": "<sha256 of the corpus>",
  "metrics": {
    "gates": {
      "falseRejectRate": { "value": null, "tolerance": null, "status": "UNKNOWN" },
      "falseAcceptRate": { "value": null, "tolerance": null, "status": "UNKNOWN" }
    }
  }
}
```

`null` values mean the metric has never been measured. **The first successful run writes real
values.** Tolerance is set *after* the first measurement, with a deliberate margin — a tolerance
of zero would make CI fail on every unrelated change.

**CI gate.** A PR that changes a metric beyond its tolerance fails and must either (a) explain
why the change is correct, updating the baseline, or (b) revert. This is the mechanism that makes
the metrics meaningful over time.

---

## 6. Running an evaluation

```
applyos eval                 # all evaluations
applyos eval gates           # one
applyos eval gates --baseline  # compare against the committed baseline
applyos eval --update-baseline  # write a new baseline (maintainers only)
```

**Exit codes.** 0 when every metric is within tolerance; 1 when one is outside.

**Runtime.** Fully offline. The evaluations must be fast enough to run on every PR — a target of
under 30 seconds is proposed in
[performance.md](./performance.md#proposed-budgets), and is itself a `PROPOSED` value to be
confirmed by measurement.

---

## 7. Relationship to the test suite

| | Unit / contract tests | Evaluations |
|---|---|---|
| Question | "Does the code do what it was written to do?" | "Is what it was written to do the right thing?" |
| Input | A single case | A labelled corpus |
| Output | Pass / fail | A distribution of metrics |
| Speed | Milliseconds | Seconds |
| In CI | Yes, always | Yes, as a gate |
| Changes when the code changes | Should fail | Should move — and the movement is reviewed |

**Both are needed.** A unit test that pins a wrong behaviour is a trap; an evaluation with no
unit tests under it is unreliable. The audit is the proof of the first: several bugs were
"correct against the contract" and wrong against reality, and they were found by reading, not by
a failing test.

---

## 8. What is explicitly not measured

| Not measured | Why |
|---|---|
| Application success rate | Depends on the candidate, the market, and the recruiter. Not a property of the software. |
| Number of interviews | Same |
| Time-to-hire | Same |
| "Fit accuracy" against an omniscient oracle | Does not exist |
| User satisfaction | No telemetry is permitted (ADR-0003) and none is collected |

**These are the metrics a product dashboard would show. ApplyOS deliberately does not have one,
and cannot have one without breaking its central property.**

---

## 9. Phase 9 deliverables

| Deliverable | Acceptance |
|---|---|
| Corpus with provenance and a schema | Committed, with a manifest and a licence statement |
| `gates` evaluation | Runs offline; produces a baseline with real values |
| `dedupe` evaluation | Same |
| `documents` evaluation | Same — **depends on the Document Manifest from Phase 6** |
| `ranking` evaluation | Same |
| CI job | Runs on every PR; fails on a tolerance breach |
| `applyos eval` CLI | `PROPOSED` — see [../design/public-api.md](../design/public-api.md#2-the-cli-surface) |
| First measured baseline | Committed, with the numbers stated in this document, replacing `null` |

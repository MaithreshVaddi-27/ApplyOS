# Phase 5 — Job intelligence and matching

> **Status:** `PROPOSED` · **Depends on:** Phases 3, 4 ·
> **Gate:** **Q2 must be answered** ·
> **Risks:** [R-02, R-06](../roadmap/risks.md)

---

## Outcome

One scoring model, one weight table, one band set — with an explanation attached to every
score, and a `modelVersion` that says which model produced it.

---

## Why now

The engine scores on skill overlap, title tokens, and freshness. The spec layer scores on
technical, experience, behavioural, and career dimensions with stage-specific weights. They
disagree on almost every input, and the disagreement is invisible to the user.

A candidate who runs `/rank` and a developer who runs `applyos rank` get different answers for
the same posting. Whichever one is "the" score, the other must go — and the decision should be
made once, deliberately.

---

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Phase 3 (the shared weight table's home) | hard | Complete |
| Phase 4 (the SDK, so a posting's text is available once) | hard | Complete |
| **Q2** — which scoring model is canonical | **decision gate** | **Open** |

---

## Affected modules

| Path | Change |
|---|---|
| `applyos/packages/matching/src/score.ts` | The scoring implementation |
| `applyos/packages/matching/src/explain.ts` | **New** — `ScoreExplanation` |
| `applyos/packages/matching/src/weights.ts` | Reads the shared weight table |
| `applyos/packages/core/weights.json` | The one weight table |
| `.claude/commands/rank.md` | The Step 3 aggregation rules |
| `.claude/skills/job-application-assistant/04-job-evaluation.md` | Documents the same model |
| `tools/rank_state.py` | Reads the shared table |

---

## Tasks

### 5.1 — Answer Q2

**Deliverable.** A decision recorded in `docs/OPEN_QUESTIONS.md` and an ADR if it changes the
scoring contract.

**The options, honestly.**

| Option | What it means | Cost |
|---|---|---|
| **A. The spec's 4-dimension model is canonical** | The richer, judgment-aware model wins. The engine gains a judgement input | The engine becomes partly model-dependent; determinism weakens |
| **B. The engine's 3-factor model is canonical** | Determinism is preserved end to end | The score gets much weaker — `titleMatch` uses exact token equality, which will miss most real matches. It would also regress the user-visible experience |
| **C. A hybrid, explicitly layered** | The engine computes the deterministic factors; the agent supplies the judgment dimensions; the final score is the weighted sum of both, with the split recorded | More machinery; requires the agent to pass its judgment *into* the core as a versioned input rather than the core re-deriving it |

**Recommendation.** C. It is the only option that preserves determinism for the parts that can be
deterministic while not throwing away the behavioural and career judgement that makes the score
useful. The spec's own language — *"Deal-breakers veto scores"* — already implies a two-layer
model.

**The key insight.** Under C, the spec layer's judgement dimensions are not lost and the
engine's arithmetic is not discarded. The engine computes what it can; the agent computes what
only it can; the core combines them and explains the combination.

### 5.2 — Implement `ScoreExplanation`

**Deliverable.** `applyos/packages/matching/src/explain.ts`.

```ts
export interface ScoreExplanation {
  dimensions: {
    name: string;
    weight: number;
    raw: number;          // 0..1
    contribution: number; // weight × raw
    evidence: string;     // quoted, never invented
  }[];
  band: "strong" | "good" | "moderate" | "weak" | "poor";
  gates: GateResult[];
  modelVersion: string;
}
```

**Requirements.**
- **Every dimension's evidence is quoted from the posting.** A dimension with no evidence is not
  scored — it is reported as `"not evaluated"`, exactly as the text gates do.
- **The explanation sums.** `Σ contribution` equals the score. A test asserts this.
- `modelVersion` identifies the weights and bands in force, so a stored score is interpretable
  later.

### 5.3 — Unify the bands

**Deliverable.** One band set.

**The choice.** The spec's five bands (Strong 75+, Good 60–74, Moderate 45–59, Weak 30–44,
Poor <30) are more informative than the engine's three. **Recommendation:** adopt the spec's
bands.

**Requirement.** The `rank` command's output and the `/rank` spec's output section must use the
same band names. `strong fit` / `good fit` / `weak fit` (engine) becomes `Strong` / `Good` /
`Moderate` / `Weak` / `Poor` (spec).

### 5.4 — Unify the weights

**Deliverable.** `applyos/packages/core/weights.json` holds the canonical stage weights and band
boundaries. The TypeScript code and `tools/rank_state.py` both read it. `04-job-evaluation.md`
documents it.

**Requirement.** Three representations of one table is the current problem. The fix is: **one
JSON file**, one code reader, one doc that quotes the file.

**Test.** A test asserts the JSON's weights equal what the Python tool uses and what the spec
documents. If any two diverge, the test fails.

### 5.5 — Wire the judgment input

**Deliverable.** The engine accepts an optional, versioned judgment input.

```ts
export interface JudgmentInput {
  /** Dimension → 0..1 score, with a quoted reason. */
  readonly dimensions: Record<string, { score: number; reason: string }>;
  readonly version: string;
}
```

**Requirements.**
- The judgment is **never re-derived by the core**. The core combines; it does not judge.
- A dimension the agent did not supply is `"not evaluated"`, not zero. A zero would silently
  penalise the posting.
- The judgment is echoed in the explanation, so a candidate can see exactly which judgements
  moved the score.

### 5.6 — Extend the gates

**Deliverable.** The seven gates stay. Two additions are considered:

| Addition | Rationale | Status |
|---|---|---|
| A **notice-period** gate | The Stage Profile has a `notice_period:` field with no consumer. A posting requiring 90 days when the candidate can leave immediately is a real blocker | `PROPOSED` |
| A **duplicate-requisition** check across portals | `collapseReqSpread` collapses within a run; a posting re-listed under a new ID on another board is a different failure | `PROPOSED` — needs the Phase 9 corpus to size |

**Requirement.** Any new gate must answer the same question the existing seven answer: *"should
the candidate not see this at all?"* A gate that only informs is a flag, not a gate.

### 5.7 — Make the engine's score explainable in its own right

**Deliverable.** `applyos rank --format json` emits the explanation.

**Requirement.** The engine's strengths and gaps are currently thin strings
(`"matches skill \"python\" per posting text"`). They should quote the posting.

---

## Tests

| Suite | Change |
|---|---|
| `applyos/packages/matching/tests/matching.test.ts` | Extended: band boundaries, the explanation sum, the judgment input, the "not evaluated" dimension |
| `applyos/packages/matching/tests/explain.test.ts` | **New** |
| `tests/test_rank_state.py` | Extended: the shared weights |
| `tests/test_rank_command.py` | Extended: the unified bands |
| `applyos/apps/cli/tests/rank.test.ts` | Extended: the explanation in the output |

---

## Acceptance criteria

- [ ] Q2 is answered and recorded.
- [ ] One weight table, read by the TypeScript code, the Python tool, and the spec.
- [ ] One band set, used by both layers.
- [ ] Every score carries an explanation whose dimensions sum to the score.
- [ ] Every dimension's evidence is a quote from the posting.
- [ ] An unevaluated dimension is reported as such, never as zero.
- [ ] `modelVersion` is present on every score.
- [ ] `applyos rank --format json` and `/rank` produce comparable output for the same input.
- [ ] The whole suite is green on three operating systems.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The hybrid model is too complex for a candidate to understand | medium | medium | The explanation is a fixed shape; the candidate sees strengths and gaps, not the mechanism |
| The engine's deterministic factors are weaker than the agent's judgement, making the engine's contribution marginal | medium | medium | Phase 9's ranking-stability evaluation measures whether the deterministic layer adds anything |
| Changing the bands breaks a stored score's meaning | high | medium | `modelVersion` records the bands in force; stored scores carry the version they were produced under |
| A new gate introduces a false-reject | medium | critical | The gate must pass the Phase 9 false-reject check before it is enabled |
| Unifying the weights changes `/rank`'s output and the user notices | high | low | The change is documented in the changelog; the bands stay comparable |

---

## Rollback

| Change | Rollback |
|---|---|
| The weight table's location | The Python constants stay as a fallback |
| The band set | Keep the engine's three bands as a mapping for one release |
| The judgment input | Make it optional; the engine falls back to its deterministic score alone |
| A new gate | Disable it by default until the evaluation supports it |

---

## Definition of done

- [ ] All acceptance criteria pass in CI on three operating systems.
- [ ] Q2 is closed in `docs/OPEN_QUESTIONS.md`.
- [ ] `docs/IMPLEMENTATION_STATUS.md` records one scoring model.
- [ ] `docs/CHANGE_IMPACT_MATRIX.md` §3 reflects the unified scoring ownership.
- [ ] `docs/design/public-api.md` documents the `modelVersion` field.
- [ ] `CHANGELOG.md` has an `[Unreleased]` entry.

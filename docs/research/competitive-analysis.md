# Competitive Analysis

> **Checked:** 2026-11-13, against the public documentation of each project.
> **Status:** `PROPOSED` — Phase 12 revises it.
> **Purpose:** to know what ApplyOS genuinely has, what it genuinely lacks, and which gaps are
> worth closing.

---

## 1. The primary comparison

### career-ops

| | |
|---|---|
| **Repository** | `career-ops-hq/career-ops` |
| **Author** | @santifer |
| **License** | MIT |
| **Observed** | 82.3k stars · 15.1k forks · 4,213 commits · 260 watchers |
| **Homepage** | career-ops.org |
| **Observed** | 2026-11-13 |

**What it is.** *"The open-source AI job search agent"* — scan job boards, score each job 1–5
against your CV, tailor an ATS-friendly resume and cover letter, get interview prep and an
application tracker.

**Its stated principles** — worth adopting verbatim:

> Apply better to fewer. Signal over volume. Evidence over keywords. A human decides. Local-first.
> Dignity on both sides of the table.

**Its stated non-goals** — and ApplyOS agrees with all of them:

- It never auto-submits. *"The script never POSTs."*
- It never sends an email. *"There is no mail transport anywhere in this codebase."*
- It does not phone home. *"No telemetry, no backend of ours."*
- It does not push you to apply below 4.0/5.

### Side-by-side

| Dimension | career-ops | ApplyOS | Assessment |
|---|---|---|---|
| **Document format** | HTML + Playwright → PDF, Space Grotesk + DM Sans | **LaTeX + `lualatex`**, `moderncv` | ApplyOS wins — LaTeX gives deterministic page budgets and a verifiable text layer |
| **Page budgets** | Not asserted | **Resume exactly 1; CV exactly 2** — asserted in CI on two TeX Live ranges | ApplyOS wins |
| **Evaluation model** | A–H sections; weight provenance labelled per requirement; an estimate can never be top-band | 7 gates + 4 weighted dimensions | career-ops is more expressive; ApplyOS is more deterministic |
| **Scoring output** | 1–5 with a visible breakdown | Bands + strengths/gaps; the engine's explanation is `PROPOSED` (Phase 5) | career-ops ahead today |
| **ATS check** | Story provenance prevents invented numbers; a check stops a PDF whose numbers appear in neither the CV nor the article digest | Grounding Audit + `verify_pdf.py --check-ats`; the Document Manifest is `PROPOSED` (Phase 6) | Comparable; ApplyOS's manifest would make it checkable |
| **Cover letter** | Full generator, four angle prompts, A4 PDF | **None** | **career-ops ahead** — a real gap |
| **Application autofill** | `prepare-application.mjs`, stops before Submit | Skill guidance only; no automation | **career-ops ahead** |
| **Ghost-job / repost detection** | `detect-reposts.mjs`, `analyze-patterns.mjs`, `stats.mjs` | `/outcome` follow-up cadence only | **career-ops ahead** |
| **Contact discovery** | Finds the hiring manager, drafts a ≤300-character message | `/scrape` Step 4.5 generates referral contact links | Comparable |
| **Portal coverage** | **55+ provider modules**; 100+ pre-seeded companies | 12 provider CLIs + 6 engine adapters; 7 companies in the registry | **career-ops ahead by a wide margin** |
| **Dashboard** | Go TUI (10 filter tabs, 8 sort modes) + an experimental web UI | An HTML report | **career-ops ahead** — ApplyOS's is `PROPOSED` for Phase 10 |
| **Distribution** | `npx @santifer/career-ops init`; plugins for Claude Code, Codex, Cursor, and 10+ AI CLIs; 20+ README translations | Git clone + a manual install loop | **career-ops ahead** |
| **Evaluation infrastructure** | An `evals/` directory | **None** | **career-ops ahead** — Phase 9 closes this |
| **Market focus** | Global, Spain-first | **India + global-remote**, English-only, stage-aware | ApplyOS's differentiator |
| **India intelligence** | — | Market×stage portal matrix, batch/stipend/CTC/notice gates, Indian recruiter document conventions, India salary sourcing | **ApplyOS wins** |
| **Privacy enforcement** | "Nothing is uploaded to us"; a public `HIRED.md` ledger | **CI-enforced** — gitignore + nested-negation review + allowlist guards + `defaultMode` check | ApplyOS's enforcement is more mechanical |
| **Runtime independence** | A shared router, `.agents/skills/career-ops/SKILL.md`, and `modes/*.md` | The same pattern, plus a CI-enforced thin-pointer invariant and a parity test | Equivalent; ApplyOS's invariant is more rigorously tested |
| **Provider contract** | Provider modules inside the main repo | A **documented** portal-skill contract with a scaffolder, 12 implementations, and offline suites | ApplyOS's contract is more explicit |

---

## 2. What ApplyOS genuinely has

Not "could have" — has, today, verified:

1. **A documented provider contract.** `/add-portal` specifies the commands, flags, envelope,
   error shape, exit codes, dependency rule, and credential rule. Twelve implementations exist.
   career-ops has 55+ providers but (as far as its public documentation shows) no
   *contributor-facing contract* for adding one.

2. **Mechanical privacy enforcement.** `tools/security_guards.py` fails a PR that widens the
   permission allowlist, adds a lifecycle script, weakens the gitignore rules, ships
   `bypassPermissions`, or lets a nested `.gitignore` re-include personal data. That is
   engineering, not a promise.

3. **A CI-enforced thin-pointer invariant.** `tests/test_runtime_adapters.py` and
   `tests/test_skill_mirrors.py` make workflow drift a build failure.

4. **A deterministic core with a testable gate model.** 168 engine tests. The gate suite's
   negative cases encode decisions a naive implementation gets wrong.

5. **Two TeX Live legs in CI.** The Debian/TeX-2022 leg exists because the TeX Live 2022
   environment broke moderncv 2.5. That is a level of operational care most projects skip.

6. **India-specific job intelligence.** Not a localisation — a different domain model.

---

## 3. What ApplyOS genuinely lacks

| Gap | Severity | Why it matters | Where it is addressed |
|---|---|---|---|
| **No cover-letter pipeline** | **High** | Many roles want one. career-ops generates them with a PDF. | Not planned — deliberately. See below |
| **No application-form autofill** | Medium | career-ops fills forms field by field and stops before Submit | Not planned — see below |
| **No ghost-job / repost detection** | Medium | A real problem for candidates | `/scrape` Step 2.5 detects mass-posting patterns; repost detection is not planned |
| **No dashboard / TUI** | Medium | The tracker is a CSV; reading it requires a spreadsheet | Phase 10 (`PROPOSED`) |
| **No evaluation harness** | **High** | Nothing measures whether the matching works | Phase 9 (`PROPOSED`) |
| **Far fewer providers** | Medium | 12 CLIs vs 55+ modules | Phase 4 unifies; coverage grows by contribution |
| **No plug-and-play distribution** | Medium | The install is a manual loop of 13 `bun install`s | Phase 1's bootstrap; Phase 12's decision (Q6) |
| **No pattern analytics** | Low | career-ops computes lifetime funnel statistics | `/html-report` computes a funnel from the tracker; deeper analytics are not planned |
| **No agent-agnostic invocation yet** | Low | The specs are the interface today | Phase 8 (`PROPOSED`) |

---

## 4. The gaps ApplyOS should not close

Adopting a competitor's feature is not automatically the right move.

| Feature | career-ops has it | Recommendation | Why |
|---|---|---|---|
| **Cover letter** | Yes | **Not now** | ApplyOS's `/apply` produces a CV or a resume, never both — *"Never produce both in one run unless the user explicitly asks."* A cover letter changes the artifact set and the verification surface. It could be a separate `/cover` command later, with its own Grounding Audit and its own manifest |
| **Form autofill** | Yes | **Not now** | It requires a browser, which breaks the zero-dependency, no-browser toolchain, and it introduces a new action surface. The human pressing Submit is the project's core principle, not an oversight |
| **A public outcome ledger** | Yes (`HIRED.md`) | **No** | It requires contributors to publish their outcomes publicly. That contradicts ADR-0003's local-first posture |
| **A web UI** | Yes (experimental) | **No** | A browser surface weakens the trust boundary. Phase 10's TUI is local and read-only |
| **Multi-language** | — | **No** | A deliberate v1 exclusion (`search-queries.md`, "Language Filter") |

---

## 5. The strategic position

ApplyOS is **not** trying to be career-ops. The two optimise for different things:

| | career-ops | ApplyOS |
|---|---|---|
| **Distribution** | Maximum reach — npm, plugins, 20+ translations | Depth — a private, single-candidate tool |
| **Documents** | HTML + Playwright | LaTeX + moderncv, with deterministic page budgets |
| **Market** | Global, Spain-first | India + global-remote |
| **Privacy** | "Nothing uploaded to us" plus a public ledger | Nothing leaves the machine, enforced by CI |
| **Matching** | Rich, model-driven, with weight provenance | Deterministic gates plus an explainable score |
| **The user's job** | "Paste a job; get a verdict" | "Run a search; get a pipeline" |

**The one-line positioning:**

> **ApplyOS is the local-first, India-focused job-search *pipeline* — not a verdict machine.**
> Where career-ops answers "should I apply to this?", ApplyOS answers "here is my whole search,
> run properly, with nothing leaving your machine."

---

## 6. Strategic risks from the comparison

| Risk | Evidence | Mitigation |
|---|---|---|
| **career-ops can absorb the provider-contract idea** | It has 55+ providers and 800+ contributors | ApplyOS's advantage is the *contract and its enforcement*, not the provider count. Phase 12's funnel must keep the contribution path cheap |
| **The gap in providers becomes the deciding factor for candidates** | 12 vs 55+ | Phase 4's SDK plus `/add-portal` makes each contribution reach every consumer |
| **career-ops can add a LaTeX pipeline** | It has the contributor base | ApplyOS's advantage is the CI-enforced page budget and the ATS text-layer verification, which are hard to retrofit |
| **The evaluation gap is a real quality gap** | career-ops has an `evals/` directory | Phase 9 closes it. This is the most important single phase after convergence |
| **Reach matters in an open-source project** | 82.3k stars vs ApplyOS's smaller base | Phase 12's decision. The answer is a good contribution funnel, not necessarily npm |

---

## 7. Adjacent projects worth watching

Observed from the career-ops README's ecosystem and the OpenCode skills catalogue, 2026-11-13.

| Project | Relevance | Note |
|---|---|---|
| **OpenCode** | The reference runtime | ApplyOS's permission model and command adapters are built for it |
| **MadsLorentzen/ai-job-search** | **ApplyOS's actual ancestor** | Credited in `NOTICE`. The core pipeline — self-profiling, fit evaluation, drafter-reviewer — descends from it |
| **Browser Use** | Browser automation | Relevant if form autofill is ever revisited |
| **LaTeX / moderncv** | The document pipeline | ADR-0005's dependency |
| **OpenAI Codex, Claude Code, Antigravity** | The runtime landscape | Each needs an adapter, per ADR-0002 |
| **The OpenCode skills catalogue** | The extension ecosystem | Many overlapping job-search skills exist; ApplyOS's differentiator is the enforced contract and the India intelligence |

**The `MadsLorentzen/ai-job-search` note is worth stating plainly.** ApplyOS is a *derivative* of
it, credited in `NOTICE` under the MIT licence. It is not upstream and ApplyOS does not track it
— `CONTRIBUTING.md` says so explicitly. But it is the origin of the core pipeline, and any
comparison of "what ApplyOS is" should start there.

---

## 8. What to do about it

| Action | Phase | Status |
|---|---|---|
| Unify the providers and reduce the gap's cost | 4 | `PROPOSED` |
| Build the evaluation harness | 9 | `PROPOSED` |
| Ship the local dashboard | 10 | `PROPOSED` |
| Make the contribution funnel cheap and discoverable | 12 | `PROPOSED` |
| Add a cover-letter pipeline | — | Not planned. Revisit only if a candidate asks repeatedly |
| Add form autofill | — | Not planned. It contradicts the toolchain and the principles |
| Chase provider count directly | — | Not planned. Coverage should grow by contribution, not by bulk |
| Publish to npm | 12 | Q6 — open |

---

## 9. Method and limits

**What was checked.** career-ops's public README, repository tree, `AGENTS.md`,
`ARCHITECTURE.md`, `CONTRIBUTING.md`, and the linked documentation set, on 2026-11-13.

**What was not.** Its source code was not read line by line. Claims about its internals are
based on its public documentation and are marked as such.

**What this document is not.** It is not a feature-by-feature verdict, and it does not score
either project. The comparison exists to answer one question: *what should ApplyOS do next?*

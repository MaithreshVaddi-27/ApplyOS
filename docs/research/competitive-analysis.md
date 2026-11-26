# Competitive Analysis

> **Checked:** 2026-11-13 (Phase 12 positioning frozen 2026-11-26), against the public
> documentation of each project.
> **Status:** `IMPLEMENTED` — the positioning and the honest differentiators/non-goals are in §2;
> current capability state is in [../IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md).
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
| **Evaluation model** | A–H sections; weight provenance labelled per requirement; an estimate can never be top-band | Nine gates + 4 weighted dimensions + 5 bands, one versioned weights table | career-ops is more expressive; ApplyOS is more deterministic and explainable |
| **Scoring output** | 1–5 with a visible breakdown | Bands + strengths/gaps + per-dimension contributions and quoted evidence (`ScoreExplanation`) | Comparable; ApplyOS publishes the arithmetic |
| **ATS check** | Story provenance prevents invented numbers; a check stops a PDF whose numbers appear in neither the CV nor the article digest | Grounding Audit + `verify_pdf.py --check-ats` + the Document Manifest cross-checked against extracted PDF text | Comparable; ApplyOS's manifest makes it checkable |
| **Cover letter** | Full generator, four angle prompts, A4 PDF | **None** | **career-ops ahead** — a real gap |
| **Application autofill** | `prepare-application.mjs`, stops before Submit | Skill guidance only; no automation | **career-ops ahead** |
| **Ghost-job / repost detection** | `detect-reposts.mjs`, `analyze-patterns.mjs`, `stats.mjs` | `/outcome` follow-up cadence plus a measured dedupe suite | **career-ops ahead**; ApplyOS's false-merge rate is now measured (0.6667) |
| **Contact discovery** | Finds the hiring manager, drafts a ≤300-character message | `/scrape` Step 4.5 generates referral contact links | Comparable |
| **Portal coverage** | **55+ provider modules**; 100+ pre-seeded companies | 13 portal CLIs + 14 SDK boards + 7 seeded companies | **career-ops ahead by a wide margin** |
| **Dashboard** | Go TUI (10 filter tabs, 8 sort modes) + an experimental web UI | Self-contained HTML report + a read-only TUI (`apps/tui`) | **career-ops ahead on filters**; ApplyOS is local and dependency-free |
| **Distribution** | `npx @santifer/career-ops init`; plugins for Claude Code, Codex, Cursor, and 10+ AI CLIs; 20+ README translations | Git clone + a one-command bootstrap; publishing deliberately deferred (Q6) | **career-ops ahead** |
| **Evaluation infrastructure** | An `evals/` directory | `applyos/evals/`: redacted corpus, four offline runners, committed baseline, CI gate | Comparable; ApplyOS's corpus is labelled before, never by, the code it checks |
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

4. **A deterministic core with a testable gate model.** 546 engine tests and 624 Python tool
   tests, plus four measured evaluation suites. The gate suite's negative cases encode decisions a
   naive implementation gets wrong, and the corpus was labelled before (never by) the code it
   checks.

5. **Two TeX Live legs in CI.** The Debian/TeX-2022 leg exists because the TeX Live 2022
   environment broke moderncv 2.5. That is a level of operational care most projects skip.

6. **India-specific job intelligence.** Not a localisation — a different domain model.

7. **Measured, not asserted, quality.** Phase 9 published real numbers (corpus hash
   `f1818a007457b9dc`, model `1.0.0`): a 0.0000 gate false-reject rate, perfect ranking stability
   under input reordering, and a 0.6667 dedupe false-merge rate that exposed a genuine edge.
   career-ops's star count is reach, not evidence of correctness.

### The positioning, frozen in Phase 12

The differentiators above reduce to one sentence: **a private, India-focused, LaTeX-based workflow
with a verified ATS text layer and a deterministic, explainable score, enforced by CI.** That is a
narrow product, and it is deliberate. The mirror image is equally important — the things ApplyOS
does not do and does not intend to:

- No hosted service, no account, no server, no port, no telemetry, no background process.
- No multi-language documents and no web UI.
- No auto-submission and no email sending.
- No generic marketplace or third-party plugin registry.
- No npm publication: Q6 resolved to publish nothing, because there is no evidence of external
  demand. The SDK is the first thing to publish *if* demand appears; the CLI never is.

The comparison project's `npx @santifer/career-ops init` is its primary distribution and it has
82.3k stars. That is the shape of an opportunity, not a requirement. ApplyOS's distribution stays
"clone the repo", which is what `/add-portal` already assumes; Phase 12 made the contribution path
short (worked example + one-command check) rather than inventing a package to distribute.

---

## 3. What ApplyOS genuinely lacks

| Gap | Severity | Why it matters | Where it is addressed |
|---|---|---|---|
| **No cover-letter pipeline** | **High** | Many roles want one. career-ops generates them with a PDF. | Not planned — deliberately. See below |
| **No application-form autofill** | Medium | career-ops fills forms field by field and stops before Submit | Not planned — see below |
| **No ghost-job / repost detection** | Medium | A real problem for candidates | `/scrape` Step 2.5 detects mass-posting patterns; repost detection is not planned |
| **No dashboard / TUI** | Medium | The tracker is a CSV; reading it requires a spreadsheet | Closed in Phase 10 — self-contained `/html-report` + read-only `apps/tui` |
| **No evaluation harness** | **High** | Nothing measures whether the matching works | Closed in Phase 9 — four offline suites, a committed baseline and a CI gate |
| **Far fewer providers** | Medium | 13 CLIs vs 55+ modules | Phase 4 unified them onto one SDK (14 boards); coverage grows by contribution |
| **No plug-and-play distribution** | Medium | The install is a manual loop of 13 `bun install`s | Closed in Phases 1/12 — `scripts/bootstrap.sh` + the clone-only decision (Q6) |
| **No pattern analytics** | Low | career-ops computes lifetime funnel statistics | `/html-report` computes a funnel from the tracker; deeper analytics are not planned |
| **No agent-agnostic invocation yet** | Low | The specs are the interface today | Closed in Phase 8 — one invocation contract, thin adapters, `AGENTS.md` routing |

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
| Unify the providers and reduce the gap's cost | 4 | `IMPLEMENTED` — 14 boards, one SDK |
| Build the evaluation harness | 9 | `IMPLEMENTED` — measured baseline, CI gate |
| Ship the local dashboard | 10 | `IMPLEMENTED` — HTML report + read-only TUI |
| Make the contribution funnel cheap and discoverable | 12 | `IMPLEMENTED` — worked example, one-command check |
| Add a cover-letter pipeline | — | Not planned. Revisit only if a candidate asks repeatedly |
| Add form autofill | — | Not planned. It contradicts the toolchain and the principles |
| Chase provider count directly | — | Not planned. Coverage should grow by contribution, not by bulk |
| Publish to npm | 12 | Q6 — resolved: publish nothing; SDK-only if external demand appears |

---

## 9. Method and limits

**What was checked.** career-ops's public README, repository tree, `AGENTS.md`,
`ARCHITECTURE.md`, `CONTRIBUTING.md`, and the linked documentation set, on 2026-11-13.

**What was not.** Its source code was not read line by line. Claims about its internals are
based on its public documentation and are marked as such.

**What this document is not.** It is not a feature-by-feature verdict, and it does not score
either project. The comparison exists to answer one question: *what should ApplyOS do next?*

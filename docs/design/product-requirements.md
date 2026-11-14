# Product Requirements

> **Status:** `PROPOSED` for the target requirements; the current capabilities are recorded in
> [../IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md).

---

## 1. Problem

A job search is a **data pipeline with judgment steps**, performed by someone with no time,
no tooling, and no budget for a career coach.

The naive workflow — paste a posting into a chatbot, ask for a tailored CV — fails in three
specific ways:

| Failure | Consequence | Current mitigation in ApplyOS |
|---|---|---|
| **Volume** | 200 postings a week, 10 minutes each of manual triage | `/scrape` + `/rank` batch the triage |
| **Fabrication** | A model invents a metric or a job title to make the CV fit better | The Grounding Audit; `verify_pdf.py`; the Document Manifest (Phase 6) |
| **Exhaustion** | Every application is bespoke, so the twelfth is as slow as the first | Templates, `/add-template`, `/outcome` drafting, follow-up drafts |

The fourth failure — **silence** — is the one the market under-serves: you apply to 60 roles and
hear nothing back, and never learn *why*. `/outcome` and `/html-report` exist to close that loop.

---

## 2. Users

| Persona | Need | ApplyOS today |
|---|---|---|
| **Student / intern** (0 yr) | Internships, not full-time roles. Stipend floors. A 1-page document. | `stage: student`, `stipend_floor`, intern-title filter, resume exactly 1 page |
| **Fresher** (0–1 yr) | First job. Batch restrictions. Notice period. CTC floor. | `stage: fresher`, `graduation_year`, `batch` gate, `expected_ctc_floor` |
| **Experienced** (1+ yr) | Seniority-matched roles. A 2-page CV that holds a track record. | `stage: experienced`, 2-page CV, full 4-dimension ranking |
| **Remote-global** | Roles that accept India-based remote work | `stage: remote-global`, remote-row filter, global portal set |
| **Contributor** | Add a board, a template, or a command without breaking the project | `/add-portal`, `/add-template`, the portal-skill contract, this blueprint |

**Non-users.** Multi-language job searches (v1 is English-only by design); anyone needing a
hosted team workspace; anyone who will not install Python, Bun, and LaTeX.

---

## 3. Product principles

1. **Local-first, always.** No backend, no account, no telemetry. See ADR-0003.
2. **Human-in-the-loop at every irreversible edge.** ApplyOS drafts; the candidate presses
   Send. Follow-ups are drafted, never sent. Syncs are proposed, never written without approval.
3. **The agent is a runtime, not a dependency.** The same job search must run under any
   AGENTS.md-compatible agent. See ADR-0001.
4. **Determinism where possible.** Arithmetic belongs in code. See ADR-0004.
5. **No fabrication, ever.** A missing fact stays missing. A gap is reported, not stuffed.
6. **Explainability.** A score shows its dimensions. A gate shows its quoted evidence. A document
   claim shows its source.
7. **Zero runtime dependencies** for provider CLIs, so a contribution is a folder.

---

## 4. Functional requirements

### FR-1 — Discovery

| ID | Requirement | State |
|---|---|---|
| FR-1.1 | Search a configured set of job boards for postings matching the candidate's market × stage | `IMPLEMENTED` |
| FR-1.2 | Select the board set from the `market:` × `stage:` pair in the Stage Profile | `IMPLEMENTED` |
| FR-1.3 | Respect each board's robots.txt before fetching | `IMPLEMENTED` (both layers) |
| FR-1.4 | Isolate failures: one dead source never aborts a run | `IMPLEMENTED` (both layers) |
| FR-1.5 | Deduplicate across runs, against the seen store and the tracker | `IMPLEMENTED` |
| FR-1.6 | Detect postings that are closed at the source | `IMPLEMENTED` (CLI layer) |
| FR-1.7 | Flag mass-posting / duplicate-posting patterns | `IMPLEMENTED` (CLI layer, Step 2.5) |
| FR-1.8 | Health-check a portal on demand; only `enabled:` may be toggled, only with confirmation | `IMPLEMENTED` |
| FR-1.9 | Generate referral contact links for high and medium fit postings | `IMPLEMENTED` (CLI layer, Step 4.5) |
| FR-1.10 | One implementation per board | `PROPOSED` — ADR-0008 |

### FR-2 — Evaluation

| ID | Requirement | State |
|---|---|---|
| FR-2.1 | Score a posting against the candidate profile | `IMPLEMENTED` (two different models — see [Q2](../OPEN_QUESTIONS.md#q2--which-scoring-model-is-canonical--blocking-for-phase-5)) |
| FR-2.2 | Apply hard gates that veto a score regardless of fit | `IMPLEMENTED` (7 gates) |
| FR-2.3 | Show the score's dimensions and the evidence behind each | `PARTIAL` — spec layer yes; engine shows only strengths/gaps |
| FR-2.4 | Batch-score many postings without loading the whole seen store into context | `IMPLEMENTED` (`rank_state.py`) |
| FR-2.5 | Retire expired postings from consideration | `IMPLEMENTED` (`sweep`) |
| FR-2.6 | Flag staleness without dropping a posting | `IMPLEMENTED` |

### FR-3 — Documents

| ID | Requirement | State |
|---|---|---|
| FR-3.1 | Produce a tailored CV or resume per posting | `IMPLEMENTED` |
| FR-3.2 | Respect the document type and the page budget (resume 1 page; CV 2, or 1 for student/fresher) | `IMPLEMENTED` |
| FR-3.3 | Compile with `lualatex` and verify the PDF | `IMPLEMENTED` |
| FR-3.4 | Verify the text layer is extractable (ATS check) | `IMPLEMENTED` |
| FR-3.5 | Remove any claim not present in the profile | `IMPLEMENTED` (Grounding Audit, model-enforced) |
| FR-3.6 | Produce a machine-checkable claim manifest | `PROPOSED` — Phase 6 |
| FR-3.7 | Support an alternative document toolchain | `IMPLEMENTED` (`/add-template`) |
| FR-3.8 | Never let a tailored draft become the template for the next application | `IMPLEMENTED` (`/setup` rule) |

### FR-4 — Applications and tracking

| ID | Requirement | State |
|---|---|---|
| FR-4.1 | Record one tracker row per application | `IMPLEMENTED` |
| FR-4.2 | Archive the posting, the submitted document, and the outcome per application | `IMPLEMENTED` |
| FR-4.3 | Detect application status from email | `PARTIAL` — requires a Gmail MCP server |
| FR-4.4 | Draft follow-ups on a 7-day cadence, maximum two per application | `IMPLEMENTED` |
| FR-4.5 | Never send a follow-up | `IMPLEMENTED` — enforced by contract |
| FR-4.6 | Produce an offline dashboard of the whole search | `IMPLEMENTED` (`/html-report`) |
| FR-4.7 | Publish a one-way view to an external tracker | `PARTIAL` — requires a Notion MCP server |
| FR-4.8 | Give the tracker a named schema version and a migration function | `PROPOSED` — Phase 7 |

### FR-5 — Interview preparation

| ID | Requirement | State |
|---|---|---|
| FR-5.1 | Produce a stage-specific prep pack from the application archive | `IMPLEMENTED` |
| FR-5.2 | Keep the prep consistent with the submitted document | `IMPLEMENTED` — contract in `/interview` |
| FR-5.3 | Research the company and the interviewer, from a verified identity | `IMPLEMENTED` |
| FR-5.4 | Never prepare an answer that invents experience | `IMPLEMENTED` — contract |

### FR-6 — Profile management

| ID | Requirement | State |
|---|---|---|
| FR-6.1 | Build a profile from documents, a paste, or an interview | `IMPLEMENTED` (`/setup`, three paths) |
| FR-6.2 | Enrich the profile from public sources, source-annotated | `IMPLEMENTED` (`/expand`) |
| FR-6.3 | Keep the profile readable and diffable | `IMPLEMENTED` (markdown) |
| FR-6.4 | Expose the profile as a machine-readable artifact | `PROPOSED` — Phase 6 |
| FR-6.5 | Reset the profile back to placeholders | `IMPLEMENTED` (`/reset`, confirmation-gated) |

### FR-7 — Extensibility

| ID | Requirement | State |
|---|---|---|
| FR-7.1 | Add a job board without touching the core | `PARTIAL` — the contract exists; the SDK does not |
| FR-7.2 | Add an ATS board | `PARTIAL` — connectors exist; the SDK does not |
| FR-7.3 | Add a document toolchain | `IMPLEMENTED` (`/add-template`) |
| FR-7.4 | Add a runtime | `IMPLEMENTED` (thin pointer + routing row) |
| FR-7.5 | Add a workflow | `IMPLEMENTED` — but with a high bar by design (`CONTRIBUTING.md`) |
| FR-7.6 | Distribute a provider without a monorepo clone | `PROPOSED` — Phase 12 |

---

## 5. Non-functional requirements

| ID | Requirement | How it is met | State |
|---|---|---|---|
| NFR-1 | No personal data leaves the machine | gitignore + `tools/security_guards.py` + ADR-0003 | `IMPLEMENTED` |
| NFR-2 | The candidate approves every irreversible action | Approval gates in `/gmail-sync`, `/outcome`, `/notion-sync`, `/reset` | `IMPLEMENTED` |
| NFR-3 | Any runtime can execute the workflow | Thin-pointer adapters + `AGENTS.md` routing table | `IMPLEMENTED` |
| NFR-4 | Provider CLIs have zero runtime dependencies | `package.json` `dependencies: {}` in all 12 | `IMPLEMENTED` |
| NFR-5 | Documents are ATS-parseable | `verify_pdf.py --check-ats` | `IMPLEMENTED` |
| NFR-6 | A fresh clone installs in one command | — | `MISSING` — Phase 1 |
| NFR-7 | The whole suite runs offline | Tests use fixtures; live calls gated behind `APPLYOS_LIVE_TESTS` | `IMPLEMENTED` |
| NFR-8 | Errors are typed and the exit code is meaningful | Stable error codes; exit 1 on failure | `IMPLEMENTED` |
| NFR-9 | Behaviour is reproducible | Deterministic core + offline evaluation harness | `PARTIAL` — core `IMPLEMENTED`, harness `PROPOSED` |
| NFR-10 | Nothing is written that the candidate cannot inspect | Tracker + archive are plain text | `IMPLEMENTED` |

---

## 6. Explicit non-goals

| Non-goal | Why |
|---|---|
| A hosted or multi-tenant service | Breaks NFR-1 |
| Telemetry or analytics | Breaks NFR-1; no metric justifies it |
| Multi-language document generation | A deliberate v1 exclusion in `search-queries.md` |
| A web UI or mobile app | The candidate's machine is the trust boundary |
| Auto-submitting applications | Breaks the human-in-the-loop principle |
| Sending email or messages | Same |
| A general-purpose job marketplace | Out of segment |
| Replacing LaTeX with HTML+Playwright | Trades ATS fidelity for a browser dependency (ADR-0005) |

---

## 7. Success criteria

ApplyOS succeeds for a candidate when the search is **thorough**, the documents are **honest**,
and the loop **closes**.

| Outcome | How ApplyOS delivers it | How it is measured |
|---|---|---|
| Thorough | Multi-board fan-in with stage-aware filtering | Boards covered per market×stage; postings surfaced per run |
| Honest | Grounding Audit + ATS verification + claim manifest | Zero ungrounded claims (Phase 9 evaluation) |
| Closed | Tracker + archive + status detection + follow-up drafts | Applications with a recorded outcome; days between apply and outcome |

**No target numbers are set here.** Setting them requires measurement that does not exist yet
(Phase 9) and a product decision about what "good" means (Phase 10). Fabricating a benchmark
here would be exactly the failure mode this project exists to prevent.

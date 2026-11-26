# ApplyOS Documentation

This directory is the engineering record for ApplyOS: design, decisions,
verification, and guides. It is organized by how current each document is —
start at the top, and treat the historical section as an archive.

## Start here

- **[PROJECT_BLUEPRINT.md](./PROJECT_BLUEPRINT.md)** — the architecture, decisions, and twelve-phase roadmap (all phases implemented).
- **[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)** — verified `IMPLEMENTED` / `PARTIAL` / `PROPOSED` status across all twelve phases.
- **[phases/](./phases/README.md)** — the detailed plan and result for each phase.

## Reference by topic

| Section | Contents |
|---|---|
| [architecture/](./architecture/README.md) | Current state, target state, system design, and the nine ADRs |
| [design/](./design/README.md) | Product requirements, provider SDK, plugin architecture, public API, CLI, UX, and document formats |
| [engineering/](./engineering/README.md) | Standards, testing, evaluation, and performance |
| [roadmap/](./roadmap/README.md) | Master roadmap, dependencies, and the risk register |
| [security/](./security/README.md) | Threat model, privacy data flows, and security testing |
| [developer/](./developer/README.md) | Getting started, contribution, portal and command authoring, and the glossary |
| [research/](./research/README.md) | Competitive analysis and the technology ecosystem |

## Cross-cutting records

| Document | Purpose |
|---|---|
| [DECISION_LOG.md](./DECISION_LOG.md) | Every architectural decision, with a pointer to the full ADR |
| [CHANGE_IMPACT_MATRIX.md](./CHANGE_IMPACT_MATRIX.md) | "If I change X, what else must change?" |
| [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md) | Open questions, who can answer them, and what they block |
| [COMPANY_PORTAL_SCRAPER.md](./COMPANY_PORTAL_SCRAPER.md) | The `careers-search` design: verified ATS endpoints, seed registry, architecture, and declined-board evidence |

## Generated artifacts and provenance

- [ApplyOS-setup-guide.pdf](./ApplyOS-setup-guide.pdf) — generated setup and architecture guide; regenerate with `python docs/generate_setup_guide.py`.
- [PROVENANCE.md](../applyos/PROVENANCE.md) — clean-room origin log for every engine module.
- [examples/](./examples/) — shareable sample outputs; no personal data.

## Historical records (closed — not a live backlog)

- [AUDIT_2026-10-09.md](./AUDIT_2026-10-09.md) — full re-audit: findings, deletion log, and recommended fix order. Its numeric baseline is superseded by the grown suite.
- [UPGRADES_2026-10-11.md](./UPGRADES_2026-10-11.md) — deep audit and prioritized upgrades. Its items are shipped or declined with evidence; see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md).
- [EXTERNAL_SOURCES_2026-10-10.md](./EXTERNAL_SOURCES_2026-10-10.md) and [WEB_RESEARCH_2026-10-10.md](./WEB_RESEARCH_2026-10-10.md) — source research captured during the audit; kept for provenance.

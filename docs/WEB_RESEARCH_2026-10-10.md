# Web Research (2026-10-10): skills / MCP / salary / ATS sources

Method: web search + doc reads (no code vendored without full review). Verdicts evidence-backed.

## Evaluated

| Source | Verdict | Evidence |
|---|---|---|
| Levels.fyi API/MCP/CLI | DECLINE (cost) | Plans from $800/mo; Apify scrapers paid. Local `salary_lookup.py` + user bands stand. Revisit only with budget. |
| `rahulbsw/resume-builder` (Resume Intelligence) | ADAPT PATTERNS, don't vendor | 3★/0 forks, unproven; enterprise stack (Confluence/Jira/GHE connectors, DOCX-first, Obsidian vault) mismatches LaTeX pipeline + student/fresher focus. Philosophy strongly aligned (evidence-backed, "do not invent dates/metrics/ownership"). Adopt 3 patterns: claim-confidence log → `/apply` grounding audit; missing-information loop → `/setup`; scorecard checklist → Step 5d. No new skills. |
| SkillSyncer (free ATS scanner) | REFERENCE ONLY | Web UI, no API; keyword-gap method already in `resume-ats-optimizer` + jd-analyzer. No integration point. |
| Skill registries (skills.sh ~10k, VoltAgent awesome list, awesomeskill.ai, qaskills.sh) | PROCESS NOTE | Useful for future discovery sweeps, not vendoring. Discovery rule: full-read review + grounding check before any adoption (this doc is the template). |
| Community levels-fyi MCP (mcp.so) | DECLINE | Unofficial scraper-based; fragile + ToS-gray. Same class as JobSpy decline. |
| ApyHub/SharpAPI resume-parser (free tier) | DECLINE (key-gated) | PDF→JSON parsing would fit `/setup`, but needs personal API key. User-optional only. |

## Adopted patterns (this pass)

1. `/apply` grounding audit gains a claim-confidence note: every tailored bullet carries
   its source (`profile`/`master-CV`/`archive`) — already the trace format; now explicit
   that low-confidence claims are flagged, not smoothed (from resume-builder evidence.md).
2. `/setup` gains a missing-information loop pointer: ask for missing dates/ownership/
   metrics instead of leaving gaps implicit (from missing-information-loop).
3. Step 5d checklist gains a claim-risk line: keyword additions re-checked against the
   grounding audit (from resume-scorecard).

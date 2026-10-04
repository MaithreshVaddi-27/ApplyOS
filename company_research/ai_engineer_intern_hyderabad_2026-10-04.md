# AI Engineer Intern — Hyderabad: Manual Search Results

Date: 2026-10-04
Query: AI Engineer intern, Hyderabad (plus remote/WFH India-eligible)
Method: manual CLI runs — `careers-search` (company portals), `internshala-search`, `unstop-search`
Output contract: title, company, location, date, URL + full detail where fetched.

## TL;DR

- **Direct AI/ML internships found: 10 on Unstop** (5 with full details below). Most are remote/WFH, open to Hyderabad applicants; only one lists a city (Mumbai, hybrid).
- **Company career portals (17 seeded boards): zero AI-engineer internships right now.** Boards are live and returned 142 intern postings for `-q "intern"`, but they are finance, talent-acquisition, and content roles — no AI/ML reqs on the seeded boards today.
- **Internshala Hyderabad returns no AI roles** for `-q "AI"` / `-q "machine learning"` — its Hyderabad results are sales/marketing roles (location-driven matching). Use Unstop for AI internships; use Internshala with broader keywords and manual filtering.

## 1. Unstop — AI internships (10 results, 2026-10-04)

Search: `search -q "AI engineer" -l "Hyderabad" --type internships --limit 20 --format json`
Note: Unstop locations are mostly null (remote-first); location filter is soft. All 10 below matched the AI query.

### 1.1 AI Internship — Vortizo AI ✅ full detail
- URL: https://unstop.com/internships/ai-internship-vortizo-ai-1765255
- ID: 1765255 | Date: 2026-10-03 | Location: remote (WFH) | Type: full-time
- Stipend: ₹25,000/month | Duration: 6 months | Deadline: 2026-10-17
- Skills: Artificial Intelligence (AI), Machine Learning Concepts, Data Analysis Tools, Problem Solving, Communication Skills
- Eligibility: Engineering Students, Postgraduate, Undergraduate, Fresher, Arts/Commerce/Sciences & Others
- Description: research/prototyping/implementation of AI/ML solutions; data prep, analysis, model evaluation, documentation under mentorship; open to freshers and college students from any relevant background.

### 1.2 AI/ML Engineer Internship — FlatUIUX ✅ full detail
- URL: https://unstop.com/internships/aiml-engineer-internship-flatuiux-1760394
- ID: 1760394 | Date: 2026-09-23 | Location: remote (WFH) | Type: full-time
- Stipend: ₹7,000–12,000/month | Deadline: 2026-10-06
- Skills: SQL, Machine Learning Concepts, Python, Data Cleaning, NumPy/SciPy/Pandas, Scikit-learn
- Eligibility: Engineering Students, Postgraduate, Undergraduate
- Description: real-world AI/ML projects — data processing, model development, intelligent automation; dataset prep, training/evaluation/optimization in Python; integrate models into production apps/APIs. Requires CS/AI/ML/Data Science degree (pursuing or recent), Python, ML fundamentals, NumPy/Pandas/Sklearn/TF-or-PyTorch, stats/probability, Git. Academic/Kaggle projects encouraged.

### 1.3 AI Internship — jeeai ✅ full detail
- URL: https://unstop.com/internships/ai-internship-jeeai-1761325
- ID: 1761325 | Date: 2026-10-01 | Location: remote (WFH) | Type: part-time, 15–20 hrs/week
- Stipend: unpaid | Duration: 6 months | Deadline: 2026-10-08
- Skills: Artificial Intelligence (AI), Machine Learning Concepts, Python, Data Analysis Tools, Critical Thinking
- Eligibility: Engineering Students, Postgraduate, Undergraduate, Arts/Commerce/Sciences & Others
- Description: AI/ML research and experimentation, AI-assisted (vibe-coding) prototyping, data prep, model training/testing/evaluation. No professional experience required.

### 1.4 AI/ML Internship — SCORR (Connected Ecosystems) ✅ full detail
- URL: https://unstop.com/internships/aiml-internship-scorr-connected-ecosystems-1763128
- ID: 1763128 | Date: 2026-10-01 | Location: Mumbai (hybrid) | Type: part-time
- Stipend: not listed | Deadline: 2026-10-12
- Skills: Machine Learning Concepts, Artificial Intelligence (AI), Python, Scikit-learn, Pandas
- Eligibility: Engineering Students, Postgraduate, Undergraduate
- Description: develop/train/test/optimize AI/ML models on sustainability, ESG, climate, and finance datasets; preprocessing, feature extraction, backend analytical workflows, API integrations, dashboards. Prefers candidates with prior internships, academic projects, certifications, or hackathons; Python/R/SQL, Sklearn/TF/PyTorch/Pandas/NumPy.

### 1.5 AI/ML Internship — Codeatrix ✅ full detail
- URL: https://unstop.com/internships/aiml-internship-codeatrix-1761049
- ID: 1761049 | Date: 2026-09-24 | Location: remote (WFH) | Type: full-time
- Stipend: ₹10,000–20,000/month | Duration: 2 months | Deadline: 2026-10-08
- Skills: Artificial Intelligence (AI), Machine Learning Concepts, Analytical Skills, Communication Skills, Research Skills
- Eligibility: Engineering Students, Postgraduate, Undergraduate, Fresher, Arts/Commerce/Sciences & Others
- Description: research/prepare/implement AI/ML solutions with mentors; documentation, testing, analysis. Suited to freshers/beginners.

### 1.6–1.10 Further AI internships (search-hit level, details not yet fetched)
- AI Video Creator & Generative AI Internship — VDocs Health — ₹2,000–10,000 — 2026-10-04 — https://unstop.com/internships/ai-video-creator-generative-ai-internship-vdocs-health-1760433
- Generative AI Internship — IntelleQAcademy — ₹10,000–20,000 — 2026-10-03 — https://unstop.com/internships/generative-ai-internship-intelleqacademy-1751495
- AI Automation Internship — Nexplan — stipend not listed — 2026-09-29 — https://unstop.com/internships/ai-automation-internship-nexplan-1763062
- Freelance AI Data Annotation Internship — Perit AI — ₹25,000–30,000 — 2026-09-29 — https://unstop.com/internships/freelance-ai-data-annotation-internship-perit-ai-1760765
- AI Data Annotation Internship (Fixed Term) — Perit AI — ₹25,000–30,000 — 2026-09-29 — https://unstop.com/internships/ai-data-annotation-internship-fixed-term-perit-ai-1760773

Fetch any detail with: `bun run .agents/skills/unstop-search/cli/src/cli.ts detail <id> --format json`

## 2. Company career portals — no AI internships on seeded boards today

Search: `careers-search/cli search --region india -q "AI engineer" --type internships --format json`
Result: **0 matched of 102 fetched** (Amazon 13, Freshworks 87, Paytm 1, Meesho 1; Salesforce 503 error, others 0).
Boards are healthy — the query + internship filter just matches nothing.

Broader pass `-q "intern" --type internships` returned 10 rows (all non-AI):
- Amazon India (Bengaluru): Financial Analyst Intern NL/RE&E Finance (2026-09-01), Financial Analyst Intern (2026-08-10), Financial Analyst Intern AMZL (2026-08-25)
- Groww (Bengaluru): Video Editor Intern (2026-09-17), YouTube & Content Internship (2026-09-04)
- Paytm (Bangalore/Noida): Intern–Talent Acquisition, Internship–Talent Acquisition, TA Intern Bangalore, TA Intern Noida
- Meesho (Bangalore): Trainee–Recruitment Coordinator (2025-07-30, likely stale)

Takeaway: seeded company boards skew full-time engineering + non-tech internships. For AI internships, Unstop is the productive channel today; re-run the company-portal pass weekly — boards refresh and AI reqs appear there first when they open.

## 3. Internshala Hyderabad — no AI matches

Searches run:
- `-q "AI engineer" -l "Hyderabad" --type internships` → 2 results, both non-AI (Marketing & Sales @ Reliance Nippon Life Insurance, Lucknow/Pune/Hyderabad, 2 weeks ago; Sales @ Titan Company Limited, Chennai/Hyderabad/Bangalore, 3 days ago)
- `-q "machine learning" -l "Hyderabad" --type internships` → same 2 non-AI results

Internshala's search is location-driven here: Hyderabad matches surface regardless of the AI keyword. Worth retrying with `-q "data science"`, `-q "python"`, or no location filter + manual Hyderabad screening.

## 4. Suggested next actions

1. Apply: 1.2 FlatUIUX (closest to "AI Engineer" title, deadline 2026-10-06 — earliest) and 1.1 Vortizo (highest stipend, deadline 2026-10-17).
2. Fetch details for 1.6–1.10 before the FlatUIUX deadline.
3. Re-run weekly: company-portal `-q "AI" --type internships` + Unstop `-q "AI" --type internships` + Internshala `-q "data science" -l Hyderabad`.
4. `/rank` the five detailed roles against the fit framework, then `/apply` for the top pick.

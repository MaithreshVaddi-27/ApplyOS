# Search Queries for Job Scraper

<!-- SETUP: `/setup --section search` personalizes the Stage Profile and query
     categories below. The defaults already work for an India + remote search
     without personalization; refine them for sharper results. -->

## Stage Profile

<!-- /scrape Step 0.5 reads this block first. `stage: ask` makes /scrape ask
     the user once, record the answer here, and proceed - so the file works on
     day one and self-personalizes on first run. -->

```
stage: ask              # ask | student | fresher | experienced | remote-global
graduation_year: [YYYY]
preferred_cities: [Bangalore, Hyderabad, Pune, Delhi NCR, Mumbai, Chennai, ...]
remote_preference: [pan-india-remote | global-remote | hybrid | onsite]
stipend_floor: [INR/month for internships, student stage]
expected_ctc_floor: [LPA for fresher/experienced stages]
notice_period: [immediate | 15 | 30 | 60 | 90 days | buyout available]
```

### Stage → portal sets (used by /scrape Step 0.5; unlisted portals report `skipped (stage)`)

| Stage | Portals that run |
|---|---|
| `student` | internshala-search, unstop-search, cuvette-search, wellfound-search, linkedin-search, careers-search |
| `fresher` | internshala-search, unstop-search, cuvette-search, cutshort-search, naukri-search, wellfound-search, linkedin-search, careers-search |
| `experienced` | naukri-search, cutshort-search, instahyre-search, hirist-search, wellfound-search, linkedin-search, careers-search |
| `remote-global` | remoteok-search, remotive-search, weworkremotely-search, wellfound-search, linkedin-search, freehire-search |

Portals marked `enabled: false` in their SKILL.md stay skipped for every stage
(the stage map selects from enabled portals only). Portals in a stage's list
that are not yet installed also report `skipped (stage)` rather than failing
the run.

## Installed portal CLIs (primary for `/scrape`)

`/scrape` discovers every portal skill under `.agents/skills/*/SKILL.md` and runs its CLI first. Shipped country-agnostic CLIs include `linkedin-search` and `freehire-search`; Indian portals (naukri, internshala, unstop) and global remote portals are included the same way, and any skill added with `/add-portal` joins automatically. You do **not** need a matching `site:` line below for those CLIs to run.

The `site:` query templates in this file are the **WebSearch fallback** — for portals without a CLI, company career pages, or when a CLI fails.

**Language scope:** write every query category in every language listed in your CLAUDE.md Languages table (typically 1-2, sometimes more). A posting requiring a language you have *not* declared, as a job condition, is excluded before scoring; a posting requiring a *higher level* than you declared in a language you *do* work in is flagged for your own judgment, not excluded — see `04-job-evaluation.md`'s Language Gate, the single source of truth for this rule. Translate each category's keywords rather than machine-translating word-for-word (e.g. "Frontend Developer" -> "Desarrollador Frontend", not a literal word-for-word translation) if you work in more than one language.

## Search Sites

Primary (installed portal CLIs in `.agents/skills/`):
- **Naukri** - India's largest portal for mid-senior tech roles across MNCs, GCCs, and high-growth companies, with LPA compensation data and experience filters (covered by `naukri-search` CLI)
- **Internshala** - India's leading platform for internships, fresher roles, and entry-level jobs, with stipend filters and WFH listings (covered by `internshala-search` CLI)
- **Unstop** - India's premier platform for college students: hiring challenges, hackathons, internships, and early-career roles (covered by `unstop-search` CLI)
- **Wellfound** - High-growth startups and AI companies across Indian hubs (Bangalore, Pune, Mumbai, Delhi NCR) and global remote (covered by `wellfound-search` CLI)
- **LinkedIn** - Comprehensive professional listings across Indian tech hubs and worldwide (covered by `linkedin-search` CLI)
- **Remote OK** - Global remote engineering, AI, product, and developer opportunities (covered by `remoteok-search` CLI)
- **Remotive** - Vetted remote developer, DevOps, data, and tech roles worldwide and APAC/India-eligible (covered by `remotive-search` CLI)
- **We Work Remotely** - Top remote community for software engineering, design, and management (covered by `weworkremotely-search` CLI)
- **FreeHire** - Structured aggregator with transparent salary and tech-stack metadata (covered by `freehire-search` CLI)
- **Cutshort** - AI-matched Indian startup job board, strong fresher-to-3yr band, Bengaluru/Pune/remote-heavy (covered by `cutshort-search` CLI)
- **Company career portals** - Direct employer ATS boards: amazon.jobs, Greenhouse, Lever, SmartRecruiters, Workday (covered by `careers-search` CLI - see docs/COMPANY_PORTAL_SCRAPER.md)
- **WayUp** - US early-career and internship board; low yield for India-based candidates (covered by `wayup-search` CLI, disabled by default for India searches)
- *(planned — see docs/REFACTOR_PLAN.md Phase 2)* **Hirist** (mid-senior tech; JS shell — endpoint investigation needed)

> Investigated and declined (evidence in docs/REFACTOR_PLAN.md Section 12): **Cuvette** (domain no longer serves the portal), **Instahyre** (login-curated, bot-gated).

Secondary (company career pages and WebSearch fallback):
- Direct Google searches with `site:` filters for known target companies
- Indian tech unicorns & product companies (e.g. Razorpay, Zerodha, CRED, Swiggy, Zomato, PhonePe, Flipkart, Meesho, Groww)
- Global capability centers (GCCs) and IT services (e.g. TCS, Infosys, Wipro, HCL, Google India, Microsoft India, Walmart Global Tech, Target India)

## Query Categories

Queries are grouped by priority. Write **each category in every language from your Languages table** (see Language scope above). Combine each query with your location terms where the site supports it.

**Organize by function, not job title.** The same underlying work carries different titles across companies and markets (a "Data Scientist" role at one employer may be posted as "Insights Analyst" or "Data Consultant" at another). Name each priority category after the function it covers, and list several plausible job titles as query variants within that category rather than betting an entire priority tier on one exact title string.

### Priority 1: Software Engineering (India)

```
site:naukri.com "software engineer" Bangalore OR Hyderabad OR Pune
site:linkedin.com/jobs "software engineer" India
site:cutshort.io "backend developer" remote India
site:instahyre.com "full stack developer" Bangalore
```

### Priority 2: Internships & Fresher Roles (India)

```
site:internshala.com "software development" internship work from home
site:unstop.com internship "2026 batch" technology
site:cuvette.tech "sde intern" India
site:naukri.com "graduate engineer trainee" India
```

### Priority 3: Data, AI/ML & Adjacent Roles

```
site:linkedin.com/jobs "machine learning engineer" Bangalore OR remote
site:naukri.com "data scientist" Hyderabad OR Pune
site:wellfound.com "AI engineer" India
site:hirist.tech "data engineer" Bangalore
```

### Priority 4: Global Remote (India-eligible / timezone-overlap)

```
site:remoteok.com "backend" remote worldwide
site:remotive.com "software engineer" remote india OR apac
site:weworkremotely.com "full-stack" remote
site:linkedin.com/jobs "software engineer" remote "timezone overlap" India
```

### Priority 5: Company career pages (careers-search seeds + fallback)

```
site:boards.greenhouse.io "<company>" "<role keyword>"
site:jobs.lever.co "<company>" "<role keyword>"
site:jobs.smartrecruiters.com "<company>" India
site:jobs.ashbyhq.com "<company>" "<role keyword>"
```

## Location Filter

When evaluating results, verify the job location aligns with your work arrangement preference:
- **India Metro Tech Hubs**: Bangalore/Bengaluru, Hyderabad, Pune, Delhi NCR (Delhi, Gurgaon, Noida), Mumbai, Chennai
- **Tier 2/3 Emerging Hubs**: Ahmedabad, Kochi, Chandigarh, Jaipur, Indore, Coimbatore
- **Pan-India Remote**: Roles open to candidates located anywhere in India
- **Global Remote**: Worldwide remote roles, or roles accepting APAC / India timezone overlap (typically requiring 3-4 hours overlap with US/EU or async communication)
- [YOUR_CITY] and surrounding areas (personalize via `/setup --section search`)
- [ACCEPTABLE_AREA_1]
- [ACCEPTABLE_AREA_2]

## Language Filter

Your working languages and levels are in CLAUDE.md's Languages table. When filtering scraped results, apply `04-job-evaluation.md`'s Language Gate: a posting requiring a language you haven't declared at all is excluded; a posting requiring a higher level than you declared in a language you do work in is not excluded, flag it clearly instead (see `job-scraper/SKILL.md`'s Step 3 "Quick Fit Assessment" for how the flag surfaces in `/scrape` output). Postings simply *written* in a language you don't work in, that don't require it on the job, are fine.

## Date Filter

Only include jobs posted within the last 14 days, or with an application deadline that has not yet passed. If a posting date cannot be determined, include it but flag as "date unknown".

## Adapting Queries

If the user specifies a focus area, select queries from the matching category and also generate 2-3 custom queries for that focus. For example:
- "/scrape [focus_area]" -> relevant category queries + custom focus-specific queries

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commonly Used Commands

### Setup and Onboarding
- `/setup` - Initialize your profile (interactive setup for candidate information)
- `/reset` - Clear profile data or documents (use with caution)

### Job Search Workflow
- `/scrape` - Search multiple job portals for positions matching your profile
- `/rank` - Batch-score scraped postings against fit framework to get ranked shortlist (now includes staleness flags for postings >30 days old)
- `/apply <URL>` - Run full workflow: evaluate fit, draft CV+cover letter, review, revise, and present final output
  - Can also accept raw job description text: `/apply <paste job description>`
- `/expand` - Enrich profile by scanning public sources (GitHub, portfolio, etc.) for competencies
- `/upskill` - Analyze skill gaps between profile and job postings, generate learning plan

### Application Management
- `/outcome` - Record application results (interviews, offers, rejections), archive materials
- `/outcome followup` - Surface quiet applications and draft follow-up messages
- `/interview` - Prepare for scheduled interviews with stage-specific prep packs
- `/gmail-sync` - Auto-detect application status from Gmail (approved changes only)

### Reporting and Extensions
- `/html-report` - Generate self-contained HTML dashboard from application tracker
- `/notion-sync` - Publish pipeline view to Notion database (one-way sync)
- `/add-template` - Register custom CV/cover letter LaTeX/Templating toolchain
- `/add-portal` - Generate job-portal search skill for new job boards

## India-Specific Enhancements

### Current Indian Job Market Coverage
The repository includes dedicated search skills for the Indian market:
- **internshala-search** - Internshala (India's leading platform for internships, engineering fresher roles, and entry-level positions)
  - Supports searching by keyword, location (Bangalore, Delhi NCR, Mumbai, Hyderabad, Pune, Chennai, Work from Home), stipends, and profile categories
  - Particularly strong for: internships, fresh graduate roles, entry-level jobs across tech, engineering, data science, product, and business domains
- **unstop-search** - Unstop (formerly Dare2Compete, India's premier community platform for college students and fresh graduates)
  - Covers technology, software engineering, analytics, marketing, product, and business roles
  - Strong for: hackathons, hiring challenges, internships, and early-career opportunities across Bangalore, Hyderabad, Delhi NCR, Mumbai, Pune, and pan-India remote
- **linkedin-search** - Works across Indian cities with location filtering (e.g., `-l "Bengaluru, Karnataka, India"`)

### Recommended India-Focused Search Strategy
1. **For internships/entry-level**: Start with internshala-search and unstop-search
2. **For experienced roles**: Add wellfound-search (startup/AI focus) and wayup-search (early-career)
3. **For remote global roles**: Use remoteok-search, remotive-search, weworkremotely-search
4. **For broad discovery**: Use linkedin-search with India-specific location filters
5. **For aggregator results**: Use freehire-search (multi-market structured listings)

### India-Specific Profile Optimization
When setting up your profile via `/setup`, emphasize:
- **Technical skills relevant to India's growing sectors**: AI/ML, cloud computing, fintech, healthtech, edtech, SaaS
- **Experience with India-specific contexts**: Working with distributed teams, understanding of Indian business environment, familiarity with local regulations where relevant
- **Language proficiencies**: Clearly indicate English proficiency and any additional Indian languages (Hindi, Bengali, Tamil, etc.) if relevant to target roles
- **Location preferences**: Specify willingness for hybrid/remote work arrangements common in India's tech sector

## Quality and Accuracy Improvements

### Enhanced Verification Protocols
1. **Multi-source claim validation**: For company-specific claims (products, partnerships, technology stacks), verify against:
   - Official company website
   - Recent press releases/news (last 6 months)
   - LinkedIn company page
   - Trusted tech publications (TechCrunch, YourStory, Inc42, MediaNama for India-specific news)
   - Never rely solely on information from the job posting itself

2. **Salary data integrity** (if using salary benchmarking):
   - Prioritize India-specific sources: Glassdoor India, AmbitionBox, Payscale India, LinkedIn Salary Insights
   - For international roles, use Levels.fyi, Blind, or industry-specific surveys
   - Always cite sources and note date of data (salaries change rapidly in India's tech market)

3. **Skill relevance verification**:
   - Cross-reference claimed skills with actual project experience from your documents
   - For emerging technologies (e.g., specific AI frameworks), verify proficiency level through concrete project examples
   - Be honest about proficiency levels - avoid overstating familiarity with tools/languages

### Application Quality Controls
1. **Pre-compilation checks**:
   - Verify LaTeX syntax with `lualatex -interaction=nonstopmode -halt-on-error` before full compilation
   - Check for common issues: missing packages, font encoding problems, bibliography errors

2. **ATS optimization enhancements**:
   - Use standard section headings recognizable by Indian ATS systems: "Work Experience", "Education", "Technical Skills", "Projects"
   - Avoid graphics, tables, or complex formatting that may not parse correctly
   - Ensure keywords from job description appear naturally in context (not stuffed)

3. **Cover letter India-specific improvements**:
   - Address cultural nuances: appropriate formality level for Indian companies (typically more formal than US startups)
   - Reference understanding of Indian work culture when relevant
   - For multinational companies, balance global professionalism with local awareness

### Continuous Accuracy Monitoring
1. **Monthly profile review**: Refresh your profile data quarterly to reflect new skills, experiences, and achievements
2. **Skill decay tracking**: Note technologies you haven't used recently and either refresh knowledge or adjust proficiency indicators
3. **Feedback loop integration**: After interviews, note which aspects of your application resonated and which didn't, then refine accordingly

## Useful Feature Additions

### Advanced Search Capabilities
1. **Composite searches**: Combine multiple portal searches for comprehensive coverage
   ```
   # Example: Search for AI roles across Indian portals
   /scrape --portals internshala-search,unstop-search,wellfound-search --query "AI engineer" --location "Bangalore"
   ```

2. **Saved search profiles**: Create reusable search configurations for different career goals
   - `/scrape --save-profile ai-research-india` 
   - `/scrape --use-profile ai-research-india`

3. **Geographic flexibility**: Enhanced location search for India's distributed workforce
   - Support for metro area searches (e.g., "Delhi NCR" covering Delhi, Gurgaon, Noida, Faridabad, Ghaziabad)
   - Remote work filters specific to India-based companies offering global remote roles

### Application Tracking Improvements
1. **Stage-specific follow-up automation**:
   - `/outcome followup --stage screening` - Drafts appropriate messages for post-application followups
   - `/outcome followup --stage interview` - Thank you notes tailored to interview round

2. **Interview preparation enhancements**:
   - `/interview --company-specific` - Deep dives on company culture, tech stack, recent news
   - `/interview --role-play` - Simulated interview sessions with feedback on responses

3. **Application analytics**:
   - `/html-report --insights` - Generates insights on application timing, response rates by portal/sector
   - `/upskill --market-trends` - Shows emerging skill demands in India's job market

### Document Template Enhancements
1. **India-optimized templates**:
   - ATS-friendly CV templates optimized for Indian recruiters' scanning patterns
   - Cover letter templates with appropriate formality for different company types (startup vs MNC vs government)

2. **Multi-language support**:
   - Option to generate bilingual CVs/cover letters for roles requiring local language proficiency
   - Proper formatting for Indian address formats, phone numbers (+91 prefix), and date formats (DD/MM/YYYY)

3. **Portfolio integration**:
   - Automated linking to online portfolios, GitHub profiles, and LinkedIn
   - QR code generation for easy access to digital profiles (when permitted by template)

### Developer Experience Notes

There are no `/skill-create`, `/skill-update`, `/skill-test`, or `/debug` commands in this
repository - earlier revisions of this file listed them, which misled agents into citing
capabilities that do not exist. The real extension paths are `/add-portal` (new job board),
`/add-template` (custom CV/letter toolchain), and `/setup` (profile). Feature ideas are tracked
in [docs/REFACTOR_PLAN.md](docs/REFACTOR_PLAN.md), not as phantom commands here. Diagnostics:
`/scrape health <portal>` probes portal CLIs; `bun test` inside a skill's `cli/` runs its suite;
`python tools/lint_skills.py` and `python tools/security_guards.py` guard the repo.

## Documentation Map

| Document | Contents |
|---|---|
| [docs/REFACTOR_PLAN.md](docs/REFACTOR_PLAN.md) | The working refactor roadmap: audit findings, upgrade/degrade lists, phases, pending tasks |
| [docs/COMPANY_PORTAL_SCRAPER.md](docs/COMPANY_PORTAL_SCRAPER.md) | Company-career-portal scraper: verified endpoints, seeds, build guide, usage, verification log |
| [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) | Historical status of the first India-market upgrade pass (verified-work snapshot) |
| [CHANGELOG.md](CHANGELOG.md) | Release notes; `[Unreleased]` carries the latest changes |
| [SETUP.md](SETUP.md) | Install and onboarding walkthrough |
| [SECURITY.md](SECURITY.md) | Untrusted-content and supply-chain posture |

## Maintenance and Updates

### Keeping Current
1. **Regular skill updates**:
   ```
   # Update all job search skills to latest versions
   for skill in .agents/skills/*/cli; do (cd $skill && bun install); done
   ```

2. **Framework version tracking**:
   - Monitor `framework_version` markers in skill files
   - Use `python tools/check_framework_version.py` to detect version mismatches
   - Read CHANGELOG.md for detailed update notes

3. **Contributing improvements**:
   - Follow CONTRIBUTING.md guidelines for submitting new job portal skills
   - Ensure new skills meet zero-runtime-dependency requirement and include comprehensive tests
   - Document India-specific considerations in skill documentation

### Troubleshooting Common India-Specific Issues
1. **Portal access problems**:
   - Some Indian job portals have aggressive bot detection - use `/add-portal` to create customized skills with appropriate headers and rate limiting
   - For portal-specific issues, check the skill's `SKILL.md` for known limitations and workarounds

2. **Language encoding challenges**:
   - Ensure UTF-8 encoding is used throughout for proper handling of Indian language characters
   - Verify LaTeX templates support Unicode for multilingual applications

3. **Salary data discrepancies**:
   - Indian salary data varies significantly by city tier (metro vs Tier 2/3) - always specify location context
   - Account for differences in compensation structure (basic + allowances vs CTC)

## Verification Checklist (Enhanced)

All generated CVs and cover letters must pass these enhanced checks:

### Factual Accuracy (India-specific additions)
- [ ] All claims match actual profile - verified against source documents
- [ ] India-specific experience clearly contextualized (city, company type, relevant regulations)
- [ ] Salary expectations (if included) based on current India market data with sources cited
- [ ] Language proficiency claims validated with actual usage examples

### Technical Quality
- [ ] LaTeX compiles without warnings/errors using correct engines (lualatex for CV, xelatex for cover letter)
- [ ] PDF text extraction yields clean, readable text suitable for Indian ATS systems
- [ ] No orphaned section titles or formatting artifacts that would confuse recruiters
- [ ] Consistent date formatting (preferably DD/MM/YYYY for India-standard compliance)

### India Market Relevance
- [ ] Keywords align with terminology used in Indian job postings (not just global equivalents)
- [ ] Location preferences clearly stated with awareness of India's hybrid/remote work trends
- [ ] Cultural appropriateness in tone and formality level for target company type
- [ ] Relevant India-specific certifications or qualifications highlighted where applicable

This enhanced CLAUDE.md provides specific guidance for optimizing ApplyOS for the Indian market while maintaining the core quality and accuracy standards that make the system effective.
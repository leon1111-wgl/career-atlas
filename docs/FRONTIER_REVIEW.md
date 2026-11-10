# Frontier review: career assistants and agents (2026-11)

Author: Leon Wang. Researched 2026-11-10 for release 0.2.0. Every product claim below has a link and the date it was published or read. "Self-reported" means the company's own figure, with no independent audit.

## Question

What should a free, static, no-key career atlas adopt from current agent practice, so that a visitor can ask a route question in their own words and get an answer whose every number is checkable?

## What large companies run in production

| Company / body | What runs | Source (date) |
|---|---|---|
| LinkedIn, recruiter side | **Hiring Assistant.** A plan-and-execute agent: a planner writes a structured, task-specific plan and an executor runs it with tool use. A supervisor routes work to sub-agents (intake, sourcing, evaluation, outreach, screening, learning) that are modelled as tools. The evaluation agent produces recommendations "with supporting evidence" against recruiter-approved qualifications; recruiters make the final decisions. | [LinkedIn Engineering, 2025-10-21](https://www.linkedin.com/blog/engineering/ai/how-we-engineered-linkedins-hiring-assistant) |
| LinkedIn, rollout | Globally available in English by the end of September 2025, after charter customers from October 2024. Self-reported: 4+ hours saved per role, 62% fewer profiles reviewed, 69% better InMail acceptance. | [LinkedIn News, 2025-09-03](https://news.linkedin.com/2025/hiring-assistant-globally-available) |
| LinkedIn, job-seeker side | AI-powered job search: "describe the role you want in your own words". No availability date on the page. | [LinkedIn Help Center, read 2026-11-10](https://www.linkedin.com/help/linkedin/topic/a153003) |
| Indeed | **Career Scout** (job seekers) and Talent Scout (employers). Career Scout reads skills and interests to surface "career paths people may not have considered", gives company and salary insights, and guides from discovery to interview preparation inside the app. Self-reported: 7× faster to find and apply (median, US); 38% more likely to be hired per application (Indeed test data, US, May 2025). | [Indeed press release, 2025-09-10](https://www.indeed.com/news/releases/indeed-introduces-new-suite-of-hiring-products-career-scout-talent-scout-premium-sponsored-jobs-and-indeed-connect?co=US) |
| BOSS直聘 | Q2 2025 results: an AI search product that returns 动态内容摘要、求职策略规划、简历优化指南 for a search keyword; an AI面试训练机器人 for mock interviews; on the recruiter side, AI辅助职位优化 supporting tens of thousands of postings a day (self-reported). | [新华网, 2025-08-21](https://www.news.cn/tech/20250821/096f71c1eaed4dee8ade54c8fd6f5433/c.html) |
| 智联招聘 | An internally incubated job-seeker product, 求职侠: matching jobs to the person, tailoring a résumé per role, submitting applications and messaging HR on the user's behalf, with progress tracking. The article gives no launch date. Its survey figure (87.2% of respondents interested in an AI job-search tool) is the company's own research. Secondary reports name another product, 职悟空; not verified here. | [新京报, 2026-07-16](https://www.bjnews.com.cn/detail/1784202970129697.html) |
| U.S. Department of Labor | CareerOneStop **mySkills myFuture**: "Enter your current or past job and find career matches with similar skills." CareerOneStop pages returned HTTP 403 to automated reads on 2026-11-10, so this is cited from a state page. | [New York State DOL, read 2026-11-10](https://dol.ny.gov/transferable-skillscareer-exploration) |
| O*NET (DOL-funded) | **Related Occupations** for 923 occupations, computed from task and detailed-work-activity similarity, knowledge similarity and alternate-title similarity. | [O*NET report, 2022-04](https://www.onetcenter.org/reports/Related_2022.html) |
| Chinese universities | In-house employment systems with AI mock interviews and targeted job push (北京航空航天大学: "AI面试系统进行模拟面试", "就业信息精准推送"). | [中国新闻网, 2023-07-10](https://www.chinanews.com.cn/gn/2023/07-10/10039868.shtml) |
| 教育部 24365 platform | I found no primary documentation of an AI agent or LLM assistant on the national graduate employment platform. This is a gap in the review, not a negative finding. | — |

**Pattern.** The platforms put a planner in front of structured layers they already own (job index, skills graph, approved qualifications), return recommendations with evidence, and keep people on the decisions. The job-seeker products go further than this demo on actions (applying, messaging HR) and on personal data (profiles, résumés). Government tools stay deterministic: related occupations are computed from published task and knowledge data, not generated.

**What this release mirrors.** Plan, then call tools, then answer with evidence (LinkedIn's plan-and-execute; O*NET-style related roles and skill gaps; Career Scout's "paths you may not have considered").

**Where it deliberately differs.**
- The planner is rules, not a model. The vocabulary is closed (26 industries, 111 roles, 44 major families), and the first blind run showed that every miss was a wording or vocabulary gap that rules fix and tests can pin.
- Read-only. No applications, messages, profiles or stored questions.
- Facts only from official statistics, official university reports and the site's catalog. No employer pay, no city pay, no starting salary, no odds: these come back as named gaps.
- Scale: one static page and one set of public files; no index of live jobs.

## Candidates

| # | Candidate | Decision | Reason |
|---|---|---|---|
| 1 | **Route assistant: rule planner, typed data tools, visible trace** | **Adopt** | The highest-value change a visitor can try: their own question, an answer with sources and dates, and the plan and every tool call shown. It mirrors plan-and-execute (LinkedIn, 2025-10-21) at the scale where Anthropic's guidance favours a fixed workflow over an autonomous agent: "finding the simplest solution possible" ([Building effective agents, 2024-12-19](https://www.anthropic.com/engineering/building-effective-agents)). Checked by `tests/route.test.mjs` and the blind set. |
| 2 | Skill gap and adjacent-role trails over the catalog | **Adopt (inside 1)** | The catalog already holds skills, major links and editor-marked adjacent roles; the gap and trail are computed, not written. Mirrors mySkills myFuture and O*NET Related Occupations. Labelled as editorial research, never as a transfer success rate. |
| 3 | Number provenance and named data gaps | **Adopt (inside 1)** | Every number is rendered from a typed fact with source, period and date; anything else that looks like a number must already exist in the published data. Twelve gap rules (starting salary, odds, school background, hours, employer pay, forecasts, personal fit, rankings, city pay, match rate, 保研率/考研成功率, time to first job) answer "the data cannot say this" with the reason and what can be checked instead. Tests fail if a number lacks its citation or does not exist in the data. |
| 4 | Small LLM as the planner (Qwen3-0.6B in the browser, already shipped as an opt-in selector) | **Skip; tier 2 stays opt-in and unchanged** | No measurement points to a gain: the 21 non-correct first-run cases were cue words, aliases and missing gap rules, all fixable deterministically. The model is about 335 MiB per visitor, needs WebGPU, and cannot be verified on Actions runners (no GPU). LoopDesk's real tier-2 run on a runner failed after about 11 minutes ("Grammar matcher rejected the newly sampled token") and could have gained at most 1 of 150 blind cases. It stays behind a click and still only re-selects excerpts for catalog-retrieval answers. |
| 5 | In-browser sentence embeddings for retrieval | Skip | Closed vocabulary; synonyms are handled by an alias table with tests. An extra download for every visitor without a measured miss it would fix. |
| 6 | LLM-as-judge grading on Actions | Skip | GitHub Models was retired on 2026-07-30 ([GitHub docs](https://docs.github.com/en/github-models/use-github-models/prototyping-with-ai-models)). A CPU judge would itself need validating against hand grades; 48 cases with written expect/forbid lists are graded by hand against a published rubric. |
| 7 | Simulated users (τ²-bench style) | Skip | The assistant is single-turn and read-only, so there is no end state to grade. LoopDesk uses this where it fits (money and ticket state). |
| 8 | Exposing the tools over MCP | Skip | No external client; a static site; nothing a visitor would see or a reviewer could measure. |

## Evaluation protocol

A blind set of 48 questions (32 answer, 16 must-not-answer) was written by another model family (Claude Sonnet 5.5) from a public brief and a name inventory only, and committed (`03d26f7`) before any assistant code. The first run on `3c85af3` is the reported result; see [ROUTE_ASSISTANT.md](ROUTE_ASSISTANT.md). Fixes after that run are not blind.

## Not verified

- CareerOneStop and mySkills myFuture pages refused automated reads (HTTP 403); described from the New York State DOL page.
- LinkedIn's job-search availability by country; the help page carries no date.
- 智联招聘's 职悟空 and its launch date; BOSS直聘's model stack beyond the Xinhua summary.
- Any AI assistant on the 教育部 24365 platform.
- All usage and outcome figures above are self-reported by the companies.

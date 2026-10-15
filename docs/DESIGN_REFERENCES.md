# Recruitment interface references

Reviewed 2026-10-15 for the second design pass. Author identity across the product should be **Leon Wang**. The previous warm editorial dashboard is superseded by the user's request for a familiar recruitment-site structure.

## Public pages actually opened

1. [BOSS 直聘首页](https://www.zhipin.com/)
   - Accessible public content included horizontal primary navigation, a job/company search entry, popular query shortcuts, and grouped occupation categories.
   - Useful pattern: people can start with a concrete query or a known occupation family. Search and occupation taxonomy carry the page rather than an inspirational headline.
   - Clicking the public Python shortcut reached a security interstitial. No login, challenge completion, or bypass was attempted; its result layout was not reviewed.

2. [智联招聘首页](https://www.zhaopin.com/)
   - Accessible content included top navigation, job/company search, occupation taxonomy, and repeated job entries.
   - Entries put the job title, pay, company, education/experience, skills, and benefits in a repeatable information order.
   - Useful pattern: use stable fields and repeated rows so users can compare options quickly. Avoid bespoke narrative cards for every item.

3. [智联招聘：软件开发工程师详情](https://www.zhaopin.com/jobdetail/CC879868660J40942628312.htm)
   - The public page exposed title, location, experience and education near the main action; description and skills followed, with work location and company information in separate sections.
   - Pay and complete content were partially gated in this anonymous view. The design study uses the public information hierarchy only.
   - Useful pattern: the detail heading identifies the occupation immediately; conditions precede long explanatory text; employer/context material has its own section.

4. [Indeed：software engineer / New York results](https://www.indeed.com/jobs?l=New+York%2C+NY&q=software+engineer)
   - Accessible public content included separate keyword and location inputs; filters for posting date, remote work, skills, job type, experience, pay, education, and distance; relevance/date sorting; and repeated results.
   - Result content used a title followed by company/location and short qualification or task excerpts.
   - Useful pattern: search context remains visible above results; filters precede the list; result count and ordering belong with the list rather than in a dashboard card.
   - An individual Indeed job redirect could not be fetched. No claim is made about that detail page.

5. [猎聘职位入口](https://www.liepin.com/zhaopin/)
   - Redirected to a security challenge. This page did not inform the proposed layout.

These observations come from actually opening the public pages through the web reader. They establish content order and available controls; pixel-level measurements and desktop/mobile screenshot comparisons of the reference sites were not performed.

## Proposed platform structure

Use a full-width white masthead containing the brand, horizontal text navigation, and a quiet assistant entry. Below it, keep a centered content region around 1180–1240px wide. Use a light neutral page background, sage only for active state and principal actions, restrained clay for evidence qualifications, and sans-serif headings throughout.

The initial screen should identify the service directly, for example “行业与职业研究”, followed by a prominent query field with “搜索岗位、行业、专业” as the label/placeholder. One short plain description is sufficient. Remove the poetic hero, English eyebrow, large decorative mark, left SaaS sidebar, repetitive arrows, and unsolicited icon badges.

Primary navigation can be “职业库 / 行业研究 / 专业去向 / 观察报告 / 数据来源”. Existing functionality can remain under these clear labels. The macro statistics and charts belong on the industry research/overview page and can appear below the initial search/result area rather than acting as the entire first screen.

For the occupation library, use labeled filter rows above a single-column result list: region, occupation family, relevant major, and evidence coverage where the underlying data supports it. Show an explicit result count, current sort, active conditions, and reset. Do not add city, experience, current salary, posting recency, or remote filters unless this project has matching reliable fields.

A desktop result row can have three aligned regions: occupation title and short practical description; entry/skill information; statistical background and comparison action. Mobile collapses the same row into a compact stack. Give title and actual work content more emphasis than the exploration score. A row should not require reading an introductory paragraph before its role is clear.

The detail view should begin with occupation title, region, industry, entry conditions, and actions. Follow with ordinary document sections: typical work, preparation/skills, statistical background and period, AI task change, practice project, sources. Industry context and evidence can occupy a secondary desktop column; mobile presents a continuous reading order.

## Research properties that must survive the redesign

- The platform contains occupational research entries, not verified live vacancies. Label counts as “职业条目” or “目录岗位”, never as vacancies, current openings, employers recruiting, or new postings.
- Aggregate wages must say what they measure, the observation period, region, and source. Do not present an industry wage proxy as an individual's offer or invent a salary range.
- Keep exploration scores subordinate to occupation facts. The editor/statistical split, missing values, coverage, and scoring method remain accessible.
- Keep source timestamps and observation periods distinct. Avoid online dots, recruiter availability, urgency, or “live” claims.
- Show real charts with visible units, time axes, legends, and source notes. Do not add decorative sparkline movement.
- The assistant remains optional and secondary, with explicit retrieval/model state. No fake recruiter chat or application action.
- Use “查看职业” and “加入比较”, not “投递简历” or “立即沟通”. No fabricated companies or company logos.
- All visible author bylines and the footer use Leon Wang, consistently with the user's latest instruction.

## Decision boundary

Borrow the mature sites' task order, search clarity, taxonomy, information density, and repeated-field comparison. The proposed visual and interaction choices above are recommendations derived from those observations, not claims that the referenced sites use these exact dimensions, colours, or all of these layouts.

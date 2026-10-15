# Source audit

Checked 2026-10-15 UTC. GitHub metadata was fetched directly from the unauthenticated GitHub REST API. Exact snapshots, descriptions, stars, license detection and update timestamps are in `content/ecosystem.json`. Stars measure repository attention, not scientific validity, employment outcomes, completeness or authorization. `updatedAt` is GitHub repository metadata, not a guarantee that substantive content was revised.

## Integration decisions

- WebLLM: Apache-2.0 runtime candidate. Runtime integration is only established by the implementation's vendored files, notices and working browser test; this audit alone does not establish integration.
- Qwen3: official model source reference. GitHub API has no recognized repository license. Specific model weights and compiled artifacts require their own license review; no assumed blanket permission.
- Developer Roadmap: requested `kamranahmedse/developer-roadmap` now redirects to `nilbuild/developer-roadmap`. Its [custom license](https://github.com/nilbuild/developer-roadmap/blob/master/license) explicitly permits linking and prohibits redistribution of content without consent. Link only; no copied diagrams, prose or code.
- Project Based Learning and Tech Interview Handbook: MIT metadata, external learning links. Linked third-party tutorials retain their own licenses.
- System Design Primer: API reports NOASSERTION, but the [actual LICENSE](https://github.com/donnemartin/system-design-primer/blob/master/LICENSE.md) says CC BY 4.0. Link only in this release; future reuse requires attribution and change notices.
- Reactive Resume: former AmruthPillai URL redirects to `reactive-resume/reactive-resume`; MIT. External tool and design reference, no source copying.
- Zhang Xuefeng skill: MIT metadata, 10,500 stars at check time. Third-party community project; name does not prove authorship, personal involvement or endorsement. Link for examining decision frameworks only. No skill installation or remote instruction execution, and no adoption of its claims as verified career evidence.
- Civil-service repositories: kuriv has 1,008 stars and MIT; zhangxiangliang has 990 stars and no detected license; kaogong-skill has 178 stars and MIT. These are narrower community resources, explicitly not uniformly “high-star.” Use links only. No copying from the unlicensed repository, no remote skill execution, no unofficial eligibility rules.

No repository code, skill instructions, question banks or course text was copied as part of this audit. A repository license does not independently establish rights in every third-party question, image or linked resource.

## Counseling evidence and boundaries

[O*NET Interest Profiler](https://www.onetcenter.org/IP.html) is based on Holland RIASEC and has a [technical manual covering reliability, validity and occupational linkage](https://www.onetcenter.org/reports/IP_Manual.html). This supports using vocational interests as an exploration aid, together with skills, education, location, constraints and work evidence. An original short interest questionnaire must be labeled an exploratory questionnaire; it is not the validated O*NET instrument and cannot inherit its psychometric claims. Do not copy proprietary assessment items or imply precise probability of career success.

The [MBTI publisher's own career guidance](https://www.myersbriggs.org/type-in-my-life/personality-type-and-careers/) states that MBTI is not designed for hiring or job selection. Its [ethics code](https://www.myersbriggs.org/using-type-as-a-professional/mbti-code-of-ethics/home.htm) says a person should not be guided toward or away from a career solely on type. Thus MBTI can be an optional conversation aid, not an eligibility filter, ranking signal or salary predictor. Neither questionnaire diagnoses a person or fixes their career potential.

## Official examination entry points

- [National Civil Service Administration](https://www.scs.gov.cn/): use the current official notice to reach the appropriate year's application portal. An official government-hosted [2026 recruitment notice](https://yss.hrc.gov.cn/u/cms/luomahu/202510/151904519cym.pdf) identifies `http://bm.scs.gov.cn/kl2026`; this does not establish that the same URL applies to another examination year.
- [China Personnel Examination Network](https://www.cpta.com.cn/): qualification-examination information entry point. This is distinct from national civil-service recruitment.
- Provincial civil-service and public-institution vacancies require the named province's official organization/personnel or recruitment authority notice. Do not infer current eligibility, deadline, major equivalence or examination format from a GitHub study guide. No current application deadline is asserted here.

## Methodological fact-check of supplied AI investment examples

The user supplied these unsourced examples: combined 2026 US-company AI capex USD 730–745bn; Amazon >200bn, Google about 190bn, Microsoft about 175bn; ByteDance RMB160bn; Alibaba RMB380bn over three years; Tencent 2026 Q2 RMB52.8bn and +176%; six Chinese companies USD63bn annually; global 2026 AI profit pool USD637bn with China 11.5%. This audit does **not** verify those individual values or treat them as observed facts. They are omitted from quantitative industry ranking and profit-per-employee comparisons.

Primary evidence demonstrates why the labels and periods require care:

1. [Amazon's Q4 2025 company report](https://www.aboutamazon.com/news/company-news/amazon-earnings-q4-2025-report) describes an approximately USD200bn 2026 capex **outlook across Amazon**, discussing AI, chips, robotics and satellites. Company-wide planned capex cannot be relabeled AI-only actual expenditure.
2. [Alphabet's Q2 2025 earnings call](https://abc.xyz/2025-q2-earnings-call) discusses technical infrastructure and AI spending. A quarter-specific outlook is not a verified full-year 2026 AI-only expenditure measure.
3. [Microsoft's 2025 annual report](https://www.microsoft.com/investor/reports/ar25/) is for the year ended June 30. A Microsoft fiscal-year amount must not silently be combined with calendar-year figures; capex including finance leases also differs from cash additions to property and equipment.
4. A three-year commitment, quarterly actual spending, calendar-year forecast and fiscal-year cash flow cannot be added into one annual total. Preserve the exact period, forecast/actual status, currency, FX date, lease treatment, geography and definition of AI scope. Avoid double counting shared suppliers or allocations.
5. Net income divided by employee count is a **company accounting ratio**, not industry profit per worker, salary, new entrant income, social value or a causal return to learning AI. Conglomerate business mix, contractors, average versus period-end headcount, stock compensation and one-off gains affect comparisons.
6. A “global AI profit pool” needs an explicit definition, source model, company coverage, treatment of losses, geography allocation and forecast assumptions. No auditable source was supplied for USD637bn or 11.5%; neither is used.

The product may explain these examples as claims to investigate, but numerical career rankings require comparable, cited, dated datasets. Lack of verification is not evidence that a number is false.

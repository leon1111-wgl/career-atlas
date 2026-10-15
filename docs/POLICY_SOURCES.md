# Official policy and implementation signals

Author: Leon Wang. Research cutoff: 2026-10-16, Asia/Taipei.

This is a dated editorial selection, not a complete real-time policy database. A policy announcement, proposed incentive, signed award, payment, procurement order and actual vacancy are different events. None of these cards adds an automatic bonus to any career score. The `summary` explains the official material; every `opportunities` entry is explicitly labeled editorial analysis of a possible mechanism, and `constraints` explains what must be checked before inferring employment demand.

## Content and verification

The initial selection has 12 cards: five mainland-China and seven United States items, mapped only to 17 relevant IDs in the existing 26-industry catalog. We do not manufacture policy coverage for the other industries. Published dates are the original page publication dates, not crawl dates, target years or signing dates.

| Card | Original publication | Stage | Primary source |
| --- | --- | --- | --- |
| China employment-first 15th Five-Year Plan | 2026-06-17 | Action plan | [State Council](https://www.gov.cn/zhengce/zhengceku/202606/content_7072482.htm) |
| China AI + education action plan | 2026-04-10 | Action plan | [Five departments / government portal](https://www.gov.cn/zhengce/zhengceku/202604/content_7065138.htm) |
| China agent application and innovation guidance | 2026-05-08 | Issued guidance | [Cyberspace Administration](https://www.cac.gov.cn/2026-05/08/c_1779979789523320.htm) |
| China AI + manufacturing implementation | 2026-01-09 | Action plan | [National Data Administration](https://www.nda.gov.cn/sjj/zwgk/zcfb/0112/20260107214358696030895_pc.html) |
| China AI + healthcare implementation | 2025-11-04 | Issued guidance, explicitly older | [Government portal](https://www.gov.cn/zhengce/zhengceku/202511/content_7047018.htm) |
| US AI legislative framework | 2026-03-20 | Legislative recommendations, proposed | [White House](https://www.whitehouse.gov/releases/2026/03/president-donald-j-trump-unveils-national-ai-legislative-framework/) |
| US semiconductor R&D letters of intent | 2026-07-29 | Proposed incentives, pending final approval | [NIST](https://www.nist.gov/news-events/news/2026/07/department-commerce-announces-letters-intent-7-companies-874-million) |
| US CHIPS implementation audit | 2026-08-06 | Implementation review, not a new grant | [GAO](https://files.gao.gov/reports/GAO-26-109121/index.html) |
| US cyber workforce cooperative agreements | 2026-09-18 | Implementation / awards announcement | [NIST](https://www.nist.gov/news-events/news/2026/09/nist-awards-more-17-million-support-cybersecurity-workforce-development) |
| New York rural health coordination and training | 2026-09-04 | State-specific implementation | [CMS](https://www.cms.gov/newsroom/press-releases/trump-administration-announces-76-million-strengthen-regional-coordination-modernize-healthcare) |
| Louisiana rural healthcare workforce | 2026-10-09 | State-specific implementation | [CMS](https://www.cms.gov/newsroom/press-releases/trump-administration-announces-37-7-million-train-recruit-more-rural-healthcare-workers-across) |
| Delaware early-career rural physicians | 2026-10-14 | State-specific implementation | [CMS](https://www.cms.gov/newsroom/press-releases/trump-administration-announces-new-funding-support-early-career-physicians-who-choose-work-rural) |

Date distinctions were checked against original metadata/text: China's manufacturing document was signed on 2025-12-25 but published on the NDA page on 2026-01-09. The education plan was signed April 2 but the government portal first published April 10. The employment plan was signed June 11 and published June 17. The 2025 healthcare guidance remains labeled 2025 and is not advertised as new 2026 news.

The NIST chip announcement explicitly requires further diligence and approval before final awards. The White House legislative framework calls on Congress and is not represented as already enacted law. The GAO report discusses delayed milestones rather than guaranteeing a new expansion. Delaware's program includes a five-year rural-practice commitment and a minimum share of practice serving qualified rural areas; location, training-stage eligibility and service obligations matter. These distinctions remain in the card constraints.

`现行文件` is used to distinguish an issued guidance document from a proposal in this selection. This project has not performed a comprehensive legal-validity or litigation search across every jurisdiction; users must follow the linked authority for current applicability. No card promises eligibility, funding receipt, hiring or occupational-license recognition.

## Genuine discovery performed

This research did not only re-fetch a fixed list. The CMS September 4 source linked newer related releases; those links led to the October 14 Delaware and October 9 Louisiana pages, whose original government text was read and reviewed. The actual collector also fetched NIST's latest-news list, discovered the September 18 cybersecurity workforce release, retrieved its original article, then the editor reviewed and added that article to the curated seed set. It was not automatically interpreted as a policy benefit.

Runtime discovery checks five official list pages: the China government latest-policy list, CAC policy list, NIST news, CMS press releases and White House releases. It considers bounded matching article links and retrieves up to six new candidates. Candidate titles and original publication dates that can be read are stored in `discovered` with `status: 待核实`, clearly excluded from policy cards and scores until someone reviews the full text, stage, scope and implications. Discovery is limited and may miss pages; successful access to a list does not prove that no newer policy exists.

Actual network outcome during the first full refresh: government portal, CAC's reviewed article, NDA, White House, NIST and GAO article requests succeeded. CMS article/list curl requests returned 403; those three cards use the official original text read through the research browser and retain `reviewed-cache`/`cached` verification status. The initially configured CAC list returned 404, so its discovery source is marked unavailable. The NHC direct article returned 412 during research, but its government-portal copy was fetched successfully and is the card's cited URL. These failures are surfaced, not relabeled as live success. Exact current request status/error/attempt/success times are in `web/data/policies.json`.

## API and data behavior

```python
from pipeline.policy import refresh
updated = refresh(previous=None, now=None)
# Returns {checkedAt, items, sources, discovered, scope}; it does not write files.
# `previous` may be the prior parsed policies.json.
# `now` optionally accepts an ISO UTC-offset timestamp, e.g. 2026-10-16T00:00:00+00:00.
```

Run `python3 -m pipeline.policy` to refresh and atomically persist `web/data/policies.json`. The parent collector can call `refresh(previous, now)` and persist the returned dictionary on its existing schedule. This module does not edit observations, the catalog, application code, build logic or scoring.

`content/policy-seeds.json` contains reviewed extractions and list sources. Curated item refresh requires an official HTTPS domain, the reviewed original title, the original publication date, and the short evidence quote to match. Publication metadata is preferred over visible text; modified timestamps are not substituted. Missing/future publication dates, changed titles/dates and absent quotes fail verification and retain previous reviewed material without advancing its `verifiedAt` or source `lastSuccess`. Source `lastAttempt` and top-level `checkedAt` describe attempts only. A failed first automated request falls back to the separately reviewed seed; it is marked reviewed, not an automated success.

Successful checks receive `verificationStatus: http-verified` and a body SHA-256. Failed checks retain `reviewed-cache` (reviewed seed) or `cached` (previous item); source records also expose the error. Original source text is treated as data and never executed as a skill or model instruction. There is no remote summarization, paid API, invented quote or automatically generated policy inference.

The module keeps policy stage (`status`, Chinese labels) separate from retrieval status (`verificationStatus` on items and `status` on source records). Applications should show both publication date and retrieval state; never call a cached older item “刚刚发布” merely because checkedAt changed.

## Verification

`tests/test_policy.py` tests original versus modified dates, future/missing/nonofficial-source rejection, evidence-quote matching, preserving dates and cached statuses after failure, valid catalog mappings, quote length, and bounded official discovery. The first test run failed because the module was absent; the implementation then passed all six focused tests. Actual network refresh was run separately and exposed the access failures listed above. Production UI behavior and deployment are outside this independent module task.

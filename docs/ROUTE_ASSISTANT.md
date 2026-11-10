# 路线助手 (career route assistant)

Author: Leon Wang. Release 0.2.1. Code: [`web/route.js`](../web/route.js). Tests: [`tests/route.test.mjs`](../tests/route.test.mjs).

The assistant answers a visitor's own Chinese (or simple English) question about routes between majors, roles and industries. It runs in the browser with **no language model**: a rule planner reads the question, writes a plan of tool calls, and runs pure functions over the published catalog and statistics. The answer shows the plan and every tool call.

## Try it

- **Live page.** Enter the atlas, then **路线助手** in the top bar. Ask anything; open **规划与工具轨迹** under an answer to see the plan. On a major page, "这个专业…" refers to that major.
- **Command line, same code path as the page.**
  ```bash
  node scripts/route-probe.mjs "我学会计，想转数据分析要补什么"
  node scripts/route-probe.mjs --region US "数据科学家工资多少"
  node scripts/route-probe.mjs --major accounting "这个专业毕业去哪些行业，起薪数据有官方来源吗"
  node scripts/route-eval.mjs evals/route/blind_v1.json --out /tmp/run.json   # a whole set
  ```

## How it works

1. **Resolve entities.** Every candidate name (major, role, industry, including everyday aliases and a few English names) competes for its span; the longest wins, and a word phrased as a major ("学会计", "会计专业") counts as a major, otherwise as a role ("做会计"). Job nouns the catalog does not cover ("区块链工程师") are kept and reported as missing.
2. **Plan.** Cue words are read with entity names blanked out, so "数据" in 数据科学家 is not a statistics request. The 12 KB intent classifier ([INTENT_MODEL.md](INTENT_MODEL.md)) is one signal; its label and margin appear in the trace. The planner picks one goal and its steps:

   | Goal | Tools |
   |---|---|
   | 转方向要补什么 | `major_routes`, `major_guide`, `skill_gap` (per target), `multi_trail`, `role_profile`, `wage_stat` if pay is asked |
   | 专业去向 | `major_routes`, `major_guide`, `graduate_outcomes` (filtered to a named covered university) |
   | 官方统计 | `wage_stat` (NBS sector average in China; BLS SOC proxy in the US), `macro_lookup` (NBS latest; FRED monthly and World Bank annual for the US) |
   | 相邻岗位 | `adjacent_trail` |
   | 行业里的岗位 | `industry_map` |
   | 岗位比较 / 入门与资格 | `role_profile` |
   | 公共部门入口 | `public_paths` |
   | 资料检索 | `catalog_answer`: the earlier topic router ([advisor.js](../web/advisor.js)) for policies, recruitment conditions and company types, with role sections the question did not name dropped |
   | 数据回答不了 / 需要补充信息 | gap rules only, plus what can be checked instead |

3. **Execute and compose.** Tools return data, never prose with numbers in it. The composer renders each number from a typed fact: value, unit, statistical period, source title and the date it was published or last collected, e.g. `〔[1] 国家统计局：城镇单位行业工资，统计期 2025 年，最近成功采集 2026-11-09〕`.

## Rules the answers keep

- **No number without a source and date.** In route-tool answers every number carries its inline citation (source, period, date). 资料检索 answers quote the earlier router's text; their source list carries each record's date. Tests fail if a statistics item lacks its citation, if any source in a retrieval answer has no date, or if any number in any answer does not already exist in the published data files.
- **China and the US are never compared.** A question naming both gets each region's figures in separate blocks with a note that the measures differ (sector average versus occupation median) and cannot be compared or converted.
- **Caveats survive.** China wages are labelled 行业均值 for the whole NBS sector, with the catalog industries that share the sector; US wages name the SOC occupation as a broad proxy, "not a starting wage", and openings "include replacement demand". China and US figures are never compared or converted.
- **Approximate names are said to be approximate.** "数据分析" is not a catalog title; the answer says so and names the closest entries (数据科学家, 统计师, 市场研究分析员).
- **Gaps instead of guesses.** Starting salary, admission/hiring odds and score lines, school-background advantage, working hours, a named employer's pay, forecasts, personal fit, rankings, city pay, match rate, 保研率/考研成功率, and time to first job each return a named gap with the reason and what does exist. A starting-salary, employer or city pay question gets no wage number at all.
- **Off-target is worse than not found.** A role, major or university the data does not cover is named as missing; another school's numbers are not shown in its place. Words inside a university's name (师范 in 湖北师范大学) never name a major, and retrieval sections about majors or roles the question did not name are dropped.
- The optional Qwen model (click to load, [MODEL_CARD.md](MODEL_CARD.md)) only re-selects excerpts for 资料检索 answers. Route answers are fully deterministic.

## Evaluation

**Blind set.** `evals/route/blind_v1.json`: 48 questions (32 answer, 16 must-not-answer, 9 on the US layer), written by Claude Sonnet 5.5 from [a public brief](../evals/route/blind_v1_brief.md) and [a name inventory](../evals/route/blind_v1_inventory.md) only, without code or rules. Committed in `03d26f7`, before any assistant code.

**First run, on `3c85af3`** (run file `evals/route/runs/blind_v1-3c85af3.json`, hand grades with rubric in `evals/route/blind_v1_grades.json`, graded before any change):

| Subset | Correct | Partial | Wrong | Abstained |
|---|---:|---:|---:|---:|
| Answer (32) | 18 | 6 | 3 | 5 |
| Must-not-answer (16) | 9 | 5 | 0 | 2 |
| All (48) | 27 | 11 | 3 | 7 |

No must-not-answer case stated a forbidden figure on this set. The three wrong answers were all answer cases: two adjacency questions answered with entry details (off-target), and one role comparison where "数据" inside 数据科学家 triggered a statistics lookup and printed sector wages the case forbade.

Failure classes in the 21 non-correct cases: English names (5), missing gap rules or decline wording (5), multi-entity questions answered for one entity (3), adjacency wordings (2), transfer start/target split (2), US public-sector wording (2), cue words inside entity names (1), a named role versus the public-sector topic (1).

**After fixes, on `cd933dd`** (`evals/route/runs/blind_v1-cd933dd.json`): re-graded by the same hand, all 48 cases meet the rubric. **This is not a blind result**: the fixes were made against this set, so it shows only that the failure classes above are closed. Each fix has a test with new wording that fails on `3c85af3` and passes after.

**Coverage tests.** Every topic the page says it handles, and every gap rule, has a plain and a colloquial wording in `tests/route.test.mjs` (20 topic cases and 24 gap cases), plus tests for number provenance, caveat survival, entity resolution and the trace. Tests that need a specific live series (for example a BLS occupation line or an NBS indicator) skip instead of failing if the 6-hourly refresh ever drops it, so a feed change cannot block a deploy; the provenance test reads whatever data is present.

**Read-only review of `09aca34`.** A second model (Fable) asked about 45 questions of its own through the same code path. It found two P0s (师范 in a university name taken as the major; "工资差多少" planned as a transfer) and five P1s (China and US named together answered for one silently; a comparison dropping the second named role; retrieval answers with undated sources; 统计学/生物/医学 not resolved; another major's research leading an answer). Each was reproduced, fixed and pinned by a test that fails on `09aca34`; see the CHANGELOG. No second review round was run. A further probe by the author fixed four more gaps (bare 测试/开发, a target that is already one of the major's routes, a university named without a major, roles plus wages for one industry).

## Limits

- A rule planner covers the wordings it has been taught. New phrasings can still fall to 需要补充信息 or to the catalog-retrieval route; the next blind set should measure that.
- Skill overlap is a shared-word heuristic over short catalog phrases; it can mark a weak overlap as "相近" (for example 追踪 in 追踪不良 and 评测与追踪).
- Adjacent roles and skills are the catalog's editorial research, not measured transitions.
- English support is a short alias list for US-layer majors and roles, not general English understanding.

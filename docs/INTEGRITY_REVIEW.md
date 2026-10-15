# Independent integrity review

Read-only review of implementation and data on 2026-10-15. Only this review file was written. Focus: source parsing, collection/build, scoring, retrieval and app actions; excludes CSS and model runtime internals. Line numbers refer to the reviewed snapshot and may shift after fixes.

## Actionable findings

### P2 — Clearing the final comparison leaves buttons visibly selected

`web/app.js:41` returns immediately when `state.compare` is empty, before resetting each `[data-compare]` button's label and `aria-pressed`. Reproduce: add one role and click it again, or click “清空”. The bar disappears but that role retains “已选 ✓” and `aria-pressed=true` until another render. Move button synchronization before the early return. Validate single deselection and clearing several selections.

### P2 — A major deep link traps later major filter interactions

`web/app.js:33` always reapplies the major in `location.hash` whenever rendering under `#major=...`. `web/app.js:54` changes `state.major` then renders without updating that hash. Reproduce: open an assistant major evidence link (`#major=computer` or any existing major ID), then choose a different major or “全部专业”; render restores the deep-linked major. The category change at line 55 can similarly restore a major outside the selected category. Normalize the hash to `#careers` after consuming the deep link, or synchronize the hash with filter choices.

### P2 — A partial World Bank response silently deletes the other country's retained series

`pipeline/sources.py:65–74` accepts the response if *either* CN or US has data, while `pipeline/collect.py:25` replaces the entire prior value on parser success. A valid-shaped API response containing only USA rows changes a formerly populated China series to an empty list and marks the source `ok`; it bypasses the promised retain-on-failure path. Require observations for both requested countries, or merge countries separately while preserving their own dates/status. A synthetic `[{}, [{countryiso3code: 'USA', date: '2025', value: 1}]]` demonstrates acceptance of a one-country response. Current snapshots have both countries; this is a refresh integrity issue.

### P3 — Retrieval methodology citation does not resolve to the intended document

`web/retrieval.js:79` publishes `./docs/CATALOG.md`, but `web/app.js:46–47` passes non-hash URLs to `safeURL` (line 7), which accepts only HTTPS and rewrites this relative path to `#sources`. The link is then marked external and opens the source page in a new tab, rather than the cited methodology file. Use a deployed absolute HTTPS document URL or an intentional `#sources` internal citation and matching internal-link behavior.

### P3 — Overview shows China-specific wage commentary while United States is selected

`web/app.js:25` always renders the “信息技术私营单位年均工资…元” insight from NBS in the US overview. The figure remains Chinese and uses yuan, but its country is implicit while the page selector reads United States. Explicitly label it “中国大陆” or render a region-specific insight. It is currently easy to read it as background for the selected country.

## Verified behavior and limits

- Catalog counts are 26 industries, 111 roles, 44 major families; 17 configured observations sources.
- All 16 available `content/raw/*.gz` hashes match their corresponding observation hashes. BLS uses `content/bls-extract.txt` rather than a raw gzip; its extraction hash also matches. Its source is explicitly cached/reviewed, not a successful current HTTP fetch.
- Current BLS period is 2025–2035, wage year 2025; NBS wage year is 2025. US monthly employment series are recorded in thousands, UNRATE in percent; BLS occupational openings/employment are converted from thousands to people.
- China public administration lacks a private-unit wage match and remains missing; there is no opportunistic nonprivate substitution. Unmatched US SOC fields remain missing. All mapped SOC records currently resolve to detailed line items.
- `with_failure` deep-copies previous data and retains last success/hash/value while changing attempted time and status. Collection does not refresh old observation timestamps during offline mode.
- Score missingness uses null and valid-weight renormalization; 30 percentage points of editorial judgment are explicitly distinguished. Profit quality remains missing. Scores are framed as exploratory and are not represented as income/selection probabilities. Country score comparability is explicitly disclaimed.
- Retrieval keeps countries separate; system instructions treat evidence as untrusted data, bound input lengths, disallow guessed numbers and require dates/scopes. Model answers remain generative and programmatic evidence links are retrieval evidence, not proof that each generated sentence is supported. The 480-character snippet limit may omit tail-end editorial rationale/review metadata, so it should not be described as supplying every field.
- Chat text is rendered through textContent; evidence titles/URLs are escaped; external source URLs are HTTPS-restricted. No remote inference service appears in the reviewed app/retrieval path. This review does not establish browser network privacy beyond these files or model internals.
- All 14 Python unit tests passed. Node CLI was absent from this shell PATH, so JS suites were not rerun in this independent pass. No fresh network collection or production-browser interaction was performed.

## Resolution review — 2026-10-15, pre-publication follow-up

All five original findings are resolved in the current source:

1. Comparison controls: `web/app.js:42` now synchronizes all button labels/ARIA values even with an empty selection; no early return remains.
2. Major links: `web/app.js:34` consumes the major deep link with `history.replaceState(..., '#careers')` before rerendering, so later filter choices are no longer overridden.
3. Partial World Bank refresh: `pipeline/collect.py:25` requires both CN and US series before success/replacement. A one-country result now enters the old-value retention path. Keeping this guard at the collection boundary also prevents the prior complete snapshot from being replaced.
4. Methodology link: `web/retrieval.js:79` now emits `#sources`, which follows the internal evidence-navigation path in app.js.
5. Cross-country insight: `web/app.js:27` now explicitly labels the retained wage commentary as Chinese data.

The 15 Python unit tests pass in this independent follow-up. Parent-reported browser reproductions and model smoke tests were not independently rerun here.

### Grounded model response design

`web/grounded.js:15–22` constrains model output to JSON containing a nonempty array of known integer evidence IDs, then validates it locally and returns the corresponding original objects. Extra fields, unknown IDs, non-integer IDs, malformed JSON and overlong selections are rejected. Duplicates are harmlessly deduplicated. `web/app.js:53` publishes literal text from selected local evidence with programmatic citation IDs; it does not publish model-produced factual prose, nor stream raw model tokens into the answer. A failed selection falls back to original retrieval text. This materially closes the earlier generative unsupported-claim path. Evidence instructions can at most affect selection among allowed snippets, not inject a generated factual answer through this code path.

No release-blocking issue found in this design. Remaining limits: the model can choose irrelevant allowed snippets; comparative coverage is instructed but not guaranteed by local validation; excerpts are limited to 145 characters and can omit later qualifications/source-state text. These are selection/completeness limits, not evidence of invented displayed claims. Treat returned material as selected excerpts, never as a comprehensive answer or independently verified fact. The new UI label (“证据筛选与整理”) correctly reflects that scope.

### Publication workflow

Reviewed `.github/workflows/publish.yml`: scheduled/manual collection retains fallback state; tests and build gate deployment; downloaded model artifacts are checked by `scripts/verify-model.py` before upload; Pages deployment is serialized and uses the GitHub Pages environment. No glaring publication blocker found by static inspection. The manual data commit occurs before model download/deployment, so a later deployment failure can leave the repository's data ahead of the live site; this is observable run state, not evidence that the site deployed. Completion should still be based on the actual successful Pages deployment and live checks. Model file hash verification claims and real WebGPU model behavior remain the parent agent's separately collected evidence.

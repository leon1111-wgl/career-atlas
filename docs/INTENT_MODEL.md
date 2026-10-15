# Browser career-question intent classifier

This project trains a small Chinese question classifier. It is a local intent-routing component, usable before a Qwen model is downloaded. It is **not a self-trained large language model**. It emits an intent label and an uncalibrated routing margin; it does not generate facts, predict employability, score people or assess personality.

## Data and reproducible training

- `content/intent-training.json`: 192 original, manually authored Chinese questions, 24 per intent.
- `content/intent-eval.json`: 64 separately authored held-out questions, 8 per intent. These are distinct sentences, not a randomized split or automated substitutions into the same question template. Same domain and common terminology inevitably overlap.
- Eight classes: compare, entry, salary, prospects, fit, work, company, public. `general` is an abstention route, not a learned ninth class.
- `scripts/train-intent.py` uses only the Python standard library. Reproduce with `python3 scripts/train-intent.py`; verify byte-identical output and evaluation with `python3 scripts/train-intent.py --check`.
- Seed/version marker: 20261015. Training is fully deterministic: no random initialization, sampling or data shuffle. Sorted feature selection and tie-breaking make the seed informational rather than a source of randomness.
- Input normalization lowercases Latin characters, retains basic Chinese/ASCII alphanumerics, removes punctuation, and limits input to 500 normalized characters. Presence features are character bigrams/trigrams. Class-wise chi-square rankings over training document counts choose up to 600 features, requiring at least two training questions in a class. This corpus yields 226 features.
- The classifier learns multinomial naive Bayes log likelihoods with additive smoothing alpha=0.5 and equal class priors (balanced data). Per-feature log weights are centered across classes and quantized to integers at scale 1000. Centering does not change class ranking. This is trained feature weighting, not a hand-written keyword/intent mapping.
- Model: `web/intent-model.json`, 12,185 UTF-8 bytes at this version. Its small size is below the approximately 30KB target and the 100KB ceiling. It includes training/evaluation hashes and aggregate evaluation metadata; full question-level errors and confusion counts are in the evaluation file.

Hyperparameters and fallback were chosen as a compact conservative baseline, before reading the initial held-out results. The currently reported set has now been inspected and is a development benchmark, not an untouched future confirmation set. No subsequent optimization was performed to improve its score. Fresh externally authored questions are required before making generalization claims or tuning on this benchmark.

## Inference contract

```js
import {classifyIntent, intentLabels} from './intent.js';
const model = await fetch(new URL('./intent-model.json', import.meta.url))
  .then(response => { if (!response.ok) throw new Error('intent model unavailable'); return response.json(); });
const result = classifyIntent('零基础如何入门', model);
// {intent: 'entry', score: <routing margin>, matched: <feature count>}
```

The parent application owns asynchronous loading and should continue general retrieval if the request fails. `classifyIntent(question, null)` also returns general. The classifier itself makes no network requests and writes no storage. Questions need not leave the device. Adding this module does not independently prove privacy of the entire application.

For each matched feature, sum the learned eight class weights. Let `margin = (highestScore - secondHighestScore) / matchedFeatureCount`. Returned `score = margin / (1 + margin)`, rounded to four decimals. This maps a nonnegative separation to a bounded diagnostic value; **it is not a probability, confidence calibration, accuracy estimate or person's career fit**. `matched` counts distinct matched n-gram features, including overlapping grams.

Route to general if fewer than two learned features match, or raw margin is below 0.12. This raw threshold corresponds to a returned score around 0.1071; thresholds use the raw value. Unknown or unavailable model inputs return general. A high margin can still be wrong. For compound questions this is a single-label first route, not an exhaustive intent parser; preserve the original query and keep retrieval broad. Never use routing to hide required qualification information or authorize a factual claim.

## Observed held-out results

| Measure | Result |
| --- | ---: |
| Correct labels / all held-out questions | 43 / 64 (67.19%) |
| Accepted specific routes | 48 / 64 (75.00%) |
| Correct labels / accepted routes | 43 / 48 (89.58%) |
| General fallback | 16 / 64 (25.00%) |
| Wrong accepted routes | 5 / 64 (7.81%) |

Abstention is counted as incorrect in the full-set accuracy. Accepted-only accuracy is not the full accuracy and must not be advertised alone.

| True intent | Correct / 8 | General fallback | Wrong accepted destinations |
| --- | ---: | ---: | --- |
| compare | 3 | 3 | work: 2 |
| entry | 7 | 0 | salary: 1 |
| salary | 5 | 2 | company: 1 |
| prospects | 3 | 5 | none |
| fit | 8 | 0 | none |
| work | 5 | 2 | compare: 1 |
| company | 6 | 2 | none |
| public | 6 | 2 | none |

Compare/work ambiguity and low recall for trend questions are clear weaknesses. For example, “同为技术岗，研究与交付之间怎么取舍” was misrouted to work, and “老师的基本工资之外有哪些绩效构成” to company. Even a correct intent does not mean the retrieval result or underlying career advice is correct.

## Verification and deployment scope

`tests/intent.test.mjs` tests unavailable/empty/irrelevant inputs, representative classes, compound-query bounds, corpus disjointness/counts, model size, byte-for-byte training reproduction, and JS/Python parity for all 64 held-out inferences. The first run failed because the implementation did not exist; the implementation then passed. The unrelated-question cases are software regression cases, not a measured out-of-domain benchmark. No claim of robustness to adversarial text, all Chinese dialects, English questions or demographic fairness has been established.

The app loads this artifact asynchronously and uses `web/advisor.js` to choose the reading order of attributed catalog sections. If loading fails, general retrieval remains available. Explicit salary, comparison, public-route and macro-data requests have additional deterministic coverage rules; an abstained company query can use a narrow fallback rule. These rules do not change the classifier benchmark above. Answers retain region-specific qualifications and statistical periods; the optional Qwen selector can add validated excerpts without replacing the structured source answer. Keep general retrieval available, show the route as a hint if shown at all, and do not label the margin “匹配概率” or “适合程度”. Qwen and this classifier have different roles and independent limitations.

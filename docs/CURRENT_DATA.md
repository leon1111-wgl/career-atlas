# Current China macro indicators

Author: Leon Wang

The homepage can now use `sources['cn-current'].value.indicators` instead of presenting annual World Bank observations as current monthly conditions. These statistics provide economic context, not personal employment forecasts. Annual occupational wages and long-run history remain separately labeled.

## What was actually verified

As of 2026-10-16 Asia/Taipei, the following NBS national pages were retrieved over HTTPS and the displayed values/periods checked. No third-quarter GDP or September activity data was inferred from an unpublished release. Each indicator keeps its own observation period and publication date; current does not mean all indicators belong to one month.

| ID | Current value | Period | Meaning | Publication |
| --- | ---: | --- | --- | --- |
| gdp | 4.7% | 2026年上半年 | Cumulative real GDP YoY, preliminary estimate | 2026-07-16 |
| unemployment | 5.3% | 2026-08 | National urban surveyed unemployment rate, monthly level | 2026-09-15 |
| industrial | 5.2% | 2026-08 | Above-designated-size industrial value added, monthly real YoY | 2026-09-15 |
| retail | 0.4% | 2026-08 | Total retail sales of consumer goods, monthly nominal YoY | 2026-09-15 |
| cpi | 0.9% | 2026-09 | National CPI, monthly YoY | 2026-10-14 |

Primary sources:

- [NBS 2026 Q2 and first-half GDP preliminary accounting table](https://www.stats.gov.cn/sj/zxfb/202607/t20260716_1964142.html): cumulative GDP real growth is 4.7%; single-quarter growth is 4.3%. The displayed headline uses the former, not the latter. GDP current-price level is a different variable and is not used as the growth rate.
- [NBS August economic activity release](https://www.stats.gov.cn/sj/zxfbhjd/202609/t20260915_1965307.html): August unemployment is 5.3%, distinct from January–August average 5.2%; industrial monthly real YoY is 5.2%, distinct from its monthly change.
- [NBS January–August retail release](https://www.stats.gov.cn/sj/zxfb/202609/t20260915_1965311.html): August retail nominal YoY is 0.4%; January–August cumulative YoY is 1.1%. Broader goods-and-services retail statistics are another measure and are not substituted.
- [NBS September CPI release](https://www.stats.gov.cn/sj/zxfbhjd/202610/t20261014_1965477.html): September YoY is 0.9%; MoM is 0.2%. The headline uses YoY.
- [NBS June/first-half activity release](https://www.stats.gov.cn/sj/zxfbhjd/202607/t20260715_1964121.html) and [July activity release](https://www.stats.gov.cn/sj/zxfb/202608/t20260817_1965056.html) supply comparable monthly historical points.

Monthly historical points genuinely extracted from these national articles:

| Period | Unemployment level % | Industrial real YoY % | Retail nominal YoY % | CPI YoY % |
| --- | ---: | ---: | ---: | ---: |
| 2026-06 | 5.0 | 5.3 | 1.0 | 1.0 |
| 2026-07 | 5.2 | 4.5 | 0.6 | 0.5 |
| 2026-08 | 5.3 | 5.2 | 0.4 | 0.8 |
| 2026-09 | not collected/published here | not collected/published here | not collected/published here | 0.9 |

No blank cells are interpolated. Monthly series have three or four actual points. GDP has only one verified cumulative point in this collection: `series` stays empty until at least three actual points exist; `history` preserves sparse original observations for future accumulation. A cumulative GDP sequence is not a sequence of single-quarter growth rates and must retain its label if plotted later. Historical observations may be revised by NBS.

## Collection and fallback

`pipeline/current.py` parses only exact supported clauses and the preliminary GDP table. It rejects non-national NBS URLs, missing publication timestamps, future publication dates and future observation months. Monthly matching excludes the trailing month of cumulative expressions such as `1—8月份`; signs are retained. Title year handling prevents a December observation published in January from silently becoming the wrong year.

`pipeline/collect.py` invokes the current-indicator collector during its existing run, after the NBS latest-release list is available. The existing six-hour workflow therefore automatically includes this source without a separate scheduler. It checks the verified source URLs plus relevant official latest-release links (up to 20 bounded requests), including economic-run releases, CPI, industrial production, retail and preliminary GDP accounting. There is no paid API, model-generated statistics or search-result scraping at runtime.

For every field, `observationDate` orders statistical periods; `publishedAt` orders revisions within a period. Older discovered articles can add genuine historical points but cannot replace the current value with an older period. Each series point retains its own URL/publication date. First-party HTML response bundles are stored by the existing `save_raw` mechanism at `content/raw/cn-current.gz`, with their SHA-256 on the observation source. These are raw-response evidence, not a substitute for retaining the per-point scope.

`content/cn-current-seed.json` is an explicitly reviewed initial snapshot, built from successful original-page retrieval and manual checking. Its verification time is the actual local retrieval time; source publication dates are separately preserved. If live extraction fails, retained data is marked cached, and previous `lastSuccess` is preserved. With no previous record the reviewed seed is retained as reviewed. If only some current-indicator source URLs are successfully retrieved, the composite remains cached and lists request errors; it does not advertise a full current refresh. HTTP retrieval success does not advance the observation period.

The most recent actual full collection completed with cn-current `ok`; BLS remained cached following HTTP 403, which is independent of the successfully refreshed current-China source. A deployment still requires its own workflow and live-site verification.

## Report and tests

`pipeline/build.py` now signs the generated Chinese briefing “作者：Leon Wang” and adds a latest monthly/quarterly chapter before the annual historical context. It prints each period, publication date, unit, change definition and direct NBS citation. It does not replace occupational wage years with 2026 placeholders.

`tests/test_current.py` covers monthly versus cumulative/MoM parsing, negative CPI signs, future dates, year-boundary handling, cumulative GDP table selection, monotonic merging, seed provenance and failure retention. The tests were run against a missing implementation first, then passed with the implementation. The complete Python suite also passed before actual collection. These are parser/fallback checks; they do not establish that a source will never change its HTML layout.

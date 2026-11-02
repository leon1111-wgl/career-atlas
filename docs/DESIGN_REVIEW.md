# Career Atlas interface review

## 2026-11-02: the topographic atlas

This pass replaces the recruitment-portal layout with an atlas you open. The data, scoring, retrieval and intent model are unchanged, and every evidence boundary keeps its meaning (a few sentences were shortened); only the interface, routing and chart styling moved.

**Structure.** A cover page comes first:
- the pitch;
- a "start from my major" trailhead;
- the current official indicators;
- the industry map, with a legend.

"进入图册" opens a console with six sections: 总览, 行业, 岗位, 专业, 路线, 数据. Industries, roles and majors are now full pages with their own URLs (`#/industry/power`, `#/role/nurse`, `#/major/cs`). Only the role comparison is still a dialog. Old links keep working: `#overview`, `#careers`, `#match`, `#reports`, `#sources`, `#public`, `#role=…`, `#industry=…`, `#major=…`.

**Motif and signature interaction.** The 26 industries sit on a contour map as waypoints inside eight regions, with a graticule whose grid references (A–H, 1–5) reappear on industry pages and in the industry directory.
- Choosing a major draws dashed trails from "you are here" to every industry where the catalogue links that major to a role, with a role count on each waypoint.
- Hover or focus shows a callout.
- Map positions are layout only, as the legend says; trails are catalogue links, not admission or hiring odds.

The same trail language runs through the console:
- dashed trail underline on the active tab;
- industry value chains as a waypoint trail;
- a role's adjacent directions as a short trail.

**Palette.** Light first, on warm map paper `#f6f4ee` with white panels, survey-ink navy `#1d2a3a` and the trail orange `#c0521d` (`#a3441a` for text on paper) for actions and routes. The survey blue `#2a5d91` is used for links and charts. The night map is `#14171c` with trail `#f0874f` and survey `#8db6e3`. Eight muted region hues are used only as map fills and swatches, never as text or backgrounds. This keeps the blue-and-orange family chosen earlier for this project and the earlier removal of teal and sage washes. It stays clear of the other portfolio projects' palettes.

**Charts.** Charts take their colours from CSS variables, so they follow the theme. Graduate-outcome tables became share bars:
- rates are scaled to 100%;
- occupation distributions are scaled to their largest share;
- undisclosed values stay visibly "未披露".

**Checks.** Rendered locally in the browser pane and in headless Chrome:
- **Sizes:** 1360px and 1440px light, 1440px dark, and 375px/390px phones.
- **Phone layout:** no page-level horizontal overflow at 375px; the map scrolls inside its frame.
- **Console:** no console errors.
- **Consultation:** the default consultation flow answered with evidence links.

All 48 Python tests and 63 Node tests pass. Screenshots are in `docs/screenshots/`. No model weights were loaded.

## Earlier passes (superseded layout)

The current design follows the user's preference for the category-rich structure of mature Chinese recruitment portals. The public interface uses the author name **Leon Wang**. The previous editorial dashboard direction is superseded.

## Structure and typography

A white masthead contains the text brand, horizontal navigation, and a secondary consultation entry. A separate search band makes industry, occupation, and major queries the primary entry point. Content sits in a centered 1200px reading area against a light neutral background. Type is system sans-serif throughout; subpage headings are compact and descriptive.

The homepage provides a compact current-economic-data strip, eight industry groups containing 26 industry links, four text-based subject entries, a single-column occupation list, and a secondary column for official releases and research context. These areas have distinct roles instead of repeating the same oversized card shape.

Occupation rows give priority to the title, actual work, skills, and entry preparation. The exploration score is a small secondary field. A consistent footer provides comparison and detail actions. Industry entries use a compact two-column directory layout on desktop and a single column on phones.

Details use ordinary document sections and tables for work tasks, preparation, company-type differences, statistical context, and sources. The assistant remains optional. Model controls are folded under an explicit settings disclosure rather than dominating the consultation flow.

## Visual system

- White surfaces, a light neutral grey page background, deep blue navigation/links, and restrained orange for the search action. The earlier teal/sage wash was removed following user feedback.
- Thin neutral rules, 3px corners, and no ornamental icons, gradients, glowing effects, card movement, or floating dashboard shadows.
- Stronger title/body text with readable neutral grey source periods and metadata. Statistics use tabular numerals and retain their observation dates.
- Real historical charts with visible axes, units, legends, and captions. Current values distinguish the observation period from the release date.
- Compact table headings, stable row rules, alternating paper tints, and internal horizontal scrolling where full comparison fields require it.

The current palette uses #303640 body text, #666d77 secondary text, #234b75 navigation, #bd521f search, #f5f6f8 page background and white panels. Charts and statistical bars use #6485a9; editorial bars use #b87945, with their legend updated to blue/orange.

## Mobile behaviour

The header navigation opens below the masthead through the existing menu control. Search remains visible. Industry groups use two columns, subject entries use a 2×2 arrangement, occupation content becomes a single reading stack, and the research sidebar follows the main results. The economic strip uses two columns with the fifth item spanning the final row. Professional background selection should use the main agent's native select control rather than 44 always-visible chips.

Phone SVG labels compensate for the fixed chart viewBox so they remain readable after scaling. Native input text is 16px where appropriate. Keyboard focus is visible, reduced-motion preferences are respected, and print styles remove navigation and interactive chrome.

## Evidence boundaries

The site contains occupational research entries, not verified live vacancies. Counts and actions must retain that distinction. Aggregate wage proxies keep their source, region, and observation period; scores keep their method and coverage. Layout does not add recruiter statuses, current openings, fabricated employers, or application actions.

## Rendered QA

The first portal pass was rendered locally in Google Chrome through Playwright at desktop 1440px and mobile 390px widths. Overview, industries, careers, match, reports, and sources were checked at both widths: 12/12 document-width checks matched the viewport; no uncaught JavaScript errors were recorded. Desktop/mobile screenshots are retained in the ignored `qa/designer/` directory as `platform-*.png`, with `platform-results.json` holding the machine-readable results.

Visual inspection covered the homepage, industry directory, occupation library, matching page, reports, source table, expanded mobile navigation, occupation details, consultation, and expanded model settings. Observed issues fixed during that pass included the desktop menu display cascade, Chinese menu text wrapping, brand subtitle wrapping, native title-button borders, sidebar list bullets, intersecting metric padding, and excessive initial-chat whitespace.

The current-economic-data strip and current-indicator chart were then rendered at 1440px and 390px: all four page-width checks matched the viewport, with no uncaught JavaScript errors. The Chinese strip showed five indicators and the report selector offered four chartable indicators. The US two-indicator strip was separately checked at 390px with both items aligned in one row and no document overflow. Mobile charts use a full-width selector above the plot. Source-note spacing was tightened; long US values receive priority over decorative sparklines on narrow screens. Screenshots are named `final-home-*.png` and `final-trends-*.png`, with results in `current-strip-results.json`.

The question “智能体应用工程师在不同公司里工作有什么特点” was also submitted to the default consultation mode at both widths. The rendered structured answer contained three company contexts, two verification questions, and an evidence qualifier. Section spacing, list leading, and source notes were inspected in `final-answer-1440.png` and `final-answer-390.png`. No model weights were loaded; these checks confirm presentation and the exercised retrieval flow, not model inference quality or complete keyboard/screen-reader coverage.

## Neutral palette follow-up (2026-10-16)

Following further user feedback, all sage/green text, borders, tags and tinted panels were changed to neutral greys. Deep blue is restricted mainly to navigation, links and charts, with muted orange on search and the active-nav rule. The six main pages were rendered again at 1440px and 390px: all 12 widths fit and no uncaught JS errors were recorded. Additional rendered checks covered the orange search action and blue/orange score-bar legend in role details at both sizes. Search-button text contrast exceeds 4.5:1. Local evidence: `qa/designer/palette-results.json`, `qa/palette-qa.json`, and `qa/palette-*.png`.

## Reading comfort follow-up (2026-10-16)

This pass changes typography and spacing while retaining the white/grey/blue/orange palette and Leon Wang attribution. It uses three deliberate reading levels rather than enlarging every element equally:

- Long descriptions, research notes, reports, and occupation detail paragraphs: 15px, approximately 1.95 line height.
- Occupation summaries, entry preparation, industry descriptions, and table data: 14px, approximately 1.85–1.9 line height.
- Supporting source periods, labels, controls, score tags, and metadata: generally 12px or larger. SVG axis font units remain adjusted for their scaled viewBox instead of being assigned a misleading literal 12px.

Page headings remain around 23–25px; occupation titles are 18px. Paragraphs have room to breathe, while the industry directory stays comparatively compact. Phone occupation actions occupy a separate line when metadata needs the width. Source tables scroll inside their wrapper at a minimum width that preserves readable source descriptions and complete observation periods.

New research classes (`research-grid`, `research-block`, `source-line`, `policy-list`, `policy-item`, `major-guide`, `score-breakdown`) use the same reading scale and existing borders/backgrounds. They provide document structure without an additional ornamental visual language.

Rendered checks used local Google Chrome through Playwright at 1440px and 390px. All six main routes were loaded at both sizes: 12/12 document widths matched the viewport, and no uncaught JavaScript errors were recorded. Actual screenshots inspected included desktop/mobile homepage, mobile occupations and sources, plus occupation details and consultation/model settings. The first screenshots revealed mobile subtitle wrapping and overly narrow date cells; both were corrected. Evidence: `qa/designer/typography-results.json`, `platform-*.png`, and `platform-detail-*.png`. This typography pass does not change statistics, model behaviour, wording, or scoring.

For the content owner's review, visible implementation terminology can be simplified without obscuring evidence: “方法 v1” → “探索指数怎么算”; “编辑量规” → “研究判断”; “透明匹配” → “按专业和偏好匹配”; “轻量意图识别” → “先查询本站资料”. Technical uncertainty explanations and exact scoring definitions should remain available in a secondary method disclosure. The designer has not edited application text.

# Interface design review

The visual direction is a Chinese career research desk: sage navigation, ivory reading surfaces, clay evidence notes, and clearly visible source metadata. The interface should feel useful during a long comparison session.

## Changes

- Raised body, caption, table, chip, and navigation contrast throughout the application. Main explanatory text is 13–14px; compact metadata is generally 11–12px, with no pale green paragraphs.
- Turned the four headline figures into one divided statistical strip. This distinguishes official measurements from the independent industry exploration cards below.
- Used a restrained 27–36px serif page headline, stronger sans-serif section hierarchy, compact squared controls, and generous paragraph leading.
- Removed floating card movement and ornamental shadows. Industry cards show a clear title, score, explanation, and metadata in that order.
- Styled charts with legible axes, stronger series colours, thin gridlines, and readable source captions. Chart styling does not add any real-time claims.
- Gave data tables stable row rules, alternating paper tints, tabular figures, and readable headings. Wide source/comparison tables scroll inside their own boundary on phones.
- Raised mobile explanatory text to 13px and native form text to 16px. Retained a compact two-column statistics strip, with single-column reading and comparison content below it.
- Preserved all existing selectors and app interactions. Included visible keyboard focus, reduced-motion support, and print overrides.

## Visual QA

Computed text contrast samples using WCAG relative luminance: body 11.09:1; introductory copy 5.17:1; panel metadata 5.10:1; industry paragraphs 5.31:1; table body 6.23:1; evidence notes 5.12:1; primary button 6.53:1. These samples exceed 4.5:1 for normal text, but are not a full accessibility audit.

Rendered with headless Google Chrome through Playwright at `http://localhost:4173` on 2026-10-15. Tested overview, industries, careers, match, reports, and sources at both 1440px and 390px viewport widths. All 12 page-width checks returned document width equal to viewport width. Initial loads reported no uncaught JavaScript errors.

Screenshots are retained locally in `qa/designer/` (ignored QA artifacts), including the industry detail and unloaded assistant dialogs at both widths. Visually inspected desktop overview and sources; mobile overview, careers, match, and reports; and mobile detail/assistant plus desktop assistant. Wide tables intentionally scroll within their wrapper.

The first render exposed excess vertical space around the mobile SVG plot, caused by its fixed height and preserved viewBox ratio. Reduced phone plot height to 160px, kept its period label on a stable width, and reran all 12 page-width checks successfully. Enlarged SVG label units specifically for narrow viewports so the axis labels remain readable when the 670-unit chart scales down.

No model weights were loaded for visual QA. These checks verify layout and readability, not inference quality or keyboard/screen-reader coverage.

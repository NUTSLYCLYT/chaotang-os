# 六部总览全屏展示设计

## Decision

`/liubu` will remove the selected-department state and its `SelectedMinistryRail` overlay. The overview canvas remains the uninterrupted scene surface, and each department card continues to expose its existing direct link to `/liubu/[code]`.

## Component boundary

The change stays within `MinistryOverviewScene` and its CSS module. Data projection, loading/error/empty rendering, route resolution, and department/office scenes remain unchanged. No API, data contract, or business flow changes.

## Interaction and responsive behavior

There is no department selection modal or rail at any viewport width. A card's direct link remains keyboard-accessible and takes the user to that department page. The existing canvas sizing and mobile overflow behavior remain in place; removing the overlay prevents it from obscuring the canvas on both wide and narrow screens.

## Verification

Add a focused regression test asserting that the overview scene has no selected-department overlay or selection button state, while the six department links remain present. Run the focused test, frontend lint/typecheck/test/build, and relevant harness checks.

## Self-review

- Scope is limited to `/liubu` overview presentation.
- The design preserves read-only archive data and ADR 0028 boundaries.
- No visual interaction is left ambiguous: department cards navigate directly; they do not open an overlay.

## Full-screen revision

The overview's primary canvas, not an overlay, fills the entire content area between the persistent 64px top navigation and bottom quick dock. The shared immersive shell receives an opt-in full-width content mode used only by the `/liubu` overview; department and office routes keep their bounded, three-column layout.

The overview removes its outer padding and height cap. Its heading and read-state notices become non-blocking overlays, while the canvas viewport uses the complete remaining content box with no margin. Desktop and narrow screens retain the same persistent top navigation and bottom quick dock; no navigation element is hidden to achieve the larger canvas.

Verification extends the existing visual-source test to prove the overview opts into the full-width shell mode and that the canvas viewport has no fixed `vh` or pixel cap. The frontend lint, typecheck, tests, and build remain required.

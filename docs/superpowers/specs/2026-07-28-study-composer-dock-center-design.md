# 上书房底部输入区置中设计

## Decision

`DevStudyWorkspace` will pass the decree composer as `quickDockCenter` to `ImmersiveCourtShell`. The shared `CourtQuickDock` already defines a three-column layout when that slot exists, placing the composer between 问丞相 and 问钦天监.

## Component boundary

The composer markup remains owned by `DevStudyWorkspace`, because it consumes decree state and callbacks. The shell only forwards the React element to `CourtQuickDock`; the dock continues to own layout and responsive behavior. The standalone in-scene composer is removed.

## Behavior and responsive design

All existing IDs, test IDs, disabled states, `onSubmit`, local-only polish and attachment behavior, and fee notice remain intact. The dock center slot owns the composer’s available width and height. At narrow widths, the established center dock layout keeps the composer compact while adviser secondary copy may be hidden; no element becomes a separate overlapping fixed layer.

## Verification

Tests first assert that the study workspace supplies `quickDockCenter` and that the composer is present within the supplied element rather than directly inside the scene. CSS tests assert the center-slot dimensions and narrow-screen fit. Run focused tests, frontend lint/typecheck/test/build, and relevant harness checks.

## Self-review

- The design does not change any business API or submission behavior.
- The layout responsibility stays in the shared dock; state stays in the study workspace.
- Scope is limited to the requested placement and its responsive safeguards.

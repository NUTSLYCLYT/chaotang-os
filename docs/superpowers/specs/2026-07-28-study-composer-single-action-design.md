# 上书房单一美化输入条设计

The dock-center composer will offer one decree mode only. The `DecreeMode` state, two-button mode switch, and secret-mode placeholder/button branches are removed. The remaining layout keeps a subdued polish control and attachment icon at left, a larger ink-like text field in the center, and one prominent gold 下旨 button at right.

The cost notice stays visible above the composer, and all existing submission state, disabled behavior, callbacks, test IDs, and same-origin POST behavior remain unchanged. CSS will increase contrast, focus affordance, spacing, and button hierarchy while preserving the narrow dock layout.

Tests first assert the absence of 密旨 controls and the presence of a single submit action, then verify the retained controls and responsive stylesheet contract. No API or business-flow changes are included.

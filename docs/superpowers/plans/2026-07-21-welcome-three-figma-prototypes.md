# Three Welcome Ceremonies Figma Prototype Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` to prepare assets and `figma-use` for strictly sequential Figma writes.

**Goal:** Build three clickable welcome ceremonies in Figma—palace gates, imperial seal, and court awakening—using real raster layers plus Figma Prototype Smart Animate, with no CSS and no dependency on Motion-mode-only timelines.

**Architecture:** Each direction has one formal 1440×1024 demo frame. Internal animation states live in an interactive component/variant set on the component asset area. Click actions use `CHANGE_TO` with Smart Animate; timed continuation uses `AFTER_TIMEOUT`. The three formal demo frames remain comparison concepts and do not replace the single production welcome page.

**Tech Stack:** Figma Design, Figma Prototype reactions, Interactive Components, Smart Animate, PNG/WebP raster assets, Noto Serif SC, Noto Sans SC.

## Global Constraints

- No CSS, HTML animation, or whole-image brightness animation.
- Ordinary Figma Present must show every interaction.
- Every direction keeps one formal demo frame; variant states are component resources, not duplicate business pages.
- Primary click target is visible at rest and at least 48px tall.
- All sequences can be skipped and finish in a stable interactive state.
- All imagery is real generated/source raster material; Chinese UI text remains editable Figma text.

---

### Task 1: Prepare Real Layered Assets

**Files:**
- Create: `docs/product/assets/welcome-gate-*`
- Create: `docs/product/assets/welcome-seal-*`
- Create: `docs/product/assets/welcome-court-*`

- [ ] Produce clean scene backgrounds without baked UI.
- [ ] Produce gate door state assets, seal/stamp assets, and court light/fog assets.
- [ ] Inspect every asset for fake text, mismatched lighting, clipping, and composition drift.

### Task 2: Build Palace Gate Ceremony

- [ ] Create the formal comparison frame and matching state components.
- [ ] Wire `上朝` click to door-opening states with Smart Animate.
- [ ] Keep background exposure fixed; animate only door layers, light shaft, fog, title, and action.
- [ ] Wire skip and final navigation.

### Task 3: Build Imperial Seal Ceremony

- [ ] Create the formal comparison frame and five matching state components.
- [ ] Wire click to scroll-unfurl, seal-drop, stamp-impact, and entry-ready states.
- [ ] Keep login and skip available through the sequence.

### Task 4: Build Court Awakening Ceremony

- [ ] Create the formal comparison frame and matching state components.
- [ ] Wire click to real door, lantern, mist, title, and final-action state changes.
- [ ] Stagger environmental lights without presenting them as business workflow nodes.

### Task 5: Independent Acceptance

- [ ] Verify all three in ordinary Figma Present, starting from their default states.
- [ ] Verify one click starts each sequence and repeated clicks cannot restart it.
- [ ] Verify no Motion timeline or generated CSS is required.
- [ ] Verify skip, login, registration/entry links, fonts, bounds, and one-formal-frame naming.
- [ ] Capture final screenshots and report any Figma tooling limitation explicitly.

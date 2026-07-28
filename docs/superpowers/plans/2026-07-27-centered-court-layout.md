# Centered Court Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep migrated court pages centered on ultrawide screens and prevent fixed three-column layouts from clipping before their responsive fallback.

**Architecture:** Preserve the existing shared shell and feature-local CSS ownership. Add source-contract assertions to the four existing owner tests, then make the smallest CSS changes: center the capped shared content and move the three existing fallback media queries to `1280px`.

**Tech Stack:** Next.js, React, TypeScript, CSS Modules, Node.js `node:test`.

## Global Constraints

- Modify only the files listed in this plan plus the approved design/failure records.
- Do not change backend code, API contracts, authentication, content, or interactions.
- Preserve wide-screen three-column definitions and existing mobile breakpoints.
- Use `@media (max-width: 1280px)` for all three fixed-column fallback layouts.
- Do not stage or commit without separate current authorization.
- Preserve unrelated worktree changes owned by other Agents.

---

### Task 1: Add failing layout contracts

**Files:**
- Modify: `frontend/src/features/court-visuals/courtVisuals.test.ts`
- Modify: `frontend/src/features/junjichu-visual/JunjichuScene.test.ts`
- Modify: `frontend/src/features/ministries-visual/ministriesVisual.test.ts`
- Modify: `frontend/src/features/shiguan-visual/ShiguanWorkspace.test.ts`

**Interfaces:**
- Consumes: Existing CSS Module source files loaded with `readFile`.
- Produces: Four source-level regression contracts for centering and safe responsive fallbacks.

- [ ] **Step 1: Assert the capped shared content is centered**

Add after the existing `width: min(100%, 1600px)` assertion:

```ts
assert.match(
  contentRule,
  /margin-inline:\s*auto/,
  "capped court content must remain centered in ultrawide viewports",
);
```

- [ ] **Step 2: Assert the three feature fallbacks activate at 1280px**

Add these feature-local assertions:

```ts
assert.match(
  css,
  /@media \(max-width: 1280px\)[\s\S]*?\.workspace\s*\{[^}]*grid-template-columns:\s*minmax\(240px,\s*\.7fr\)\s+minmax\(480px,\s*1\.3fr\)/,
);
```

```ts
assert.match(
  css,
  /@media \(max-width: 1280px\)[\s\S]*?\.departmentThreeAxis\s*\{[^}]*grid-template-columns:\s*minmax\(240px,\s*\.75fr\)\s+minmax\(480px,\s*1\.25fr\)/,
);
```

Replace the Shiguan `1080px` presence assertion with:

```ts
assert.match(
  css,
  /@media \(max-width: 1280px\)[\s\S]*?\.columns\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(260px,\s*0\.8fr\)/,
);
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run from `frontend/`:

```powershell
node --test src/features/court-visuals/courtVisuals.test.ts src/features/junjichu-visual/JunjichuScene.test.ts src/features/ministries-visual/ministriesVisual.test.ts src/features/shiguan-visual/ShiguanWorkspace.test.ts
```

Expected: four layout assertions fail because the shared rule has no `margin-inline: auto` and the media queries still use `1100px`, `1150px`, and `1080px`. Test loading and unrelated assertions must remain valid.

### Task 2: Apply the minimal CSS fix

**Files:**
- Modify: `frontend/src/features/court-visuals/ImmersiveCourtShell.module.css`
- Modify: `frontend/src/features/junjichu-visual/JunjichuScene.module.css`
- Modify: `frontend/src/features/ministries-visual/ministries.module.css`
- Modify: `frontend/src/features/shiguan-visual/ShiguanWorkspace.module.css`

**Interfaces:**
- Consumes: The Task 1 regression contracts.
- Produces: Centered capped content and safe two-column fallback at `1280px`.

- [ ] **Step 1: Center the shared capped content**

Add to `.content`:

```css
margin-inline: auto;
```

- [ ] **Step 2: Move the three existing fallback queries**

Change only the query values:

```css
@media (max-width: 1280px)
```

in the Junjichu, ministries, and Shiguan CSS Modules. Preserve every declaration inside each query.

- [ ] **Step 3: Run the focused tests and verify GREEN**

Run the Task 1 command again.

Expected: all focused tests pass.

### Task 3: Verify the complete frontend and visible layout

**Files:**
- Verify: all files modified by Tasks 1 and 2
- Verify: `docs/failures/2026-07-27-migrated-court-layout-not-centered.md`

**Interfaces:**
- Consumes: Green focused tests and the running local frontend.
- Produces: Fresh automated and browser evidence.

- [ ] **Step 1: Run automated frontend checks**

Run from `frontend/`:

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

Expected: all commands exit `0`.

- [ ] **Step 2: Run repository failure-record validation**

Run from the repository root:

```powershell
node scripts/check_harness.mjs
```

Expected: the new failure record passes its required-section checks. If the command fails only because of unrelated dirty files, record the exact external failure without modifying those files.

- [ ] **Step 3: Inspect the running UI**

Use the local frontend at `http://127.0.0.1:3000/` and inspect representative migrated pages at an ultrawide viewport above `1600px` and a medium viewport around `1200px`.

Expected: shared content has equal left/right free space; fixed three-column pages use their fallback layout without right-side clipping. Do not create an account or trigger model-backed actions.

- [ ] **Step 4: Independent review**

Ask a read-only review Agent to inspect the final diff for scope, test specificity, preservation of wide/mobile layouts, and unrelated-file contamination.

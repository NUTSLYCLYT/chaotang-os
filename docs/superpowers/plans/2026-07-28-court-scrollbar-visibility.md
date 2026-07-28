# Court Scrollbar Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide visible scrollbars on the ministry department, ministry office, and Grand Council pages while preserving all scrollable content.

**Architecture:** Add a scoped CSS scrollbar-suppression rule to the existing scroll containers only. The rule keeps each container's overflow behavior unchanged, so wheel, touch, keyboard, and programmatic scrolling remain available.

**Tech Stack:** Next.js, React, CSS Modules, TypeScript, node:test.

## Global Constraints

- Do not change decree, evidence, archive, authentication, or routing behavior governed by ADR 0028.
- Do not alter global scrollbar styling or unrelated court pages.
- Preserve overflowing content and its existing scroll behavior; only the scrollbar track and thumb are visually suppressed.

---

### Task 1: Scope scrollbar suppression to ministry department and office pages

**Files:**
- Modify: `frontend/src/features/ministries-visual/ministries.module.css`
- Test: `frontend/src/features/ministries-visual/ministriesVisual.test.ts`

**Interfaces:**
- Consumes: `.departmentWorkspace` as the common wrapper rendered by `DepartmentScene` and `OfficeScene`.
- Produces: hidden visual scrollbar while retaining `overflow-y: auto` behavior supplied by `ImmersiveCourtShell`.

- [ ] **Step 1: Write the failing test**

```ts
assert.match(css, /\.departmentWorkspace\s*\{[\s\S]*?scrollbar-width:\s*none/);
assert.match(css, /\.departmentWorkspace::-webkit-scrollbar\s*\{\s*display:\s*none/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-name-pattern="ministry department and office" src/features/ministries-visual/ministriesVisual.test.ts`

Expected: FAIL because `departmentWorkspace` has no scoped scrollbar suppression.

- [ ] **Step 3: Write minimal implementation**

```css
.departmentWorkspace { scrollbar-width: none; }
.departmentWorkspace::-webkit-scrollbar { display: none; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --test-name-pattern="ministry department and office" src/features/ministries-visual/ministriesVisual.test.ts`

Expected: PASS.

### Task 2: Scope scrollbar suppression to Grand Council page and its scrolling decks

**Files:**
- Modify: `frontend/src/features/junjichu-visual/JunjichuScene.module.css`
- Test: `frontend/src/features/junjichu-visual/JunjichuScene.test.ts`

**Interfaces:**
- Consumes: `.scene`, `.caseDeck`, and `.intelligenceDeck`, the only Grand Council containers declaring vertical or automatic overflow.
- Produces: hidden visual scrollbars without changing their declared overflow values.

- [ ] **Step 1: Write the failing test**

```ts
assert.match(css, /\.scene,\s*\.caseDeck,\s*\.intelligenceDeck\s*\{[\s\S]*?scrollbar-width:\s*none/);
assert.match(css, /\.scene::-webkit-scrollbar,[\s\S]*?\.intelligenceDeck::-webkit-scrollbar\s*\{\s*display:\s*none/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-name-pattern="Grand Council scrollbars" src/features/junjichu-visual/JunjichuScene.test.ts`

Expected: FAIL because no Grand Council scrollbar suppression is declared.

- [ ] **Step 3: Write minimal implementation**

```css
.scene, .caseDeck, .intelligenceDeck { scrollbar-width: none; }
.scene::-webkit-scrollbar, .caseDeck::-webkit-scrollbar, .intelligenceDeck::-webkit-scrollbar { display: none; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --test-name-pattern="Grand Council scrollbars" src/features/junjichu-visual/JunjichuScene.test.ts`

Expected: PASS.

### Task 3: Verify the targeted change

**Files:**
- Verify only.

- [ ] **Step 1: Run focused tests**

Run: `node --test src/features/ministries-visual/ministriesVisual.test.ts src/features/junjichu-visual/JunjichuScene.test.ts`

Expected: PASS.

- [ ] **Step 2: Run frontend quality checks**

Run: `npm run lint && npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Check patch whitespace**

Run: `git diff --check -- frontend/src/features/ministries-visual/ministries.module.css frontend/src/features/ministries-visual/ministriesVisual.test.ts frontend/src/features/junjichu-visual/JunjichuScene.module.css frontend/src/features/junjichu-visual/JunjichuScene.test.ts`

Expected: no output and exit code 0.

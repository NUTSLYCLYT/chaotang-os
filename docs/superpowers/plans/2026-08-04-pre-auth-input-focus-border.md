# Pre-Auth Input Focus Border Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every pre-auth input indicate focus only by changing its own 1px border color.

**Architecture:** Keep all form components unchanged and update the shared `.input:focus-visible` CSS contract. The composed invitation code input inherits the same rule automatically.

**Tech Stack:** CSS Modules, TypeScript, Node.js test runner, Next.js.

## Global Constraints

- Preserve `border-color: #c38b4b` for focused inputs.
- Remove the input outline and outline offset without adding a shadow or pseudo-element ring.
- Do not modify button, link, navigation, React component, authentication, dependency, or ADR 0028 behavior.
- Do not commit without separate user authorization.
- The same final version must pass the complete acceptance workflow 10 consecutive times.

---

### Task 1: Reduce shared input focus styling to the border

**Files:**
- Modify: `frontend/src/features/pre-auth/publicEntry.visual.test.ts`
- Modify: `frontend/src/features/pre-auth/preAuth.module.css`
- Modify: `docs/product/tasks/2026-08-04-pre-auth-input-focus-border.md`

**Interfaces:**
- Consumes: shared `.input` CSS class and `.codeInput { composes: input; }`.
- Produces: `.input:focus-visible` with a gold border and no external outline; no exported API.

- [x] **Step 1: Add the failing CSS contract test**

Extract `.input:focus-visible` and `.button:focus-visible` blocks, then assert:

```ts
const inputFocusRule = extractBlock(authCss, ".input:focus-visible {");
const buttonFocusRule = extractBlock(authCss, ".button:focus-visible {");
assert.match(inputFocusRule, /border-color:\s*#c38b4b\s*;/i);
assert.match(inputFocusRule, /outline:\s*none\s*;/i);
assert.doesNotMatch(inputFocusRule, /outline-offset|box-shadow/);
assert.match(buttonFocusRule, /outline:\s*2px\s+solid\s+#efd7a9\s*;/i);
```

- [x] **Step 2: Run focused test and verify RED**

Run `node --test src/features/pre-auth/publicEntry.visual.test.ts` from `frontend/`.

Expected: FAIL because the input block still declares a 2px outline instead of `outline: none`.

- [x] **Step 3: Make the minimal CSS change**

Use this complete focus block:

```css
.input:focus-visible {
  border-color: #c38b4b;
  outline: none;
}
```

- [x] **Step 4: Run focused test and verify GREEN**

Run `node --test src/features/pre-auth/publicEntry.visual.test.ts` from `frontend/`.

Expected: PASS with 0 failures.

- [x] **Step 5: Self-review and verify**

Inspect the scoped diff, run `git diff --check`, then execute frontend lint, typecheck, full test, build and all repository harness/self-test commands.

- [x] **Step 6: Complete 10 consecutive acceptance rounds**

Each round runs `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, the four documented harness/self-test commands, and `git diff --check`. Record PASS/FAIL and exit codes in the product task; restart after any failure or material change.

- [x] **Step 7: Complete implementation report**

Record the CSS change, TDD RED/GREEN evidence, scoped self-review, 10-round results, unrun checks, and residual risks. Leave product acceptance pending.

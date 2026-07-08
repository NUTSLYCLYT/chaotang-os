---
name: unit-test-write
description: Add focused node/unit tests for changed domain logic or route helpers.
---

# Unit Test Write Skill

## When To Use

- Pure domain logic in `src/core/**`.
- Data normalization and source-label logic.
- Route helper functions.
- Regression assertions for high-risk bugs.

## Rules

- Test the behavior that could regress.
- Prefer existing `*.nodetest.ts` and `*.itest.ts` patterns.
- Avoid broad fixtures when a small table case will prove the boundary.

## Commands

```bash
pnpm test:node
pnpm test:core
node --experimental-strip-types --test path/to/file.nodetest.ts
```

## Output

Write `unit_test/test_plan.md` with test files, cases, and command evidence.

---
name: e2e-test-write
description: Add or update Playwright coverage for browser-visible behavior.
---

# E2E Test Write Skill

## When To Use

- Route navigation.
- User-visible workflow changes.
- Visual state changes that affect trust or decision weight.
- Release-critical smoke paths.

## Rules

- Prefer existing helpers in `e2e/helpers`.
- Keep tests stable and focused on user-observable outcomes.
- For visual changes, capture screenshots or Playwright trace evidence when useful.

## Command

```bash
pnpm test:e2e
```

Targeted runs are acceptable for scoped changes.

---
name: code-review
description: Perform static and architectural review for a Chaotang frontend change.
---

# Code Review Skill

## Checks

- File placement follows `.harness/rules/project-structure.md`.
- No new root-level scratch docs.
- No silent fallback for domain mappings.
- No DEMO path presented as LIVE.
- No route handler privileged write without explicit gate.
- No high-risk visual decision weighting without screenshot/evidence.

## Suggested Commands

Pick based on scope:

```bash
pnpm exec tsc --noEmit
pnpm build
pnpm test:node
pnpm test:core
pnpm guard:auth
pnpm guard:tenant
pnpm guard:realdata
pnpm harness:doctor
```

## Output

Write `coding/review/code_review_v1.md` with findings and verdict.

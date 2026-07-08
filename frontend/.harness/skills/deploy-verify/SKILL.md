---
name: deploy-verify
description: Verify build/start/release behavior for Chaotang frontend delivery.
---

# Deploy Verify Skill

## Checks

- `pnpm build` passes.
- Production start remains port 3050.
- Dev remains port 3002.
- Base path `/chaotang` is preserved.
- Release-facing routes smoke successfully.
- Console errors are recorded for browser checks.

## Output

Write `deployment/preview_report.md` with:

- Commands.
- Routes checked.
- Screenshots or trace paths if present.
- Console errors.
- Known risks.

---
name: frontend-app-builder
description: CourtOS project wrapper for Frontend App Builder. Use for new frontend surfaces, major redesigns, dashboard work, and visual implementation. Favors original-screen fusion over new pages.
---

# CourtOS Frontend App Builder

This project has the Codex `build-web-apps:frontend-app-builder` skill available in the Codex plugin cache. This local wrapper adapts it to CourtOS.

Before using this skill, read:

- `frontend/.impeccable.md`
- `.claude/skills/impeccable/SKILL.md`
- `.claude/skills/taste/SKILL.md`

## CourtOS Frontend Build Flow

1. Identify the existing screen that should absorb the capability:
   - Shangshufang
   - Junjichu
   - Memorial scroll
   - Shiguan
   - Zhuangyuan

2. Decide whether the change is small or large:
   - Small fusion: edit existing components directly; no Image Gen required.
   - New major surface/redesign: use Frontend App Builder concept-first workflow.

3. Preserve CourtOS user language:
   - Do not show internal loop names.
   - Do not show agent topology to ordinary users.
   - Show business-readable process, evidence, risk, conflict, and next action.

4. Verify:
   - `pnpm exec tsc --noEmit`
   - `pnpm test:core`
   - `pnpm build`
   - Browser screenshot/visual check for changed routes when visual layout changes.

## When To Use Full Concept Workflow

Use the full Frontend App Builder image-concept workflow only for:

- A major redesign of an existing CourtOS screen.
- A new primary dashboard surface.
- A large visual system change.
- A new asset-led hero or immersive scene.

Do not use it for small panel/row/card additions inside existing screens.


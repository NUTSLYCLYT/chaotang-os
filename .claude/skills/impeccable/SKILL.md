---
name: impeccable
description: CourtOS local adapter for Impeccable-style design methodology. Use when improving visual quality, theme consistency, UI hierarchy, typography, layout, color, or design taste in this repository.
---

# CourtOS Impeccable Adapter

Use this skill as the local Impeccable adapter for CourtOS. The upstream `pbakaus/impeccable` repository is not a standard `SKILL.md` package in this environment, so this local adapter provides the project-specific design context and checkpoints.

Always read `frontend/.impeccable.md` before making CourtOS UI changes.

## Required Checkpoints

1. Emotional positioning:
   - What should this screen feel like?
   - For CourtOS, default to solemn, decisive, premium, operational.

2. Visual personality:
   - Volume: normal/keynote for decisions, whisper for metadata.
   - Temperature: dark neutral with controlled gold.
   - Density: compact and scan-friendly.
   - Texture: glass/lacquer command room.

3. Typography:
   - Check title/body/control hierarchy.
   - Avoid browser-default button/input typography.
   - Verify mobile text does not overflow.

4. Arrangement:
   - Preserve original screens.
   - Add panels/rows/sections before creating new pages.
   - Make current state, biggest risk, and next action visible in the first viewport.

5. Distillation:
   - Remove visible internal loop names and technical agent topology.
   - Remove decorative elements that do not improve decision clarity.

6. Color:
   - Gold = decision/accent.
   - Red = block/human confirmation.
   - Yellow = missing evidence/warning.
   - Green = cleared/proceed.
   - Blue = mixed/process/source.

7. Audit:
   - Source label visible where reports are judged.
   - Missing evidence visible.
   - Conflicts visible.
   - High-risk acceptance gated.

## CourtOS-Specific Hard Rule

New capabilities should merge into existing screens first:

- Shangshufang
- Junjichu
- Memorial scroll
- Shiguan
- Zhuangyuan

Do not expose internal names like `court_unified_decision_loop_v1` in user-facing UI.


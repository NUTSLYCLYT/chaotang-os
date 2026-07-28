# Task: Liubu six-manor overview

> This task follows `docs/decisions/0028-decree-evidence-flow-governance-baseline.md` and does not alter the decree, evidence, reply, or archive flows.

## Status

Accepted

## Product Definition

- User-confirmed request: regenerate the `/liubu` background so its six former dark areas become six distinct imperial manors. Each manor has a Chinese plaque for 吏部、户部、礼部、兵部、刑部、工部.
- The plaque text is rendered by the UI over blank generated plaques, so the Chinese labels remain exact; the generated bitmap provides the architectural scene only.
- Hovering or keyboard-focusing a manor reveals read-only details from the existing reply projection: 办结回奏、回奏主体、最近回奏. Clicking still enters that ministry.

## Acceptance Criteria

- [ ] The page uses the generated `04-zhuangyuan-liubu-manors.png` as the sole Liubu background and visually contains six connected manor compounds.
- [ ] Six DOM plaques show the exact department names; each maps to its own manor and has a keyboard-focusable detail state.
- [ ] Hover/focus reveals the three real read-only reply metrics without adding writes, polling, or fabricated live status.
- [ ] No centered module, veil, duplicate scene map, scroll bar, or hover-induced layout shift is introduced.
- [ ] Targeted tests, lint, typecheck, Harness, and visual browser inspection pass.

## Delivery Constraints

- Scope: `/liubu` visual overview only; no changes to department/office workflows, authentication, BFF, decree, evidence, or archive contracts.
- Compatibility: preserve the existing ministry links, read-only projection semantics, navigation, single background renderer, and no-scroll behavior.
- Codex-only: yes; no Claude runner or external service writes.
- Skill plan: `imagegen`, `test-driven-development`, `codex-engineering-workflow`, `verification-before-completion`, and browser visual acceptance.

## Affected Modules

- 模块：六部府邸背景、府邸牌匾和只读回奏悬停详情。
- 允许路径：`frontend/src/features/ministries-visual/MinistryOverviewScene.tsx`、`frontend/src/features/ministries-visual/ministries.module.css`、`frontend/src/features/ministries-visual/ministriesVisual.test.ts`、`frontend/public/assets/zhuangyuan/04-zhuangyuan-liubu-manors.png`、`docs/product/tasks/2026-07-28-liubu-six-manors-hover-replies.md`。

## Technical Plan

- Keep `ImmersiveCourtShell` as the only background renderer and reuse its cover-coordinate plane.
- Map six transparent manor hotspots to the six generated compounds. Render a DOM plaque and hidden detail panel in each hotspot; reveal the panel only for `:hover` and `:focus-visible`.
- Use the existing `projectMinistryMetrics()` projection to retain real read-only reply data and its loading/error/empty semantics.

## Implementation Report

- Generated `04-zhuangyuan-liubu-manors.png` with six connected palace compounds and blank plaque surfaces; the six exact Chinese department names are DOM text over those plaques.
- Replaced the former dark-area cards with transparent manor hotspots. Hover and keyboard focus reveal the existing read-only reply metrics without new network access or write behavior.
- TDD evidence: the new manor/plaque/hover source guard failed before implementation because the former route background and density cards remained; it passed after the minimal scene and CSS rewrite.
- Verification: targeted ministry test 1/1, shell test 6/6, lint, typecheck, Harness 72/72, scoped diff check, and browser visual inspection passed.

## Acceptance Review

- Result: Accepted.
- Browser evidence: six plaques display 吏部、户部、礼部、兵部、刑部、工部; hovering 吏部 showed 办结回奏、回奏主体、最近回奏 and the DOM panel opacity changed to 1.
- Stability evidence: browser scroll height equalled client height, with no vertical scrollbar introduced.

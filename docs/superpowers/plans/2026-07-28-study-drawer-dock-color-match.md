# 上书房侧抽屉与底部栏配色一致 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让上书房左右侧抽屉使用与底部栏完全相同的深蓝黑渐变背景。

**Architecture:** 保持现有组件边界，仅在 CSS Module 层同步背景声明。回归测试同时读取两个 CSS 文件并比较目标规则，防止后续单边改色造成漂移。

**Tech Stack:** Next.js、React、TypeScript、CSS Modules、Node.js `node:test`

## Global Constraints

- 不修改抽屉内容、布局、遮罩、透明度、动画、交互或业务流程。
- 不修改 ADR 0028。
- 不执行真实模型调用。
- 未获用户单独授权，不提交、推送或部署。

---

### Task 1: 锁定并统一侧抽屉背景

**Files:**
- Modify: `frontend/src/features/study-visual/StudySideDrawers.test.ts`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.module.css`

**Interfaces:**
- Consumes: `CourtQuickDock.module.css` 中 `.dock` 的 `background` 声明。
- Produces: 与 `.dock` 背景值一致的 `.drawer` 样式和防漂移回归测试。

- [ ] **Step 1: 写入失败测试**

在 `StudySideDrawers.test.ts` 中读取 `CourtQuickDock.module.css`，提取 `.drawer` 与 `.dock` 规则，并断言两个规则的 `background` 值相等。

- [ ] **Step 2: 验证测试按预期失败**

Run: `node --test src/features/study-visual/StudySideDrawers.test.ts`

Expected: FAIL，实际值为 `#10100e`，期望值为底部栏深蓝黑渐变。

- [ ] **Step 3: 写入最小实现**

将 `.drawer` 的背景替换为：

```css
background: linear-gradient(180deg, rgba(7, 9, 16, 0.94), rgba(4, 6, 12, 0.9));
```

- [ ] **Step 4: 验证专项测试通过**

Run: `node --test src/features/study-visual/StudySideDrawers.test.ts`

Expected: PASS。

- [ ] **Step 5: 运行前端与仓库验证**

Run:

```powershell
npm run lint
npm run typecheck
node ..\scripts\check_harness.mjs
git diff --check
```

Expected: 全部退出码为 0。

- [ ] **Step 6: 检查变更范围**

Run: `git diff -- frontend/src/features/study-visual/StudySideDrawers.module.css frontend/src/features/study-visual/StudySideDrawers.test.ts docs/product/tasks/2026-07-28-study-drawer-dock-color-match.md docs/superpowers/plans/2026-07-28-study-drawer-dock-color-match.md`

Expected: 仅包含本任务声明的样式、测试和文档修改；不创建提交。

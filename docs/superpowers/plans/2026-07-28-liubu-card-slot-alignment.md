# 六部卡片落点对齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `/liubu` 的六张部门卡片与背景图中对应的六个深色落点使用同一套 cover 裁切坐标。

**Architecture:** 以一个绝对定位的 `sceneMap` 同时承载背景图和热点卡片，令它以与 `background-size: cover` 相同的尺寸、居中与裁切规则覆盖内容区。卡片保留原图像像素坐标，因而随场景一起缩放；针对顶部、中部、底部落点使用其各自的安全区尺寸，避免覆盖金色路径。

**Tech Stack:** Next.js、React、CSS Modules、TypeScript、node:test。

## Global Constraints

- 仅修改 `frontend/src/features/ministries-visual/**` 及对应测试。
- 保持六部路由、只读数据投影与 ADR 0028 不变。
- 不恢复 `ResizeObserver`、JavaScript 尺寸测量或页面滚动条。
- 背景与卡片必须共用同一 1672×941 场景坐标层。

---

### Task 1: 共用场景图层和落点尺寸

**Files:**
- Modify: `frontend/src/features/ministries-visual/MinistryOverviewScene.tsx`
- Modify: `frontend/src/features/ministries-visual/ministries.module.css`
- Test: `frontend/src/features/ministries-visual/ministriesVisual.test.ts`

**Interfaces:**
- Consumes: `DEPARTMENT_DIRECTORY`、`MinistryReplyProjection` 与现有 `/liubu/[code]` 链接。
- Produces: `.sceneMap` 内的背景图与六个 `.ministryHotspot`，使用原图像像素定位。

- [ ] **Step 1: Write the failing test**

在 `ministriesVisual.test.ts` 中断言：源代码使用 `sceneMap` 包裹背景 `<img>` 与六张热点；CSS 将 `.sceneMap` 设为 `aspect-ratio: 1672 / 941` 并居中裁切；`MINISTRY_BOXES` 对顶部、中部、底部拥有不同高度。

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-name-pattern="scene map" src/features/ministries-visual/ministriesVisual.test.ts`

Expected: FAIL，因为现有页面把背景作为 `.overview` 的 CSS 背景，且所有卡片均为 `280×130`。

- [ ] **Step 3: Write minimal implementation**

在 `MinistryOverviewScene.tsx` 中将背景图和卡片移动到 `styles.sceneMap`；背景图使用 `styles.sceneBackground`。在 CSS 中将 `.overview` 设为裁切容器，`.sceneMap` 以 `width: max(100%, calc(100cqh * 1672 / 941))`、`height: max(100%, calc(100cqw * 941 / 1672))`、`left/top: 50%` 与 `translate(-50%, -50%)` 对齐 cover。将卡片定位改为原图像像素比例。根据六个深色块分别为顶部、中部和底部配置可读但不越界的尺寸。

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --test-name-pattern="scene map" src/features/ministries-visual/ministriesVisual.test.ts`

Expected: PASS。

- [ ] **Step 5: Run focused quality checks**

Run: `npm run lint && npm run typecheck && npm test -- src/features/ministries-visual/ministriesVisual.test.ts`

Expected: lint/typecheck PASS；如果该文件仍出现既有 `projectJunjichuFacts` 失败，记录为非本任务缺陷。

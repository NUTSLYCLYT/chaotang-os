# 上书房单一美化输入条 Implementation Plan

> **REQUIRED SUB-SKILL:** Use `executing-plans` to carry out this plan task by task. Use `test-driven-development` before each implementation change and `verification-before-completion` before reporting completion.

**Goal:** 将上书房底部中间的输入框收束为一个精致、明确的“下旨”入口，移除“密旨”模式，但保持现有真实提交链路与费用提示。

**Architecture:** 仅调整前端展示与本地组件状态。`DevStudyWorkspace` 保留现有同源提交、附件、润色和费用提示节点，删除模式状态、模式切换控件及其分支文案；样式以紧凑的墨色输入槽、金色聚焦态和单一高亮提交按钮建立层级。

**Constraints:** 不修改后端、BFF、接口或路由；不隐藏费用提示；保留既有测试选择器；不提交 Git。

## Task 1: 先为单一入口写回归测试

**Files:**
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`

**Step 1: Write the failing test**

新增断言：页面不再输出“密旨”或密旨模式控件；提交按钮仅显示“下旨”（提交中仍可显示办理中）；附件、润色、输入框与费用提示仍可定位。

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/study-visual/DevStudyWorkspace.test.ts`

Expected: FAIL，因为当前组件仍有模式切换与“密旨”文案。

## Task 2: 删除模式分支并收束为一个下旨动作

**Files:**
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.tsx`

**Step 1: Make the minimal implementation**

删除 `DecreeMode`、模式 state、`data-mode`、模式切换控件、密旨占位文案与提交文案分支。清理此前隐藏的旧输入区，确保源码与实际渲染都不再保留密旨交互；保留 `decree-textarea`、`submit-decree-button`、`decree-polish-inline`、附件与 `decree-fee-notice` 测试节点。

**Step 2: Run focused test**

Run: `npm test -- src/features/study-visual/DevStudyWorkspace.test.ts`

Expected: PASS。

## Task 3: 美化单一输入条

**Files:**
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.module.css`

**Step 1: Implement styles**

移除密旨和模式切换样式。将底部中心输入区设为墨色渐变容器、柔和金边和内阴影；收紧附件/润色控制为次级操作；提升文本输入区可读性与聚焦态；将“下旨”设为唯一金色主操作。保持窄屏可用，费用提示固定在输入条上方。

**Step 2: Run focused test**

Run: `npm test -- src/features/study-visual/DevStudyWorkspace.test.ts src/features/court-visuals/courtVisuals.test.ts`

Expected: PASS。

## Task 4: 完整验证与任务记录

**Files:**
- Modify: `docs/product/tasks/2026-07-28-study-composer-single-action.md`

**Step 1: Run verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

Expected: all commands exit 0.

**Step 2: Update task evidence**

将任务状态更新为 `Implemented`，记录实际改动和验证命令；若仓库全量 harness 仍因无关任务格式失败，则如实注明，并对本任务路径运行 scoped diff check。

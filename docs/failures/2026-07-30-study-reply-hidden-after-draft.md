# 下旨成功后回奏被草案遮挡

## Summary

已确认的草案成功下旨后，中央卷轴仍继续显示草案，没有显示接口返回的回奏。页面状态 `uiState` 已进入 `success`，但 `draftResult` 仍然保留，展示层优先命中了草案渲染分支。

## Root Cause

下旨提交完成时，页面只安装了返回的 `uiState`，没有把“成功回奏已经取代已确认草案”作为同一个状态提交边界的一部分。由于草案状态与回奏状态分别更新，`draftResult` 在成功后仍有值，而中央卷轴的草案分支优先于成功回奏分支，导致真实成功状态被旧草案遮挡。既有源码形状检查只确认相关代码片段存在，并未执行从草案到成功回奏的状态转换，因此产生假绿。

## Prevention

以可执行的 `commitStudyDecreeUiState` 作为唯一状态提交边界：每次返回都必须安装新的 `DecreeUiState`；仅当 `phase` 为 `success` 时清除草案并使最近回奏失效；错误状态只安装错误结果并保留草案。这样成功与失败的副作用由同一个可测试边界决定，避免调用方以多个彼此独立的状态更新重新引入展示优先级错误。

## Detection

[`frontend/src/app/study/StudyClient.test.ts`](../../frontend/src/app/study/StudyClient.test.ts) 中的成功与错误测试会实际调用状态提交边界：成功路径必须安装回奏状态、清除草案并使最近回奏失效，错误路径必须安装错误状态且保留草案。前端全量 `npm test` 用于捕获相关回归，仓库门禁 `node scripts/check_harness.mjs` 用于确认故障记录章节完整性及治理约束；不能再以仅匹配源码形状的检查替代这两个状态转换测试。

## Evidence

- [`frontend/src/app/study/StudyClient.tsx`](../../frontend/src/app/study/StudyClient.tsx)
- [`frontend/src/app/study/StudyClient.test.ts`](../../frontend/src/app/study/StudyClient.test.ts)
- [已批准设计：下旨后展示回奏](../superpowers/specs/2026-07-30-study-reply-after-draft-design.md)
- [ADR 0028：下旨、锦衣卫证据与史馆回奏业务流基线](../decisions/0028-decree-evidence-flow-governance-baseline.md)

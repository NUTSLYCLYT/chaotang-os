# /study 第一旨恢复动作最小修复

## Status

Implemented

## Product Definition

收敛 `/study` 第一旨闭环的恢复动作和恢复状态源：非 `DRAFT_READY` 的草案状态不能伪装成 `EMPTY`；恢复动作必须唯一、明确、可测试；渲染阶段不得清理 `sessionStorage`。

## Acceptance Criteria

- [x] 非 `DRAFT_READY` 状态显示真实阻断和唯一恢复动作。
- [x] `EMPTY` 只表示没有草案。
- [x] 非法持久态在 render 阶段不会被删除；主动加载流程仍保持清理行为。
- [x] 相关前端测试、lint、typecheck、build 和根级治理检查纳入验证矩阵。
- [ ] 真实多 Agent 办理、外部模型调用和 G3 发布验收仍未由本任务宣称完成。

## Delivery Constraints

不改后端、BFF、认证、数据库、部署和既有朝堂视觉基线；不改变 `DRAFT_READY` 下旨硬门槛；不新增第二套状态机、任务账本或恢复存储；不启用真实 provider，不接入生产数据。

## Affected Modules

- 模块：Study 页面状态恢复、轮询客户端和对应前端测试。
- 允许路径：`frontend/src/app/study/StudyClient.tsx`、`frontend/src/app/study/decreeJobPolling.test.ts`、`frontend/src/app/study/decreeJobPolling.ts`、`frontend/src/features/study-visual/DevStudyWorkspace.test.ts`、`frontend/src/features/study-visual/DevStudyWorkspace.tsx`、`frontend/src/features/study-visual/studyTaskCockpit.test.ts`、`frontend/src/features/study-visual/studyTaskCockpit.ts`。

## Technical Plan

以单一恢复状态源驱动 Study 页面；将 render 与主动加载的清理行为分离；先验证非法持久态和阻断文案，再运行聚焦测试、lint、typecheck、build 和根级 Harness 检查。真实 Agent 和生产数据另立任务。

## Implementation Report

实现已经随 Study 恢复相关提交进入当前 `ext-dev` 远端历史。本文件只补齐任务结构，不能替代当前候选的独立 M0 验证或真实用户流程验收。

## Acceptance Review

Pending。页面恢复逻辑已登记；真实模型、真实多 Agent 办理、结果护照、翰林验收和史馆归档仍由 G3 发布验收门决定。

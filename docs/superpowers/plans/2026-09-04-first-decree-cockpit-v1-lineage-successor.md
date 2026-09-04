# First Decree Cockpit V1 Lineage Successor Plan

任务 ID：`FIRST-DECREE-COCKPIT-V1-LINEAGE-SUCCESSOR-20260904`

## Status

Draft

## Product Definition

本计划将旧 First Decree Cockpit 前端价值重放到当前 `ext-dev`，形成路演优先的上书房第一旨体验：用户输入目标后，能看见真实拟旨合同、缺口、是否可下旨、任务状态与失败恢复。该体验只消费现有前端/后端 API 合同，不新增事实源。

## Acceptance Criteria

- [ ] approval commit 只包含 `.harness/approvals/FIRST-DECREE-COCKPIT-V1-LINEAGE-SUCCESSOR-20260904.json`、Task、Plan 三条路径。
- [ ] machine authority GO 后才允许 exact11 产品 candidate。
- [ ] exact11 candidate 只修改 manifest product paths，结构为 `2 ADD + 9 MODIFY / ALL 100644`。
- [ ] 新增 `studyTaskCockpit` 投影测试证明 live/local/source/fail-closed 边界。
- [ ] 页面集成后，首屏主线可解释、可操作、无虚假进度。
- [ ] 完整验证矩阵、真实浏览器链和独立审查全绿后才可提交 candidate。

## Delivery Constraints

- 不直接合并旧分支，不继承旧 authority、candidate、验证或审查身份。
- 不改后端、数据库、BFF、Harness、Authority、发布、凭据、P01/P10/P14。
- 不安装依赖，不使用真实模型、公网、生产数据或 secret。
- 不部署生产。

## Affected Modules

- 模块：上书房第一旨前端纵切、任务 cockpit read-model、study 页面交互与测试。
- 允许路径：`frontend/src/app/study/StudyClient.test.ts`；`frontend/src/app/study/StudyClient.tsx`；`frontend/src/app/study/decreeStatus.test.ts`；`frontend/src/app/study/decreeStatus.ts`；`frontend/src/app/study/studySubmission.test.ts`；`frontend/src/app/study/studySubmission.ts`；`frontend/src/features/study-visual/DevStudyWorkspace.module.css`；`frontend/src/features/study-visual/DevStudyWorkspace.test.ts`；`frontend/src/features/study-visual/DevStudyWorkspace.tsx`；`frontend/src/features/study-visual/studyTaskCockpit.test.ts`；`frontend/src/features/study-visual/studyTaskCockpit.ts`。

## Technical Plan

1. Governance freeze：校验 approval JSON、Task 合同、path/mode、Harness、V2 convergence 和 diff check。
2. Authority：三文件 approval commit 普通快进后，运行一次 product authority；非 GO 则停止。
3. Candidate baseline：从 approval commit 创建唯一干净 candidate 工作区。
4. TDD RED：在 `studyTaskCockpit.test.ts`、`DevStudyWorkspace.test.ts` 与现有 study tests 中锁定当前缺失体验和 fail-closed 边界。
5. Minimal replay：从 donor 只重放 read-model 和必要页面绑定；按当前 `DecreeUiState` 适配，避免旧字段强行回灌。
6. Verification：运行 focused 前端 tests、full frontend tests、lint、typecheck、build、root Harness、doctor、authority regression、V2 check/tests、diff check。
7. Browser：本地 synthetic backend/network interception 验证 `/study` 首次输入、拟旨、下旨、刷新恢复、失败恢复；记录截图、控制台和 network 证据。
8. Review：独立 Frontend/TypeScript Review 与 Security Review；任一 P0/P1/P2 为 NO-GO。
9. Freeze：计算 exact11 bundle、combined diff、verification evidence、candidate evidence。
10. Landing：只在全部通过后创建唯一 candidate commit 并普通 fast-forward；失败则保持 donor-only。

## Implementation Report

尚未实施产品字节。本计划只冻结 successor 边界。当前已知 donor `0cfc865ceb0c02973113671e6290155ea2cda6d3` 中 `studyTaskCockpit.ts` 与 `studyTaskCockpit.test.ts` 在主线缺失，其他 9 条路径需要按当前前端合同重新适配。

## Acceptance Review

当前计划为 `DRAFT / NON_AUTHORIZING`。它不会绕过 product authority，也不会消耗旧 First Decree approval。产品可交付身份只来自本 successor 的 machine GO、exact11 重新物化、完整验证、独立审查和普通快进落地。

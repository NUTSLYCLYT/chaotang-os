# First Decree Cockpit V1 Lineage Successor

任务 ID：`FIRST-DECREE-COCKPIT-V1-LINEAGE-SUCCESSOR-20260904`

冻结基线：`origin/ext-dev@250f2ca49e5f55cd863e856010e436d7d1db2425`

冻结 tree：`9622884df705e9595c7c7b9b4a0029c9ecacec6b`

> 治理状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`
>
> 本 successor 将 2026-08-26 旧 First Decree Cockpit exact11 的前端价值作为 byte donor 重新签发到当前主线。旧 `FIRST-DECREE-COCKPIT-V1-20260826` approval 已被 Owner 处置为未消费历史证据，不得恢复、继承、消费或 re-anchor。

## Status

Draft

## Product Definition

当前 `origin/ext-dev@250f2ca49e5f55cd863e856010e436d7d1db2425` 已完成 P01 battery safety、P10/P14/credential guard 等多轮主线治理与候选落地，并通过根 Harness 与 V2 convergence 非授权检查。G1 小分支裁决确认旧 `0cfc865ceb0c02973113671e6290155ea2cda6d3` 分支包含尚未进入当前主线的首份旨意任务驾驶舱价值，但该分支基线过旧，不能直接 merge 或 cherry-pick。

本包目标是重新签发一个当前基线的前端纵切 successor：

- 首次进入上书房的用户看见一个清晰的拟旨/下旨任务驾驶舱，而不是在多层仪轨和隐藏状态之间迷路。
- 拟旨事实只来自现有 `ChancellorDraftResult` 与当前前端 API 适配合同。
- 下旨任务事实只来自现有 decree job 响应，不虚构进度、ETA、部门完成数、来源或外部动作。
- `LOCAL`、`API_LIVE` 与不可用状态显式区分；API 不足时 fail-closed 到“状态不可用/待补充”，不得补造业务事实。
- 只重放当前主线仍缺失的前端 read-model 与页面体验，不新增后端事实源、BFF、数据库、模型调用或第二任务状态机。

## Acceptance Criteria

- [ ] approval commit 必须是 `250f2ca49e5f55cd863e856010e436d7d1db2425` 的直接单亲子，只包含本 approval、Task、Plan 三条治理路径。
- [ ] product authority 对 `FIRST-DECREE-COCKPIT-V1-LINEAGE-SUCCESSOR-20260904` 返回 `GO / APPROVED_FOR_ONE_CHILD` 后，才允许 exact11 candidate。
- [ ] future candidate 只允许修改 manifest 中 11 条前端路径，结构必须为 `2 ADD + 9 MODIFY`，全部模式 `100644`。
- [ ] `studyTaskCockpit` 纯投影必须证明 bare job id、入队占位、stale error 或缺少真实 snapshot 时不得标成 `API_LIVE`。
- [ ] `DevStudyWorkspace` 必须消费 cockpit read-model，首屏回答“发生什么、需要我决定什么、朝堂下一步做什么”。
- [ ] 既有拟旨、提交、状态映射和前端测试不得回退；刷新恢复与失败恢复必须 fail-closed。
- [ ] 真实浏览器链需验证 `/study` 首次输入、拟旨、模拟下旨、刷新恢复、失败恢复；不得触发真实模型、公网、生产数据或业务写入。
- [ ] 前端 focused/full tests、lint、typecheck、build、根 Harness、doctor、product-authority regression、V2 convergence 与 `git diff --check` 必须通过。
- [ ] 独立 Frontend/TypeScript Review 与 Security Review 不得存在未关闭 P0、P1 或 P2。

## Delivery Constraints

- 不直接合并旧 `0cfc865…` 分支；旧字节只作为 donor evidence。
- 不消费、恢复、继承或 re-anchor 旧 `FIRST-DECREE-COCKPIT-V1-20260826` authority。
- 不修改后端、数据库、认证、租户、史馆、Harness、Authority、CI、ADR、release、P01、P10、P14 或 credential guard。
- 不新增 `frontend/src/app/api/**` 或任何 BFF route。
- 不安装依赖，不调用真实模型、公网、生产数据或 secret。
- 不实现动态三方案、通用成果包、FinalMemorial、EmperorDecision、附件上传或真实外部行动。
- 不把硬编码示例、演示样本或旧 job id 冒充真实 live 状态。

## Affected Modules

- 模块：上书房首份旨意前端驾驶舱、拟旨验收投影、任务状态 read-model 与对应前端测试。
- 允许路径：`frontend/src/app/study/StudyClient.test.ts`；`frontend/src/app/study/StudyClient.tsx`；`frontend/src/app/study/decreeStatus.test.ts`；`frontend/src/app/study/decreeStatus.ts`；`frontend/src/app/study/studySubmission.test.ts`；`frontend/src/app/study/studySubmission.ts`；`frontend/src/features/study-visual/DevStudyWorkspace.module.css`；`frontend/src/features/study-visual/DevStudyWorkspace.test.ts`；`frontend/src/features/study-visual/DevStudyWorkspace.tsx`；`frontend/src/features/study-visual/studyTaskCockpit.test.ts`；`frontend/src/features/study-visual/studyTaskCockpit.ts`。

## Technical Plan

1. 将本三文件 approval commit 普通快进落地到 `origin/ext-dev`。
2. 运行一次 canonical `product-authority.m0.v1 --authorize`，只接受当前 successor 的 `GO / APPROVED_FOR_ONE_CHILD`。
3. 从 approval commit 创建唯一干净 candidate 工作区；禁止多个前端字节写入者。
4. 先用当前主线结构形成 RED：缺失 `studyTaskCockpit` 投影、缺失 API_LIVE fail-closed 显示、缺失首屏任务状态卡。
5. 将旧 donor 的纯投影合同适配到当前 `DecreeUiState`、`StudyClient` 与 `DevStudyWorkspace`，只在 exact11 路径内做最小重放。
6. 完整运行 manifest 验证矩阵、真实浏览器链与独立审查。
7. 通过后冻结 exact11 raw/blob/mode/bytes、bundle、combined diff、verification evidence 与 candidate evidence；再创建唯一 candidate commit 并普通快进。

## Implementation Report

当前为治理 successor 草案和正式 approval 候选。本轮没有产品字节、candidate、浏览器通过或上线声明。

只读 donor 事实：

- donor commit：`0cfc865ceb0c02973113671e6290155ea2cda6d3`
- donor summary：`feat(study): add first decree task cockpit`
- donor changed paths：11 条前端路径，其中当前主线缺失 `frontend/src/features/study-visual/studyTaskCockpit.ts` 与 `frontend/src/features/study-visual/studyTaskCockpit.test.ts`
- donor disposition：`BYTE_DONOR_ONLY / NO_AUTHORITY_INHERITANCE / NO_CANDIDATE_IDENTITY / NO_REANCHOR`

G1 裁决记录已落地：`docs/reviews/2026-09-04-g1-small-branch-semantic-triage.md`。

## Acceptance Review

本 Task 当前为 `Draft`。通过边界如下：

- approval 三文件必须独立成为当前基线的直接单亲子；
- machine authority 必须重新对本 successor 返回 GO；
- exact11 candidate 必须重新物化、重新测试、重新审查；
- 任何远端漂移、machine STOP、路径扩张、BFF/后端修改、虚构 live 状态、浏览器链失败或独立审查 P0/P1/P2 均立即 STOP。

在上述条件全部满足前，旧 First Decree Cockpit 只能作为前端价值 donor，不是可提交产品身份。

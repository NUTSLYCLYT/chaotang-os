# First Decree Cockpit V1

任务 ID：`FIRST-DECREE-COCKPIT-V1-20260826`

冻结基线：`origin/ext-dev@c939bc4dc5f759d52ca86424c725f8ac2baf2d19`

冻结 tree：`a7ce87107ca4763c448183b1a21b467310a72443`

Owner 已于 2026-08-26 明确批准本任务按 exact11 进入 M0。产品写入仍以机器 `GO / APPROVED_FOR_ONE_CHILD` 为唯一执行条件。

## Status

Ready

细分状态：`OWNER_EXACT11_APPROVED / M0_APPROVAL_COMMIT_PENDING / PRODUCT_STOP_UNTIL_MACHINE_GO`

## Product Definition

第一次进入上书房的用户只面对丞相和一个目标输入框，不先选择帝王风格、不先浏览组织结构，也不被硬编码示例替代真实目标。拟旨后，用户能看见基于现有真实合同投影的任务验收卡；下旨后，用户能看见真实任务状态、阶段、次数、时间、失败与恢复动作。

本 Packet 只交付 P0-1、P0-3、P0-4 的第一个纵向切片，并约束每个状态只有一个主操作。它不宣称完成 P0-2 动态三方案、通用三层成果包、可信温度、持久化结果决策或史馆复盘。

## Frozen Truth Contract

- 拟旨事实只来自当前 `ChancellorDraftResult`：目标、范围、排除项、输入材料、材料缺口、关键问题、执行步骤、交付物、完成标准、权限边界、版本与 fingerprint。
- 任务事实只来自当前 decree job 响应：公开 state、stage、attempt count、provider request count、created/updated time、job id、失败类别和错误码。
- `DEMO`、`LOCAL`、`API_LIVE` 必须显式区分；硬编码示例不得作为默认真实旨意。
- 内部 `RETRY_WAIT/RESULT_READY/ARCHIVING/PUBLISHING` 不得从公开 `RUNNING` 中臆测；只能展示 API 实际返回的 stage 文本。
- 不生成进度百分比、ETA、虚构部门完成数、虚构来源、虚构证据或虚构已执行动作。
- 失败时保留最后一次已验证状态并显示“状态不可用”；不得回退为泛化“办理中”或伪成功。

## Exact11 Scope

1. `frontend/src/app/study/StudyClient.test.ts`
2. `frontend/src/app/study/StudyClient.tsx`
3. `frontend/src/app/study/decreeStatus.test.ts`
4. `frontend/src/app/study/decreeStatus.ts`
5. `frontend/src/app/study/studySubmission.test.ts`
6. `frontend/src/app/study/studySubmission.ts`
7. `frontend/src/features/study-visual/DevStudyWorkspace.module.css`
8. `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`
9. `frontend/src/features/study-visual/DevStudyWorkspace.tsx`
10. `frontend/src/features/study-visual/studyTaskCockpit.test.ts`
11. `frontend/src/features/study-visual/studyTaskCockpit.ts`

需要第十二条产品路径、后端字段、BFF 变化、数据库迁移或新持久化时立即 STOP，重新申请 Packet。

## Delivery Constraints

- 治理提交与产品 candidate 必须是两个独立提交；治理提交只含三条 `approvalCommitPaths`。
- 产品候选只允许 exact11，按 TDD 先 RED、后 GREEN，不得修改测试来掩盖缺陷。
- 复用现有 draft/job API，不改变认证、owner 隔离、BFF 或后端合同。
- 不安装新依赖，不调用真实模型、公网、生产数据或 secret。
- 浏览器验收只允许本地页面配合注入式 synthetic backend/network interception；不得把“下旨”请求发送到真实 DeepSeek、真实业务后端或持久化事实源。
- 页面和浏览器验证必须绑定同一个 candidate SHA/tree；证据不得跨候选复用。

## Affected Modules

- 模块：上书房第一旨入口、拟旨验收投影、异步任务进度与恢复、对应前端测试。
- 允许路径：`frontend/src/app/study/StudyClient.test.ts`, `frontend/src/app/study/StudyClient.tsx`, `frontend/src/app/study/decreeStatus.test.ts`, `frontend/src/app/study/decreeStatus.ts`, `frontend/src/app/study/studySubmission.test.ts`, `frontend/src/app/study/studySubmission.ts`, `frontend/src/features/study-visual/DevStudyWorkspace.module.css`, `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`, `frontend/src/features/study-visual/DevStudyWorkspace.tsx`, `frontend/src/features/study-visual/studyTaskCockpit.test.ts`, `frontend/src/features/study-visual/studyTaskCockpit.ts`。

## Technical Plan

先在新增纯投影测试与现有交互测试中冻结 RED；再实现 `studyTaskCockpit` read model、移除首次仪轨、完整投影验收合同、保留真实 job 进度字段和 fail-closed 恢复；最后执行 manifest 验证矩阵、真实浏览器验收和独立复审。详细步骤以配套 Plan 为准。

## Acceptance Criteria

- [ ] 初次访问不出现帝王风格选择、三步仪轨或默认填充的旗舰产品示例。
- [ ] 首屏的核心任务区域只出现丞相、一个目标输入和一个主操作；辅助入口不与第一旨争夺主操作。
- [ ] 拟旨验收卡完整呈现现有合同字段；空值显示“待补充/未提供”，不得补造。
- [ ] 材料缺口、关键问题或 `NEEDS_INPUT/ISSUE_BLOCKED` 明确阻止下旨，并给出唯一恢复动作。
- [ ] 任务进度保留 API 返回的 job id、state、stage、attempt count、provider request count、created/updated time。
- [ ] 刷新后只恢复当前 owner 的既有 job；非法、过期或找不到的 job fail-closed。
- [ ] UI 明确区分本地草稿与真实 API 状态；不得显示虚构百分比或 ETA。
- [ ] loading、失败、恢复状态具备 `aria-live`，窄屏不遮挡目标输入和主操作。
- [ ] exact11 focused/full test、lint、typecheck、build、Authority、Harness 与 convergence 全部通过。
- [ ] 在真实浏览器中使用注入式 synthetic backend 验证 `/study` 首次输入、拟旨、模拟下旨、刷新恢复、失败恢复；控制台无新增错误，network 证明没有真实模型、公网或业务写入。
- [ ] 独立 TypeScript Review、前端体验 Review 无未关闭 P0-P2。

## Explicit Non-goals

- 不实现 P0-2 动态三方案；没有真实权衡时不显示三张方案卡。
- 不实现 `DecisionTask`、`FinalMemorial`、`EmperorDecision` 或第二任务状态机。
- 不修改后端、数据库、认证、租户、BFF、史馆、Harness、Authority、CI、ADR 或发布流程。
- 不实现附件上传、真实外部行动、真实模型/公网/生产数据或 secret 调用。
- 不把会计成果物的专用字段推广成通用成果事实。

## Stop Conditions

远端漂移、工作树污染、机器 Authority 非 GO、exact11 扩张、现有 API 不足以支持字段、测试失败原因不明、状态/来源推断、跨 owner 恢复、浏览器与测试证据身份不一致时立即 STOP。

## Rollback

产品候选只允许按完整 candidate commit 回滚，且需单独授权；禁止 reset、force-push 或拆分回退。

## Implementation Report

已完成 Owner exact11 明确批准与远端冻结基线复核。M0 三文件正在进行 Harness 和独立审查；产品代码、RED、GREEN、candidate、浏览器证据、提交、推送、发布和部署均未开始。

## Acceptance Review

Owner scope review：`GO / exact11`。Machine Authority：等待正式治理提交后执行；在返回 `GO / APPROVED_FOR_ONE_CHILD` 前保持 `PRODUCT_STOP`。产品验收：Pending。

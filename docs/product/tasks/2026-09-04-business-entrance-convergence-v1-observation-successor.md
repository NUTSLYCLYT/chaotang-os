# Business Entrance Convergence V1 Observation Successor

任务 ID：`BUSINESS-ENTRANCE-CONVERGENCE-V1-OBSERVATION-SUCCESSOR-20260904`

冻结基线：`origin/ext-dev@f117c5f6df2a260a493a8f81f805033a7dbf9577`

冻结 tree：`eca5be9e854dfea57084832965a7d5771f5a3dc1`

> 治理状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`
>
> 本 successor 只增加非授权观察器和合同文档，用于把旧 direct/swarm/flywheel/knowledge、Scene Pack、上书房、史馆、军机处和鸿胪寺入口纳入同一收敛账本。它不重构运行时、不删除旧入口、不启用外部发布、不创建第二事实源。

## Status

Draft

## Product Definition

当前 `origin/ext-dev@f117c5f6df2a260a493a8f81f805033a7d5771f5a3dc1` 已有非生产路演 RC：`/dadian`、Scene Pack V1、Junjichu handoff、Honglusi gate UI、`/study` synthetic execution、P01 battery safety、P10/P14、credential-separated executor、First Decree Cockpit 与 full-matrix refresh 均已有主线证据。

剩余风险不是功能太少，而是入口太多：历史 donor、dirty root、旧 direct/swarm/orchestration/flywheel/knowledge 写入路径和兼容 BFF 可能绕过当前唯一业务主线。直接删除或批量合并都会造成更大风险。

本包目标是新增一个非授权的 business entrance observation checker：

- 机械列出当前 mainline 的 canonical business entry、pre-decree entry、async job、archive、case projection、scene pack 和 capability gate 表面。
- 将 legacy/direct/swarm/flywheel/knowledge families 标为 `MIGRATION_REVIEW_REQUIRED` 或 `OBSERVE_BEFORE_RETIREMENT`，不让它们静默成为当前可交付入口。
- 明确禁止第二 business runtime、第二 Shiguan writer、第二 truth ledger、第二 product authority、未观测即退休和 donor bulk import。
- 使后续 G4 runtime 收敛先通过可复算观察器，再进入更小 successor。

## Acceptance Criteria

- [ ] approval commit 必须是 `f117c5f6df2a260a493a8f81f805033a7dbf9577` 的直接单亲子，只包含本 approval、Task、Plan 三条治理路径。
- [ ] product authority 对本 task 返回 `GO / APPROVED_FOR_ONE_CHILD` 后，才允许 exact3 candidate。
- [ ] exact3 candidate 只允许新增 `docs/contracts/business-entrance-observation.v1.md`、`scripts/business-entrance-observation.mjs`、`scripts/business-entrance-observation.test.mjs`。
- [ ] 观察器必须输出稳定 JSON，包含 schemaVersion、decision、nonAuthorizing、baseline、canonicalFamilies、observeFamilies、migrationRequiredFamilies、forbiddenPatterns 和 nextSuccessor。
- [ ] 观察器不得读取 dirty donor worktree、不得调用网络、不得修改文件、不得执行 product authority、不得声明 legacy route retired。
- [ ] 测试必须证明第二 truth ledger、第二 Shiguan writer、swarm/direct execution、unobserved retirement、donor bulk import 和 production deployment 均 fail-closed。
- [ ] 观察器必须将 `/study`、decree jobs、Shiguan、Junjichu case projection、Scene Pack V1、Honglusi gate UI 分别归入现有主线角色，而不是新入口。
- [ ] 完整验证矩阵必须通过：focused Node tests、observation check、root Harness、Harness self-test、doctor、product-authority regression、V2 check/tests 和 `git diff --check`。
- [ ] 独立 Governance Review 与 Security Review 不得存在未关闭 P0、P1 或 P2。

## Delivery Constraints

- 不修改 `backend/app/**`、`frontend/src/**`、数据库、API、认证、租户、史馆存储、军机处存储、Harness runtime 或 product authority。
- 不删除、重命名、合并、rebase、清理、上传、覆盖任何 branch、worktree、dirty donor 或 untracked asset。
- 不启用外部 provider、MCP、IMA、Alibaba、官网、小程序、邮件、RFQ 或生产发布通道。
- 不把 Mingshuo、LangGraph、swarm、IMA 或第三方 Skill 变成第二事实源。
- 不声明 legacy route 退休；退休至少需要后续 observation telemetry 或 Owner 单独生命周期例外。
- 不使用旧 donor approval、candidate、machine GO、验证、审查或通过身份。

## Affected Modules

- 模块：业务入口收敛观察合同、非授权检查器和检查器测试。
- 允许路径：`docs/contracts/business-entrance-observation.v1.md`；`scripts/business-entrance-observation.mjs`；`scripts/business-entrance-observation.test.mjs`。

## Technical Plan

1. 将本三文件 approval commit 普通快进落地到 `origin/ext-dev`。
2. 运行一次 canonical `product-authority.m0.v1 --authorize`，只接受本 successor 的 `GO / APPROVED_FOR_ONE_CHILD`。
3. 从 approval commit 创建唯一干净 candidate 工作区；禁止多个字节写入者。
4. 先写 RED：当前缺少 business entrance observation checker，后续无法机器地区分 canonical、observe、migration-required 和 forbidden families。
5. 新增合同文档，定义 family 分类、非授权输出、禁止模式、观察天数和后续 successor 边界。
6. 新增 Node checker，读取受控内置清单和当前仓库必要文件存在性，输出稳定 JSON；`--check` 对禁止模式和必需主线锚点 fail-closed。
7. 新增 Node tests，覆盖正向主线、禁止第二事实源、禁止未观测退休、禁止 donor bulk import、禁止生产部署和输出稳定性。
8. 运行完整验证矩阵与独立审查；通过后冻结 exact3 identity、combined diff、verification evidence 和 candidate evidence。
9. 只在全部通过后创建唯一 candidate commit 并普通 fast-forward；失败则保持未提交 evidence。

## Implementation Report

当前为治理 successor 草案。本轮没有产品字节、candidate、浏览器通过或上线声明。

已落地主线证据：

- G4 target：`docs/reviews/2026-09-04-g4-business-entrance-convergence-target.md`
- G5 target：`docs/reviews/2026-09-04-g5-mingshuo-solution-hub-vertical-target.md`
- G6 synthetic E2E evidence：`docs/reviews/2026-09-04-g6-roadshow-rc-synthetic-e2e-evidence.md`
- current full matrix refresh：`docs/reviews/2026-09-04-g6-current-head-full-matrix-refresh.md`

这些 review 文件只冻结设计和证据，不授予 exact3 product candidate 身份。

## Acceptance Review

本 Task 当前为 `Draft`。通过边界如下：

- approval 三文件必须独立成为当前基线的直接单亲子；
- machine authority 必须重新对本 successor 返回 GO；
- exact3 candidate 必须重新物化、重新测试、重新审查；
- 任何远端漂移、machine STOP、路径扩张、runtime 修改、legacy 退休声明、外部发布、第二事实源、donor bulk import 或独立审查 P0/P1/P2 均立即 STOP。

在上述条件全部满足前，本 successor 只能作为业务入口观察器的治理边界，不是产品实现。

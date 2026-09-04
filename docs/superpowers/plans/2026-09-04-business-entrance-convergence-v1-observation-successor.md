# Business Entrance Convergence V1 Observation Successor Plan

任务 ID：`BUSINESS-ENTRANCE-CONVERGENCE-V1-OBSERVATION-SUCCESSOR-20260904`

## Status

Draft

## Product Definition

本计划把 G4 业务入口融合从人工审计推进到机器可复算观察器。它不改变任何业务运行时，只新增 exact3：一份合同、一支非授权检查器和一组测试。目标是后续每次融合旧 direct/swarm/flywheel/knowledge、Scene Pack、史馆、军机处、鸿胪寺和铭硕纵切时，都先看同一份入口状态，避免重复事实源和绕路执行。

## Acceptance Criteria

- [ ] approval commit 只包含 `.harness/approvals/BUSINESS-ENTRANCE-CONVERGENCE-V1-OBSERVATION-SUCCESSOR-20260904.json`、Task、Plan 三条路径。
- [ ] machine authority GO 后才允许 exact3 产品 candidate。
- [ ] exact3 candidate 只新增合同、checker、checker test 三条路径。
- [ ] checker 输出稳定 JSON，且 `decision` 只能为 `PASS` 或 `STOP`。
- [ ] checker 保持 `nonAuthorizing: true`，不得生成 authority、candidate、activation、deployment 或 route-retirement 结论。
- [ ] 检查器和测试证明 canonical、observe、migration-required、forbidden families 边界清晰。
- [ ] 完整验证矩阵和独立审查全绿后才可提交 candidate。

## Delivery Constraints

- 不修改后端、前端、Harness runtime、product authority、数据库、史馆、军机处、凭据、外部通道或生产部署。
- 不清理 dirty worktree，不合并旧分支，不继承 donor 身份。
- 不把 Mingshuo、IMA、LangGraph 或 swarm 提升为第二主线。

## Affected Modules

- 模块：业务入口观察合同、非授权 CLI 检查器、检查器测试。
- 允许路径：`docs/contracts/business-entrance-observation.v1.md`；`scripts/business-entrance-observation.mjs`；`scripts/business-entrance-observation.test.mjs`。

## Technical Plan

1. Governance freeze：校验 approval JSON、Task 合同、path/mode、Harness、V2 convergence 和 diff check。
2. Authority：三文件 approval commit 普通快进后，运行一次 product authority；非 GO 则停止。
3. Candidate baseline：从 approval commit 创建唯一干净 candidate 工作区。
4. RED：证明当前没有 `scripts/business-entrance-observation.mjs`，不能用机器输出统一判断入口融合状态。
5. Contract：新增 `docs/contracts/business-entrance-observation.v1.md`，冻结分类和禁止边界。
6. Checker：新增稳定、只读、非授权 Node CLI；只检查仓库内必要路径存在与内置 family 定义一致性。
7. Tests：覆盖输出形状、正向主线、禁止第二事实源、禁止未观测退休、禁止 donor bulk import、禁止生产部署、输出稳定性。
8. Verification：运行 focused tests、checker check、root Harness、self-test、doctor、authority regression、V2 check/tests、diff check。
9. Review：独立 Governance Review 与 Security Review；任一 P0/P1/P2 为 NO-GO。
10. Freeze and land：计算 exact3 identity 与证据摘要，通过后唯一 candidate commit 普通快进。

## Implementation Report

尚未实施产品字节。本计划只冻结 successor 边界。当前可用输入为 G4/G5/G6 review 文件和 current full-matrix refresh，它们不授权 runtime 修改。

## Acceptance Review

当前计划为 `DRAFT / NON_AUTHORIZING`。它不会绕过 product authority，不会退休旧入口，不会创建第二事实源。产品身份只来自本 successor 的 machine GO、exact3 重新物化、完整验证、独立审查和普通快进落地。

# Mingshuo Solution Hub V1 Fact Pack Blueprint Successor Plan

任务 ID：`MINGSHUO-SOLUTION-HUB-V1-FACT-PACK-BLUEPRINT-SUCCESSOR-20260904`

## Status

Draft

## Product Definition

本计划把铭硕方案中枢从产品设想推进到机器可校验的事实包蓝图。首包不做 UI、不接 IMA、不读取真实客户资料，只新增 exact4：合同、JSON Schema、非授权校验器和测试。目标是确保后续任何产品真值卡、方案、报价、客户话术或知识回写都先绑定事实与证据。

## Acceptance Criteria

- [ ] approval commit 只包含 `.harness/approvals/MINGSHUO-SOLUTION-HUB-V1-FACT-PACK-BLUEPRINT-SUCCESSOR-20260904.json`、Task、Plan 三条路径。
- [ ] machine authority GO 后才允许 exact4 产品 candidate。
- [ ] exact4 candidate 只新增合同、schema、checker、checker test 四条路径。
- [ ] checker 对无证据 claim、过期认证、无价格授权报价、外部发布、自动知识晋级和危险工艺/EHS 输出 fail-closed。
- [ ] checker 输出稳定 JSON，保持 `nonAuthorizing: true`。
- [ ] 完整验证矩阵和独立三审全绿后才可提交 candidate。

## Delivery Constraints

- 不修改后端、前端、数据库、史馆、军机处、Harness runtime、product authority、RuntimeSkill registry 或外部通道。
- 不接真实 IMA、真实客户数据、生产凭据、外部发布或设备控制。
- 不把 Mingshuo、IMA、LangGraph 或 swarm 提升为第二事实源。
- 不生成危险化学、设备、EHS 或质量放行操作指令。

## Affected Modules

- 模块：铭硕事实包蓝图合同、schema、离线检查器、检查器测试。
- 允许路径：`docs/contracts/mingshuo-project-fact-pack.schema.json`；`docs/contracts/mingshuo-project-fact-pack.v1.md`；`scripts/mingshuo-fact-pack.mjs`；`scripts/mingshuo-fact-pack.test.mjs`。

## Technical Plan

1. Governance freeze：校验 approval JSON、Task 合同、path/mode、Harness、V2 convergence 和 diff check。
2. Authority：三文件 approval commit 普通快进后，运行一次 product authority；非 GO 则停止。
3. Candidate baseline：从 approval commit 创建唯一干净 candidate 工作区。
4. RED：证明当前缺少 Mingshuo fact-pack checker，无法机器校验证据绑定和禁止外部效果。
5. Contract and schema：新增 V1 合同和 Draft 2020-12 closed schema。
6. Checker：新增只读 Node CLI，提供 validate、summary、`--check` 自检。
7. Tests：覆盖正向示例、HOLD、BLOCK、重复证据、未知字段、过期认证、外部发布、自动知识晋级、危险指令、输出稳定性。
8. Verification：运行 focused tests、checker check、root Harness、self-test、doctor、authority regression、V2 check/tests、diff check。
9. Review：独立 Governance、Product/Python-design 与 Security Review；任一 P0/P1/P2 为 NO-GO。
10. Freeze and land：计算 exact4 identity 与证据摘要，通过后唯一 candidate commit 普通快进。

## Implementation Report

尚未实施产品字节。本计划只冻结 successor 边界。当前可用输入为 G5 vertical target、G4 observation checker 和 current full-matrix refresh，它们不授权 Mingshuo runtime。

## Acceptance Review

当前计划为 `DRAFT / NON_AUTHORIZING`。它不会绕过 product authority，不会连接外部系统，不会发布，不会使用客户数据。产品身份只来自本 successor 的 machine GO、exact4 重新物化、完整验证、独立三审和普通快进落地。

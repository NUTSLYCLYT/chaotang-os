# Mingshuo Solution Hub V1 Fact Pack Blueprint Successor

任务 ID：`MINGSHUO-SOLUTION-HUB-V1-FACT-PACK-BLUEPRINT-SUCCESSOR-20260904`

冻结基线：`origin/ext-dev@4983576370cee1f1de8cbb4a3dca97352064bde2`

冻结 tree：`89e92f2785a550300a42abf36a3792f850cc3f27`

> 治理状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`
>
> 本 successor 只新增铭硕项目事实包的离线合同、JSON Schema、非授权校验器和测试。它不接入 IMA、不读取真实客户数据、不生成 UI、不发布、不写史馆、不控制设备、不生成可执行工艺配方。

## Status

Draft

## Product Definition

铭硕方案中枢需要把电芯、PACK/电源、光储充系统和设计解决方案的资料变成可复核、可交付、可回写的业务闭环。当前主线已有上书房、Scene Pack、史馆、军机处、鸿胪寺、Claim-Evidence、WorkProduct 和能力协议基础，但还缺少一个“项目事实母表”的最小合同。

本包目标是新增 `MingshuoProjectFactPackV1` 蓝图：

- 记录租户、项目、产品线、目标市场、语言和版本；
- 记录事实项、证据引用、证据等级、有效期、审批状态和缺失项；
- 区分 public candidate、supplier asserted、internal measured、third-party verified、frozen released；
- 对宣传主张、报价、认证、交期、质保、危险技术说明和知识回写做 fail-closed；
- 输出稳定校验摘要，供后续 Mingshuo 工作台和产品军团复用。

## Acceptance Criteria

- [ ] approval commit 必须是 `4983576370cee1f1de8cbb4a3dca97352064bde2` 的直接单亲子，只包含本 approval、Task、Plan 三条治理路径。
- [ ] product authority 对本 task 返回 `GO / APPROVED_FOR_ONE_CHILD` 后，才允许 exact4 candidate。
- [ ] exact4 candidate 只允许新增 `docs/contracts/mingshuo-project-fact-pack.schema.json`、`docs/contracts/mingshuo-project-fact-pack.v1.md`、`scripts/mingshuo-fact-pack.mjs`、`scripts/mingshuo-fact-pack.test.mjs`。
- [ ] Schema 必须是 closed contract，拒绝未知字段、重复证据 ID、未知证据等级、无证据 claim、过期认证、无 price authority 报价、未授权外部发布和自动知识晋级。
- [ ] 校验器必须保持 `nonAuthorizing: true`，不得声明 SKU 性能、生产资格、客户成功、外部发布或设备/工艺 release。
- [ ] 测试必须覆盖 3-5 个 SKU 候选位可保留但不得虚构参数；缺关键 evidence 时输出 `HOLD`；安全或权限冲突输出 `BLOCK`。
- [ ] 完整验证矩阵必须通过：focused Node tests、contract check、root Harness、Harness self-test、doctor、product-authority regression、V2 check/tests 和 `git diff --check`。
- [ ] 独立 Governance、Product/Python-design 与 Security Review 不得存在未关闭 P0、P1 或 P2。

## Delivery Constraints

- 不修改 `backend/app/**`、`frontend/src/**`、数据库、API、认证、租户、史馆存储、军机处存储、Harness runtime 或 product authority。
- 不接入 IMA、MCP、LangGraph、外部大模型、Alibaba、官网、小程序、邮件、RFQ、真实客户数据或生产凭据。
- 不生成可直接执行的危险化学配方、设备参数、联锁绕过、EHS 绕行或质量放行指令。
- 不把客户项目输出自动晋级为公开产品真值；知识回写只能是 candidate。
- 不声明 businessSuccessMeasuredFamilies 大于 0，不声明 productionPromotionAuthorized。
- 不使用旧 donor approval、candidate、machine GO、验证、审查或通过身份。

## Affected Modules

- 模块：铭硕项目事实包合同、离线 schema、非授权校验器和校验器测试。
- 允许路径：`docs/contracts/mingshuo-project-fact-pack.schema.json`；`docs/contracts/mingshuo-project-fact-pack.v1.md`；`scripts/mingshuo-fact-pack.mjs`；`scripts/mingshuo-fact-pack.test.mjs`。

## Technical Plan

1. 将本三文件 approval commit 普通快进落地到 `origin/ext-dev`。
2. 运行一次 canonical `product-authority.m0.v1 --authorize`，只接受本 successor 的 `GO / APPROVED_FOR_ONE_CHILD`。
3. 从 approval commit 创建唯一干净 candidate 工作区；禁止多个字节写入者。
4. 先写 RED：当前缺少 Mingshuo fact-pack contract/checker，无法机器区分 evidence-bound fact 与口头宣传。
5. 新增 JSON Schema 和合同文档，冻结字段、证据等级、状态、claim/price/certification/channel/knowledge fail-closed 规则。
6. 新增 Node checker，提供 validate/build summary/CLI check，完全离线、只读、非授权。
7. 新增 Node tests，覆盖正向最小包、缺证据 HOLD、危险指令 BLOCK、无授权外部发布 BLOCK、知识自动晋级 BLOCK、重复/过期/未知字段 fail-closed。
8. 运行完整验证矩阵与独立审查；通过后冻结 exact4 identity、combined diff、verification evidence 和 candidate evidence。
9. 只在全部通过后创建唯一 candidate commit 并普通 fast-forward；失败则保持未提交 evidence。

## Implementation Report

当前为治理 successor 草案。本轮没有产品字节、candidate、外部集成、客户数据、浏览器通过或上线声明。

已落地主线输入：

- G5 target：`docs/reviews/2026-09-04-g5-mingshuo-solution-hub-vertical-target.md`
- G4 observation checker：`scripts/business-entrance-observation.mjs`
- current full matrix refresh：`docs/reviews/2026-09-04-g6-current-head-full-matrix-refresh.md`

这些文件只提供边界和观察，不提供 Mingshuo fact-pack 产品身份。

## Acceptance Review

本 Task 当前为 `Draft`。通过边界如下：

- approval 三文件必须独立成为当前基线的直接单亲子；
- machine authority 必须重新对本 successor 返回 GO；
- exact4 candidate 必须重新物化、重新测试、重新审查；
- 任何远端漂移、machine STOP、路径扩张、runtime 修改、外部发布、真实客户数据、危险技术输出、自动知识晋级或独立审查 P0/P1/P2 均立即 STOP。

在上述条件全部满足前，本 successor 只能作为铭硕事实包蓝图治理边界，不是产品实现。

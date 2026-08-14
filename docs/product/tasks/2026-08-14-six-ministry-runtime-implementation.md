# 任务：EXT 六部能力在 ext-dev 的完整运行实现

> 所有任务必须阅读并遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；若任务与该基线冲突，必须标记为 `Blocked`，不得自行变更流程。

## Status

Accepted

## Product Definition

- 用户确认：2026-08-14 明确要求按既定顺序建立长时任务，在 `ext-dev` 中实现并跑通 EXT 六部精华能力。
- 来源：固定 `origin/feature-chaotang-ext@939186f0331d9784bc8c4ceee393aeb197230ed0`；整树 8,045 文件、六部相关 1,777 项的机器清单。
- 目标：把 1,777 项来源资产去重归并为能力族，并以 DEV 已有 39 个司级、6 个部级、1 个军机处 Runtime Skill 为唯一生产骨架，完成六部能力覆盖、确定性 evaluator、跨部合议、离线评测与无副作用端到端运行。
- “全部功能”的定义：每项来源资产必须且只能映射到一个能力族；每个能力族必须标记为现有覆盖、增强实现、新增实现或明确淘汰，并具有机器可验证的实现/阻断证据。复制库存、旧 UI adapter 和旧控制面不按文件数量重复实现。
- 非目标：不恢复 EXT FlowEngine/OpenClaw/Hermes/前端业务 Runtime；不提交、推送、部署、Canary 或生产晋级；不执行付款、发布、外联、任命、删除等外部副作用。

## Acceptance Criteria

- [x] 1,777 项六部资产全部进入去重能力矩阵，无遗漏、无重复归属、无静默排除。
- [x] 每个能力族具备稳定 ID、owner、EXT 来源、DEV RuntimeSkill 映射、触发/输入/输出、风险、副作用、实现状态和验收证据。
- [x] DEV 39 司、6 部、军机处继续是唯一运行事实源，不出现第二 Registry 或旧 Flow 回流。
- [x] 六部共享执行契约覆盖证据/缺口、责任/授权、租户/owner、预览/人工确认、失败状态、审计、跨部强制联审。
- [x] 吏、户、礼、兵、刑、工的现有 Runtime Skill 按能力矩阵完成契约映射、确定性规则增强，或明确证明已覆盖；需要真实 Evidence/authority 的成功分支保持机器可读降级。
- [x] 高风险动作仅生成 preview/draft，不发生外部写入；未授权能力必须失败关闭。
- [x] 每个能力族具备合成契约形状、缺证、冲突和越权/攻击案例；候选控制面的汇总指标由不可变逐案例账本重算。合成案例不计为业务成功。
- [x] 单部及跨部链路可在无密钥、无网络、无生产数据模式运行；缺 provider/真实数据的路径返回机器可读 `degraded`/`blocked`，不得伪造成功。
- [x] 独立代码、安全和测试复审无 P0/P1/P2。
- [x] 同一最终实现版本连续十轮授权范围验收通过。

## Delivery Constraints

- 任务级别：GOVERNED；使用 `codex-engineering-workflow` 与 `autonomous-loops` 的 RFC/DAG 模式。
- 允许路径：现有候选控制面、`docs/contracts/`、`docs/migrations/`、本任务文件、`backend/app/agents/runtime_skills/`、必要的六部/军机处适配层、`backend/harness/`、`backend/tests/`、`scripts/capability_*`、根 Harness 与 CI。
- 权限：本地代码、测试、文档写入已授权；外部消息、真实付款/发布、生产数据、凭据、网络、提交、推送、部署未授权。
- 数据：测试使用合成或脱敏 fixture、临时存储、假客户端；不得读写运行数据库或私人凭据。
- 兼容：ADR 0028、账户/租户隔离、锦衣卫证据服务、Tool Policy、审计和生产注册完整性不得降低。

## Affected Modules

- 模块：能力矩阵、RuntimeSkill 契约和声明、六部司级 evaluator、部级/军机处合议、Harness/Eval。
- 允许路径：`backend/app/agents/runtime_skills/`、`backend/tests/test_six_ministry_*.py`、`backend/harness/`、`docs/contracts/`、`docs/migrations/`、`docs/product/tasks/2026-08-14-six-ministry-runtime-implementation.md`、`scripts/capability_*`、`scripts/six_ministry_*`、`scripts/fixtures/`、`scripts/check_harness.mjs`、`.github/workflows/harness.yml`。
- 事实源：`backend/app/agents/runtime_skills/`。
- 候选/评测：`backend/harness/capability_candidates/` 与 `backend/harness/`。
- 项目治理：`scripts/check_harness.mjs`、`.github/workflows/harness.yml`。

## Technical Plan

1. P0：把 1,777 项资产编译为去重 capability-family DAG，冻结覆盖矩阵。
2. P1：在现有 RuntimeSkill 模型上补共享执行契约与兼容映射，不建立第二事实源。
3. P2：优先实现户部确定性财务/付款和吏部责任/招聘能力。
4. P3：实现礼部/兵部真实性、GTM、渠道、客户和对外草稿能力。
5. P4：实现刑部合同/合规/隐私以及工部产品/技术/供应/交付/质量能力。
6. P5：实现部级强制联审、军机处跨部合议和无副作用端到端链路。
7. P6：全能力 Golden/攻击评测、独立复审、去冗余和连续十轮验收。

## Implementation Report

- 改动摘要：固定 EXT 全树 8,045 文件，逐项登记 1,777 项六部来源资产，并去重编译为 23 个能力族（22 个活动族、1 个退役族）；22 个活动族精确覆盖 DEV 46 个权威 RuntimeSkill。新增共享执行契约、能力胶囊、财务/付款/责任链确定性分类器、礼兵刑工领域控制、能力族运行投影、部级/军机处无授权降级适配器，以及机器可读 Runtime 就绪报告。
- 自审：所有新运行对象 frozen/extra-forbid；候选、能力族、领域控制、付款和军机处均不授予外部副作用；不存在 EXT FlowEngine/OpenClaw/Hermes/前端业务 Runtime 回流，也不存在第二 RuntimeSkill Registry。纯分类结果不是授权，真实 Runtime 入口在缺少服务端 Evidence/authority resolver 时只能 `DEGRADED`。
- 验证：Runtime/六部扩展回归 1,005 项通过，其中六部专项 137 项；治理与安全 Node 测试 45 项通过；在可信证据脊柱接线后，根 Harness 132 个基线文件通过、Harness self-test 166 项通过。
- 连续验收：冻结实现指纹 `64e4f99b061f90ca4650796aff121891a6600f9a9b3ee1468e08cf29d42aeed1`；同一指纹连续 10/10 轮通过。每轮均执行上述 Runtime/六部回归、治理 Node 测试、根 Harness、Harness self-test、Ruff、compileall 与 `git diff --check`；单轮耗时 19–21 秒。
- 全仓诊断：后端全量运行得到 3,886 通过、4 跳过、8 失败；失败均位于未修改的既有路径，分别为 Linux 文件替换 identity 时序 1 项、Windows DPAPI `WinDLL` 在 Linux 运行 4 项、依赖未生成 `frontend/.next` 与旧 `.superpowers` 验收产物 3 项。未借本任务修改或豁免这些测试，详细阻断已写入机器就绪报告。
- 实际使用的 skill：`codex-engineering-workflow`、`autonomous-loops`。
- 未运行项：真实公网、真实 MCP、真实模型 provider、外部副作用、生产部署均不在授权范围。
- 剩余风险：生产业务成功尚未测量（0/22 个能力族），真实 authority resolver 尚未接入（0 个）。CRM、合同、财务、招聘、测试/交付等权威数据源，以及 owner/run/tenant 绑定的 Evidence Protocol、WorkProduct/Confirmation 和军机处批准路由，需要另开 GOVERNED 变更；在此之前所有相关链路只允许诚实降级。

## Acceptance Review

- 验收结果：Accepted（仅限 provider-free / network-free / side-effect-free 能力实现、契约运行和机器阻断范围）；生产成功路径未授权、未宣称完成。
- 验收证据：`docs/migrations/2026-08-14-six-ministry-capability-family-matrix.json`、`backend/app/agents/runtime_skills/capability_family_bindings.json`、`docs/migrations/2026-08-14-six-ministry-runtime-readiness.json`、六部 Python 回归、治理 Node 回归和根 Harness。
- 独立复审：最终代码与安全攻击复审结论 `APPROVE`，P0=0、P1=0、P2=0；确认不存在本地 trusted issuer、自授 authority 或外部副作用授权。
- 未通过项：真实生产数据/权限解析、真实模型 A/B、真实 shadow/canary、外部动作和生产晋级均不在本次授权范围；机器就绪报告明确记录为 `businessSuccessMeasuredFamilies=0`、`authorityResolversConnected=0`。

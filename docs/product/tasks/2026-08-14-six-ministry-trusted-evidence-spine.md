# 任务：六部可信证据脊柱

> 所有任务必须阅读并遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；若任务与该基线冲突，必须标记为 `Blocked`，不得自行变更流程。

## Status

Accepted

## Product Definition

- 用户确认：用户于 2026-08-14 同意按顺序完成六部可信证据闭环，并要求冻结输入、输出、错误和授权标准。
- 问题：六部 RuntimeSkill 与确定性能力已存在，但真实 Evidence、owner、批准 route、WorkProduct/Confirmation 与军机处权威之间尚无统一受控桥梁，非户部领域缺少真实权威源时只能降级。
- 目标用户：通过上书房下旨并在单部或军机处路径获得可追溯专业裁决的已认证用户，以及维护 Harness/审计的工程人员。
- 目标：建立一个不成为第二事实源的统一证据脊柱；由服务端装配 owner/route/skill/authority，按户部→吏部→刑部→工部→兵部→礼部形成统一机器裁决，并在缺证时失败关闭。
- 非目标：不新增下旨/API 入口、不改变四节点 LangGraph 或 46 个 RuntimeSkill 唯一注册中心；不授权真实公网、模型 provider、生产数据、凭据、付款、发布、任命、通知、删除、提交、推送或部署。

## Acceptance Criteria

- [x] closed JSON Schema 冻结 `decision_request` 与 `decision_envelope`；输入只允许 objective、严格材料引用和有界 constraints。
- [x] 当前身份范围明确为 `scope_mode=owner_only`、`tenant_id=null`，禁止调用者传 owner/tenant/verified/approved/权限/工具/状态/URL/路径。
- [x] 输出冻结 `completed|degraded|failed`、`preview|hold|block`、facts/findings/risks/conflicts/missing/next actions/artifact/evidence/audit refs、稳定错误及 `external_effects.authorized=false`。
- [x] 服务端从 `CurrentUser`、获批 `DecreeJob`、RuntimeSkill registry 与 owner-scoped stores 装配并复核身份、route、skill、材料和 authority。
- [x] 户部使用 owner-scoped 会计评估实现真实 accounting grounding，并只生成无副作用的付款/财务 WorkProduct preview。
- [x] 吏部在缺少已批准人员/岗位 authority source 时输出机器可读降级，并为未来 source adapter 保留唯一接口而非新数据库。
- [x] 刑部在缺少已批准合同/合规 authority source 时输出机器可读降级，不把模型知识当法律事实。
- [x] 工部在缺少已批准产品/交付/质量 authority source 时输出机器可读降级，不把 synthetic fixture 计为业务成功。
- [x] 兵部在缺少已批准 CRM/销售 authority source 时输出机器可读降级，不推断客户状态。
- [x] 礼部仅从 adopted Evidence 生成 citation draft；不发生发布，不把 draft 视为事实认证。
- [x] 多部 route 必须重载真实 owner-scoped 军机处完成态与 receipt；未完成则 `JOINT_REVIEW_REQUIRED`，不伪造部议。
- [x] owner 隔离、摘要/版本漂移、字段走私、跨部绕过、证据冲突/过期、audit 失败与副作用探针均通过离线对抗验证。
- [x] 根 Harness/CI 接线、全量回归、独立代码/安全复审通过，并对生产未验证范围保持机器阻断证据。

## Delivery Constraints

- 范围：GOVERNED；复用现有 Evidence Protocol、账户 owner、RuntimeSkill、WorkProduct/`ConfirmationReceipt`、`DecreeJob` 与军机处权威。
- 兼容性：遵守 ADR 0018、ADR 0027、ADR 0028、ADR 0029、ADR 0036、ADR 0037；不建立第二 Evidence/authority/tool/runtime registry。
- 风险与限制：当前没有 tenant authority，tenant 必须 null；吏/刑/工/兵缺权威源时只能降级；所有外部副作用 false。
- 技能计划：`codex-engineering-workflow`、`api-and-interface-design`。
- Codex-only：是；禁止通过外部 runner 绕过仓库 authority 或测试。

## Affected Modules

- 模块：统一输入输出契约、服务端证据/authority 装配、六部领域投影、军机处跨部联审、Harness/Eval。
- 允许路径：本任务与 ADR/contract；`backend/app/agents/runtime_skills/` 内受控桥梁；既有事实源的最小 owner-scoped adapter；`backend/tests/test_six_ministry_*`；`backend/harness/`；`scripts/six_ministry_*`；根 Harness/CI。
- 依赖模块：Evidence Protocol、`CurrentUser`、`DecreeJob`、RuntimeSkill registry、owner-scoped 会计/锦衣卫/军机处 storage、`WorkProduct`、`ConfirmationReceipt`。

## Technical Plan

- 架构边界：实现“一脊柱、六投影、三道门、双裁决”。脊柱拥有装配顺序但不拥有事实；投影器只消费服务端重载材料；Evidence 门、authority 门和无副作用门全部确定性失败关闭。
- 接口与依赖：以 `docs/contracts/six-ministry-evidence-spine.schema.json` v1 为唯一交换形状；Capability、部门、skill 由批准 route + registry 解析，不出现在 request。
- 实施顺序：修复后端基线 → 冻结契约 → 户部真实 grounding/preview → 吏部降级 → 刑部降级 → 工部降级 → 兵部降级 → 礼部 citation draft → 军机处跨部 → Harness/复审。
- 验证计划：Node schema contract；Python 单元/集成/owner 隔离/对抗；无网络无密钥真实本地数据链；全后端与 Harness；独立代码和安全复审。
- 技术风险：引用形状不能证明对象真实，运行时必须重载；audit 失败不能吞掉；旧 compatibility overlay 中的非 null tenant 不得被误用为当前权威。

## Implementation Report

- 改动摘要：在 ADR 0044 与 closed Schema 之上新增统一 `resolve_six_ministry_decision` 服务；CurrentUser/DecreeJob/RuntimeSkill/Jinyiwei/Accounting WorkProduct/ConfirmationReceipt 均由服务端重载。新增 owner/run/route 绑定的军机处 typed report store 与追加式 Runtime binding ledger；礼部只消费 `CONFIRMED` adoption，吏/刑/工/兵缺域权威源时输出明确机器阻断。
- 基线修复：无效旨意不再在 Pydantic 422 前打开 DecreeJob 数据库；测试目录显式成为本仓包，避免第三方 `site-packages/tests` 劫持；崩溃恢复测试改为真实的新进程/新客户端边界。既有 source-manifest、跨平台 DPAPI seam 与合成验收外部产物依赖也保持修复状态。
- 可信边界：request 无 identity/routing/trust/authority/URL/path/tool 扩展点；tenant 固定 null；调用者不能注入 evidence/authority/report projection。会计内容摘要按签发时 `PENDING` 轴校验，人工回执另行 owner-scoped 重载并写入不可变账本；确认仍不授予付款或过账。
- 军机处：案卷绑定 owner/run/decree/draft/route；部报按批准部门顺序与权威 RuntimeSkill identity 追加保存，禁止更新/删除；统一服务只按 ID 重载完整快照，集合、证据或路由不符即失败关闭。
- 实际使用的 skill：`codex-pro-workflows`、`codex-mastery-coach`、`test-driven-development`、仓库 `codex-engineering-workflow`、`code-review` 与 `security-review`；仓库声明的 `using-superpowers` 文件缺失，按既有 Superpowers 等价质量门执行。
- 验证：冻结实现指纹 `sha256:b5cd11b83f40704f1cc33f74c44672daa115bc2472033b08141e62280625d3fd`；六部可信证据、军机处、异步恢复、持久预算接管、取消/截止边界与史馆链专项 `532 passed, 2 skipped`；后端全量 `3994 passed, 4 skipped`；Ruff 全仓与 compileall 通过。
- 治理验证：八个 Node 治理/契约套件 `50/50`；根 Harness `133` 个基线文件、self-test `167` 项；Stop hook self-test `3` 项；依赖一致性与 `git diff --check` 通过。
- 连续验收：同一冻结实现指纹连续 `10/10` 轮通过；每轮均执行全后端回归、八个 Node 套件、根 Harness、Harness self-test、Stop hook self-test、Ruff、compileall、依赖检查、工作树与暂存区 `git diff --check`，单轮全量后端耗时 `216–229` 秒。
- 未执行：真实公网、provider、生产业务库、任何外部写、部署、提交与推送均未授权也未发生。
- 剩余风险：HR/任免、合同/法规、项目验收、CRM/报价等域权威源尚不存在，因此相应部门按设计保持 `degraded/hold`；tenant authority 未实现；真实公网、provider、生产数据与外部副作用仍未验证且继续机器阻断。

## Acceptance Review

- 验收结果：PASS（仅限 owner-scoped、provider-free、network-free、side-effect-free 范围）。
- 验收证据：实现指纹、全后端 `3994/4`、专项 `532/2`、Node `50/50`、Harness `133/167`、Stop hook `3/3`、Ruff、compileall、依赖检查与差异检查均通过；代码、Python 与安全三轨复审为 `approved-with-notes`，P0=`0`、P1=`0`、P2=`0`。
- 未验证项：生产数据源、tenant authority、真实 provider/公网、外部写、部署与合并不在本阶段授权范围，未被本 PASS 覆盖。

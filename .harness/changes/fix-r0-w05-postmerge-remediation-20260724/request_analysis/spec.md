# 规格说明：fix-r0-w05-postmerge-remediation-20260724

## 背景

W05 候选 `61dfef3607000709be2e9955821c0e47fe16574d` 已通过 Gitee MR !16
进入 merge commit `3cb508e06464de78facae09b93c132eb16023f94`，两者 tree 相同。
合并后独立 Standards/Spec、API/安全和数据/迁移复核确认六个 MUST：

1. 最终 exact evidence 仍绑定旧 H，且记录状态仍是等待独立复审。
2. `DecisionTask` 的 canonical 创建入口不能冻结 `contract_scope`，真实正向链不可达。
3. 法律问题不在 typed support scope 内，无法 fail closed 到 `NEED_LEGAL_REVIEW`。
4. generation 的领域状态与 outbox 持久化执行状态共用 `status`，终态重放违反公共契约。
5. evidence bind 在 worker 推进后先按状态 409，不能幂等返回同一 packet/generation。
6. `CONFLICTED` / `STALE` 只有枚举，没有确定性生产规则和公共 API 证据。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | merge tree 与候选 tree 相同，但 evidence 仍钉旧 H | `git show 3cb508e`、原 W05 implementation summary | Codex 独立复核 | 是 |
| 已确认事实 | v2 只允许 W05；W06 被依赖门阻断 | `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W05/R0-W06` | 机器权威 | 否 |
| 已确认事实 | task kernel 无 scope 入参，bind 又拒绝首次初始化 | `backend/src/decision_task_kernel.py`、`backend/web/routers/shangshufang.py` | 调用链复核 | 是 |
| 已确认事实 | payload 领域状态和 outbox durable status 被覆盖混用 | generation contract、outbox worker、replay helper | 契约与状态矩阵复核 | 是 |
| 已确认事实 | accepted upload 当前只能生产 `GROUNDED` | evidence bind producer | 代码与测试检索 | 是 |
| 未知问题 | PostgreSQL 019–022 迁移未在真实 PostgreSQL 演练 | 本地证据只有 SQLite | 后续 release/CI 环境 | 否；非本 Packet MUST |

## 数据流与调用链

```text
POST /api/shangshufang/draft-edict
  -> ContractIntakeV1（用户显式结构化输入；不从自然语言猜）
  -> create_decision_task()
  -> DecisionTask.contract_scope_json（创建时冻结）
  -> FinalMemorial
  -> request_evidence
  -> EvidenceReworkGenerationV1（创建时快照冻结 scope）
  -> secure-ingest accepted immutable artifact
  -> evidence status 确定性分类
  -> EvidencePacketV1
  -> outbox worker revalidate
  -> ContractReviewPackV1 / quality + provenance gate
  -> typed task decision / evidence bind response
```

`contract_scope` 只能在 canonical task 创建时写入。补证绑定可以验证调用方提供的
scope 与冻结值相同，但不能创建或替换事实源。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `ContractIntakeV1.legal_question` | 后端 Pydantic/OpenAPI；显式结构化输入 | support evaluator、generation、review pack | 仅 `contract_risk_screening` 受支持；缺失或 sentinel 均 `DECLINED`；旧 JSON fail closed |
| `DecisionTask.contract_scope_json` | `create_decision_task()` 唯一 writer | evidence bind、contract rework | 现有列已由 migration 021 提供；本 Packet 不新增 migration |
| `EvidenceReworkGenerationV1.status` | W05 领域流程 | API、worker | 只表示 awaiting/bound/pending/candidate/blocked 等领域阶段 |
| generation replay projection | `OutboxEvent.status` + immutable payload | task/brief decision、bind retry、CAS loser | `processing` 投影为 `pending`；`completed` 只能投影 payload 的 candidate/blocked；failed/dead-letter/superseded 为 409；非法组合为 500 |
| `EvidenceReworkGenerationV1.evidence_status` | packet 集合的确定性投影 | 公共 API、质量门 | 无 packet=`NONE`；单 packet=其状态；不允许与 packets 漂移 |
| artifact evidence classification | immutable secure-ingest artifact + 当前文件摘要 + 同任务同文件名版本序 | bind、worker revalidation | 文件身份变化/存在更新版本=`STALE`；无明确 supersession 的不同摘要版本=`CONFLICTED`；否则 `GROUNDED` |
| typed task decision response | FastAPI response model | 前端/调用方/OpenAPI | replay 后再次 Pydantic 校验，不输出契约外状态 |

## 范围

- canonical draft task 接受并冻结显式 `ContractIntakeV1`。
- support scope 增加一个最小 typed 法律问题类别：
  `contract_risk_screening`；缺失或 `UNSUPPORTED_OR_UNKNOWN` 只能进入法律复核。
- generation 创建时快照 task 的冻结 scope；bind 只能核对，不能初始化或替换。
- generation 领域状态不再被 outbox durable 状态覆盖；所有入口复用同一个纯投影
  Interface。
- evidence bind 对同一 artifact 在 `pending/processing/completed` 下幂等重放；
  `failed/dead_letter/superseded` 继续显式 409。
- evidence bind 成功时 payload 领域状态为 `evidence_bound`，durable outbox 状态为
  `pending`；继续兼容消费历史 `evidence_bound` durable row。
- accepted immutable upload 依据可复验的版本身份生产 `GROUNDED/CONFLICTED/STALE`；
  非 grounded 始终阻断 promotion。
- 更新 exact candidate、RED/GREEN、验证和复审证据。

## 非目标

- 不修改前端、视觉、BFF 或浏览器按钮。
- 不启动、实现或暗中预埋 W06–W09。
- 不引入 LangGraph、第二事实源、第二任务 writer 或通用合同法律模型。
- 不从自然语言、文件正文或模型输出猜测法域、角色或法律问题 scope。
- 不处理 PostgreSQL 发布演练、生产开关、真实客户数据或生产 provider。
- 不推送、不创建/合并 PR、不发布、不切换生产。
- 不在本 Packet 把 W05 ledger 改成 `MERGED_AND_VERIFIED`。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| draft 没有显式 contract scope | task 仍可创建；W05 合同重审 fail closed 到法律复核 | API + DB RED/GREEN |
| scope 完整且法律问题为 `contract_risk_screening` | 创建时冻结，并在 request_evidence 时快照进 generation；补证链可达 | 公共 API + DB seam |
| scope 缺失、sentinel 或原始陌生值 | 缺失/sentinel=`NEED_LEGAL_REVIEW`；陌生值 422 | support/worker/OpenAPI tests |
| durable status 为 processing | replay 返回合法领域状态 `pending` | contract/API tests |
| durable status 为 completed | 只允许 payload 的 `candidate_ready/quality_blocked` | contract/API tests |
| durable status 为 failed/dead_letter/superseded | 409 且包含 authoritative 状态/错误；不伪装成功 | API tests |
| 同一 artifact 在 worker 推进后重试绑定 | 返回同一 packet/generation，不追加 audit/packet | DB/API idempotency tests |
| 不同 artifact 对已绑定 generation 重试 | 409，不覆盖 winner | DB/API tests |
| artifact 文件摘要与 immutable row 不同 | `STALE`，quality/provenance gate 阻断 | local file + DB test |
| 同任务同文件名有更新的不同 digest 版本 | 旧版本 `STALE` | DB test |
| 选择最新但存在未声明 supersession 的不同 digest 版本 | `CONFLICTED`，不得晋升正式奏折 | DB/worker test |
| 无 packet | generation API 明确 `evidence_status=NONE` | contract/API test |

## 风险与回滚边界

最大风险是为了补状态枚举而再造一套结果模型，或把不同版本自动判成“新版本覆盖旧
版本”。控制方式是：durable 状态只通过一个纯投影 Interface 解释，不进入领域枚举；
artifact 版本冲突只 fail closed，不自动裁定真伪或 supersession；所有 scope 只接受
显式 typed 输入。worker 在 PostgreSQL 最终重验前对 `secure_ingest_artifacts`
取得短时 SHARE publication fence；这会阻塞所有租户的新 artifact INSERT。真实
PostgreSQL 的应用角色锁权限、lock wait 与吞吐未在本 Packet 演练，继续作为 release
风险；锁失败时 worker fail closed，不允许无围栏发布。

回滚时整体 revert 本 Packet 的单一候选提交并关闭 W05 flag。现有 W05 表、历史
generation、奏折和审计不删除、不重解释；本 Packet 不含 schema migration。

## 计划确认记录

- 批准人：Product Owner（`lyt`）
- 批准日期：2026-07-24
- 批准范围：以 exact merge `3cb508e06464de78facae09b93c132eb16023f94`
  为 base 的一个 `R0-W05-POSTMERGE-REMEDIATION` 单写者 Packet，仅修复独立审查 MUST。
- 明确未批准：W06、推送、PR、合并、发布、生产切换、真实客户数据、范围外顺手修复。

## 验收标准

- 六项 MUST 均先有行为 RED，且失败原因不是 import/fixture/环境错误。
- canonical task 创建入口能冻结完整 scope；补证入口不能初始化或替换它。
- missing/unsupported legal question 稳定 fail closed，支持类别可走正向链。
- replay 输出始终通过唯一投影 Interface、`EvidenceReworkGenerationV1` 和 FastAPI
  response model。
- pending/processing/completed 下相同 evidence bind 幂等；failure/superseded 状态
  诚实失败。
- `NONE/GROUNDED/CONFLICTED/STALE` 至少各有真实 DB/file seam 证据。
- 非 grounded packet 不创建 current FormalMemorial。
- 相关回归、Ruff、authority、root/backend doctor 与 diff check 全绿。
- 候选 exact SHA 独立 Standards/Spec 双轴审查 `0 MUST`。
- W06 全程 `STOP`；无 push/merge/release。

## 验证计划

先运行最窄的新测试并记录 RED；每一行为簇做最小 GREEN 后重跑同一命令。聚焦
GREEN 后运行全部 changed backend tests、W05/W04 canonical 回归、authority v2、
amendment check、root/backend doctor、Ruff 与 `git diff --check`。冻结本地候选
commit 后，从该 exact SHA 创建干净 detached review worktree，执行 Standards/Spec
双轴独立复审。

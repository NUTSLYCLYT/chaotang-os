# 规格说明：feat-r0-w05-evidence-rework-implementation-20260723-20260723

## 背景

W05 获得 exact Owner approval、专属 review evidence 和机器 GO。当前
`request_evidence/followup` 只把 task/review 设为 `awaiting_evidence`，却让旧
`FinalMemorial.status=ready_for_decision` 保持可裁决，用户随后仍能 adopt 旧内容。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | W05 authority 为 GO | authority CLI / 2026-07-23 | 机器验证 | 否 |
| 已确认事实 | 补证后旧奏折仍可 adopt | 新公共 API RED | pytest | 否 |
| 推测 | 无 | 不适用 | 不适用 | 否 |
| 未知问题 | 新 generation 与新奏折版本尚未实现 | 后续纵切 | TDD | 是，但不阻塞本纵切 |

## 数据流与调用链

`POST decision(request_evidence)` → task/review awaiting evidence → current old FinalMemorial
失去 `ready_for_decision` → 后续 `POST decision(adopt)` fail closed。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| 裁决状态转移 | `apply_task_decision` | 两个公共裁决入口 | 共享函数保证语义一致 |
| 正式奏折裁决资格 | `FinalMemorial.status` | adopt gate | 只有 `ready_for_decision` 可裁决 |

## 范围

已实现：

- 补证动作立即关闭旧正式奏折的裁决资格；
- 当前存在正式奏折时，补证必须携带 `expected_final_memorial_content_hash`；
- 请求 hash 与 current 不一致时，在任何裁决/状态写入前 fail closed。
- `EvidencePacketV1` 绑定 tenant/task/input version/digest、prior memorial hash、generation、source/content hash。
- `MANUAL_TEXT`、`URL`、`MODEL_ASSERTION` 不得自升 `GROUNDED`；任何 `GROUNDED` 必须绑定 verification receipt。
- `ContractRiskItemV1` 绑定 evidence packet、风险级别、来源标签与 engine tier。
- critical/high 风险必须绑定 file version、page/clause locator 和 raw excerpt；
  medium/low 缺完整原文锚点时必须显式声明 `missing_evidence`。
- `ContractReviewPackV1` 绑定现有 tenant/task/MissionContract/CourtReview 和 evidence packet；
  只能形成 `CANDIDATE`，不建立第二 review 或正式结果事实源。
- 未解决 critical 风险不得输出 `PROCEED_TO_HUMAN_APPROVAL`；任一支持维度超范围只能
  `NEED_LEGAL_REVIEW`；风险项不得引用 pack 外的 evidence packet。
- 复用 canonical `OutboxEvent` 作为 rework generation 事实源；新增 nullable
  `generation`/`idempotency_key`，旧 outbox 行不补造身份。
- 同一 task、exact prior FinalMemorial hash、reason 和 followup question 形成同一个
  幂等 fingerprint；网络重试复用 generation，不重复写裁决/loop。
- 没有 prior FinalMemorial 的既有补证状态流不创建虚假 generation。
- 只有同 tenant、同 task、状态为 `ACCEPTED` 的 W03 `SecureIngestArtifact` 才能绑定等待中的
  rework generation；绑定形成 `EvidencePacketV1`，保存在同一 outbox generation payload。
- Slice 4B 先让 packet 绑定 artifact id/digest、exact prior memorial hash、generation 和可验证
  secure-ingest receipt，并停在 `evidence_bound` 证明边界；Slice 4C 再显式接通 worker。
- 同一 artifact 的绑定重试返回同一 packet，不追加副本；不同/无权/未验收 artifact fail closed。
- generation 不可变保存 evidence request 与 `affected_sections=["contract_review"]`；
  不让 worker 根据丢失的上下文猜测重算范围。
- 绑定完成后 canonical outbox 状态进入 `pending`，由既有 poller/worker 消费 `evidence.rework`。
- worker 重新校验 artifact 字节 digest，安全抽取 DOCX 文本，只替换现有 CourtReview 的
  `contract_review` section；其他 section 原样保留，task/review 回到 `reviewing`。
- canonical 任务尚未持久化冻结支持维度，因此候选必须 `NEED_LEGAL_REVIEW`；DOCX 总页数不得
  冒充原文位置，风险项以 medium + 显式 missing evidence 诚实记录定位缺口。
- 旧 generation 迟到时不读证据、不改 review，outbox 状态为 `superseded` 并保留审计。

## 非目标

不实现质量门最终放行、新奏折版本或前端。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 当前奏折存在且 ready，hash 匹配 | 补证后转为 awaiting evidence，不可 adopt | 新 RED/GREEN |
| 当前奏折存在，hash 缺失 | fail closed，不写裁决或状态 | slice 2 RED/GREEN |
| 当前奏折存在，hash stale/伪造 | fail closed，task/formal 状态不变 | slice 2 RED/GREEN |
| 非空手工文本、URL、模型自述声称 GROUNDED | ValidationError | slice 3A RED/GREEN |
| 用户上传无 verification receipt 声称 GROUNDED | ValidationError | slice 3A RED/GREEN |
| VERIFIED_TOOL 有 receipt | 接受 GROUNDED packet | slice 3A GREEN |
| critical/high 缺 file version、locator 或 raw excerpt | ValidationError | slice 3B RED/GREEN |
| medium/low 缺完整锚点且未声明缺证 | ValidationError | slice 3B RED/GREEN |
| medium/low 缺完整锚点但明确声明缺证 | 接受风险项但不伪造原文定位 | slice 3B GREEN |
| 未解决 critical 风险却输出 PROCEED_TO_HUMAN_APPROVAL | ValidationError | slice 3C RED/GREEN |
| 任一法域/语言/合同类型/交易角色超范围却输出普通裁决 | ValidationError | slice 3C RED/GREEN |
| 超范围且输出 NEED_LEGAL_REVIEW | 接受 candidate | slice 3C GREEN |
| 风险项引用 pack 外的 evidence packet | ValidationError | slice 3C RED/GREEN |
| 同一补证要求重复提交 | 返回同一个 generation 2，不重复写入 | slice 4A RED/GREEN |
| 旧 outbox 库升级到 019 | 保留旧行，新增列为 NULL，重复 generation/key 由 DB 拒绝 | slice 4A migration RED/GREEN |
| 尚无 prior FinalMemorial 时要求补证 | 保持既有 awaiting_evidence，不伪造 generation | slice 4A 扩大回归 |
| accepted secure-ingest artifact 绑定等待 generation | 返回 GROUNDED EvidencePacket，generation=evidence_bound | slice 4B RED/GREEN |
| 同一 artifact 重复绑定 | 返回同一 packet，不追加副本 | slice 4B RED/GREEN |
| Slice 4B generation evidence_bound | 当时不进入 pending，不被 worker 提前消费 | slice 4B 历史状态契约 |
| generation payload 缺补证要求/受影响 section | worker 不得猜；generation 必须保存 exact request | slice 4C RED/GREEN |
| current evidence.rework pending | 只替换 contract_review，其他 section 不变 | slice 4C RED/GREEN |
| DOCX 只有总页数无可靠定位 | 不伪造页码；medium + missing evidence + NEED_LEGAL_REVIEW | slice 4C RED/GREEN |
| generation 2 迟到且 generation 3 已存在 | generation 2=superseded，current review 不变 | slice 4C RED/GREEN |
| 没有正式奏折 | 保持既有 task/review awaiting evidence 行为 | 既有参数化回归 |
| 已拒绝/归档奏折 | 补证不把它重新打开 | 只转换 ready 状态 |

## 风险与回滚边界

风险是误把其他终态重新打开；实现只匹配 `ready_for_decision`。回滚为撤销单一状态更新和测试，
不会迁移数据。

## 计划确认记录

- 批准人：Product Owner（lyt）
- 批准日期：2026-07-23
- 批准范围：R0-W05 获批后端 Packet
- 明确未批准：W06–W09、前端、真实数据、LangGraph、推送/合并/发布/生产

## 验收标准

公共 API 测试先因旧奏折仍可 adopt 而 RED；最小实现后该测试与既有 reject、双入口一致性测试全绿。

## 验证计划

运行单一新增测试记录 RED，再运行新增测试 + 两个相邻回归记录 GREEN。

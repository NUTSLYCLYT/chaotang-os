# 任务：feat-r0-w05-evidence-rework-implementation-20260723-20260723

## 任务 1：补证立即关闭旧奏折裁决资格

- 目标：补证后旧正式奏折不能再被 adopt。
- 前置条件：R0-W05 authority GO。
- 输入：已 formalized 的任务和公共 `request_evidence` 裁决。
- 输出：旧奏折进入 `awaiting_evidence`，后续 adopt fail closed。
- 涉及文件：`backend/web/routers/shangshufang.py`、`backend/tests/test_final_memorial_gate.py`。
- 状态 / 数据变化：仅将当前 `ready_for_decision` 奏折推进为 `awaiting_evidence`。
- 验证命令与证据：CI summary 中的 RED/GREEN 命令。
- 回滚边界：撤销状态更新；无 migration。
- 完成定义：新增公共 API 测试和两个相邻回归全绿。

## 任务 2：补证绑定精确 current content hash

- 目标：旧页面、缺版本或伪造版本的补证请求不能改变 current task/final。
- 前置条件：任务 1 GREEN，status API 已公开 `formal_memorial.content_hash`。
- 输入：`expected_final_memorial_content_hash`。
- 输出：匹配时进入补证；missing/stale 时 fail closed。
- 涉及文件：`backend/web/routers/shangshufang.py`、`backend/tests/test_final_memorial_gate.py`。
- 状态 / 数据变化：校验发生在 EmperorDecision 与状态写入前；拒绝请求无持久化变化。
- 验证命令与证据：missing RED→GREEN、stale RED→GREEN，相关回归 5 passed。
- 回滚边界：撤销请求字段与前置校验；无 migration。
- 完成定义：正确 hash 保持纵切 1 行为，missing/stale hash 均失败且 stale 状态不变。

## 任务 3A：EvidencePacketV1 可信晋升门

- 目标：把“内容存在”与“证据可信”分开建模。
- 前置条件：W05 authority GO；沿用既有 Pydantic contract 规范。
- 输入：版本化输入、prior memorial、generation、source/content identity、verification receipt。
- 输出：`EvidencePacketV1`。
- 涉及文件：`backend/src/contracts/evidence_packet.py`、`backend/tests/test_evidence_packet_v1.py`。
- 状态 / 数据变化：纯契约，无数据库写入。
- 验证命令与证据：自述来源 3 个 RED；无收据上传 RED；最终 5 passed。
- 回滚边界：删除独立 contract/test；无 migration。
- 完成定义：自述来源不能 GROUNDED，所有 GROUNDED 有 receipt，验证工具正例通过。

## 任务 3B：ContractRiskItemV1 原文锚定门

- 目标：高风险结论必须可定位到原文；较低风险缺锚点时不得掩盖证据缺口。
- 前置条件：任务 3A GREEN；沿用既有 Pydantic contract 规范。
- 输入：evidence packet identity、file version、page/clause、raw excerpt、risk level、missing evidence。
- 输出：`ContractRiskItemV1`。
- 涉及文件：`backend/src/contracts/contract_risk_item.py`、`backend/tests/test_contract_risk_item_v1.py`。
- 状态 / 数据变化：纯契约，无数据库写入。
- 验证命令与证据：高风险锚点 3 个 RED；较低风险未声明缺证 RED；最终 5 passed。
- 回滚边界：删除独立 contract/test；无 migration。
- 完成定义：critical/high 具备完整原文锚点；medium/low 缺锚点时明确列出缺证。

## 任务 3C：ContractReviewPackV1 canonical 候选门

- 目标：在现有 CourtReview 下形成证据绑定、范围保守的合同审查候选，不创建第二事实源。
- 前置条件：任务 3A/3B GREEN；沿用 W02 冻结的支持维度和五裁决 taxonomy。
- 输入：tenant/task/MissionContract/CourtReview、EvidencePacket identity、风险项、范围与候选裁决。
- 输出：`ContractReviewPackV1`，固定为 `CANDIDATE`。
- 涉及文件：`backend/src/contracts/contract_review_pack.py`、`backend/tests/test_contract_review_pack_v1.py`。
- 状态 / 数据变化：纯契约，无数据库写入。
- 验证命令与证据：critical 放行 RED；4 个超范围普通裁决 RED；游离 evidence 引用 RED；最终 8 passed。
- 回滚边界：删除独立 contract/test；无 migration。
- 完成定义：critical 不放行、超范围只法务升级、风险项证据归属闭合、合法正例通过。

## 任务 4A：补证 generation 身份与幂等

- 目标：同一 exact prior memorial 上的同一补证要求只创建一个可追溯 generation。
- 前置条件：任务 1–3C GREEN；W04 canonical outbox/generation fencing 可复用。
- 输入：task、prior FinalMemorial content hash、reason、followup question。
- 输出：`EvidenceReworkGenerationV1` 响应投影和 canonical OutboxEvent 行。
- 涉及文件：`backend/src/db/models.py`、`backend/src/execution/decree_dispatcher.py`、
  `backend/web/routers/shangshufang.py`、Alembic 019 与相邻测试。
- 状态 / 数据变化：既有 outbox 新增 nullable generation/idempotency 字段；
  rework 行以 `awaiting_evidence` 保存，不被 pending worker 提前消费。
- 验证命令与证据：重复提交 RED 为 CourtLoopRun 唯一冲突；最小 GREEN 复用 generation；
  migration 保留旧行且数据库拒绝重复 generation/key。
- 回滚边界：降级 019 删除两个约束/列；旧 outbox 事实不删除。
- 完成定义：公共 API 重试幂等、旧库安全升级、相邻 execution/outbox/loop 回归全绿。

## 任务 4B：Verified EvidencePacket 绑定

- 目标：把 W03 已验收不可变输入绑定到等待中的 W05 generation，不信任文件名或客户端自述。
- 前置条件：任务 4A GREEN；SecureIngestArtifact 已 `ACCEPTED`。
- 输入：task、generation id、artifact id。
- 输出：generation-bound `EvidencePacketV1` 和 `evidence_bound` 状态。
- 涉及文件：`backend/web/routers/shangshufang.py`、`backend/tests/test_final_memorial_gate.py`。
- 状态 / 数据变化：更新 canonical outbox generation payload/status；不创建新表，不启动 worker。
- 验证命令与证据：bind endpoint 404 RED；最小 GREEN；重复绑定 RED/GREEN；
  W03/W05 公共 API 与安全摄取扩大回归 77 passed / 1 skipped。
- 回滚边界：撤销 bind endpoint 和 payload 状态转换；SecureIngestArtifact 与原 generation 保留。
- 完成定义：accepted 同任务附件形成 GROUNDED packet；重试幂等；generation 仍不被提前执行。

## 任务 4C：局部重算 worker 与 generation fencing

- 目标：让 evidence-bound generation 走现有 worker，只刷新声明的合同 section，并阻止迟到旧代覆盖。
- 前置条件：任务 4B GREEN；generation payload 包含 request、affected section 和 EvidencePacket。
- 输入：canonical `OutboxEvent(event_type=evidence.rework)`。
- 输出：现有 CourtReview 内的 `ContractReviewPackV1` candidate；旧代为 `superseded`。
- 涉及文件：`backend/src/contract_rework.py`、`backend/src/execution/outbox_worker.py`、
  dispatcher/router 和相邻 worker/API tests。
- 状态 / 数据变化：current review/task → reviewing；current outbox → completed；
  stale outbox → superseded；不创建第二 review/final。
- 验证命令与证据：未知 event type RED；局部 section GREEN；stale status RED/GREEN；
  假页码/high 风险 RED/GREEN；扩大回归 72 passed / 1 skipped。
- 回滚边界：撤销 evidence.rework worker 分支；generation 与 candidate payload 保留审计。
- 完成定义：digest 复验、局部刷新、保守候选、旧代 fencing 和既有 outbox 回归全绿。

## 任务 4D：canonical 质量与来源重审

- 目标：重算候选必须重新经过既有证据来源链和合同质量门，不能停在模糊的 reviewing 状态。
- 输入：current generation 的已验证 EvidencePacket、accepted artifact 和 ContractReviewPackV1。
- 输出：质量门 `PASSED/FAILED`、明确 gate reasons，以及对应 task/review 状态。
- 验证：先证明 `NEED_LEGAL_REVIEW` 候选错误停在 reviewing，再修复为
  `quality_gate_status=FAILED`、task/review=`awaiting_evidence`。
- 完成定义：来源继续绑定 packet/receipt/artifact digest；范围或定位缺口 fail closed。

## 任务 4E：append-only FinalMemorial 版本谱系

- 目标：通过重审的新正式奏折追加为 v2，不覆盖 v1，且读取端只暴露唯一 current。
- 输入：质量/来源门通过的新 candidate 与已失效的 current v1。
- 输出：同一 canonical `final_memorials` 表内 `(task_id, version)` 唯一、
  `supersedes_id` 谱系及每任务唯一 current。
- 验证：migration RED、service conflict RED、状态 API 误读 v1 RED，随后分别 GREEN。
- 回滚边界：不删除历史版本；已产生 v2 的数据库不得降级回 task_id 单行约束。
- 完成定义：v1 正文/hash 不变且 superseded；v2 current；API 返回 v2 identity。

# 规格说明：docs-r0-w05-evidence-rework-approval-20260723-20260723

## 背景

W04 已通过 Gitee PR #15 合并并关账，受保护主线 `67bcc78e` 处于
`activeWorkPackage: null` 的静止态。现有系统能把 `request_evidence/followup`
写成 `awaiting_evidence`，也能保存上传附件，但没有把新增证据绑定到旧正式奏折、
新执行 generation、重审结果和替代后的新奏折。结果是用户“补证”后只能看到状态变化，
不能证明系统真的重新推理并生成一个可独立裁决的新版本。

正式 amendment 的 W05 要求 `EvidencePacketV1`、`ContractRiskItemV1`、
`ContractReviewPackV1` 与最小刑部合同能力；R0 PRD §3.4 同时要求补证后只刷新受影响部分、
旧裁决失效或被替代，并对精确 `FinalMemorial` 裁决。本 Packet 把两者组合成一个端到端纵切，
但不扩大到 W06 附件交付或 W07 前端。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | W04 已合并，W05 未激活 | `origin/feature-chaotang-ext@67bcc78e`；authority CLI | Git/CLI / Project Agent | 否 |
| 已确认事实 | 当前补证裁决只推进 task/review 为 `awaiting_evidence`；`FinalMemorial` 仍按 task 唯一且 immutable conflict 拒绝新内容 | `backend/web/routers/shangshufang.py::apply_task_decision`；`backend/src/formal_memorial.py`；`backend/src/db/models.py` | 源码调查 | 否 |
| 已确认事实 | PRD 明确要求补证/新版本后刷新受影响部分、旧裁决失效或被替代、对精确新奏折裁决 | `docs/product/releases/product-r0-trusted-kernel/PRD.md` §3.4 | 文档事实源 | 否 |
| 推测 | W04 已有 generation-bound execution state 可作为重奏身份基础，但具体复用点须由 W05 首个 RED 冻结 | `backend/src/execution_state.py` 与 outbox runtime | 实施前 TDD 调查 | 否 |
| 已确认事实 | Product Owner 已批准 exact base/tree 与单 Packet 范围 | `owner_approval/exact-h-approval.md`；2026-07-23 | 用户原文确认 | 否 |
| 未知问题 | 最终 migration 形状和受影响 section 选择算法 | 不适用 | W05 首个 RED 与实现调查冻结 | 否；不得超出获批行为 |

## 数据流与调用链

```text
精确旧 FinalMemorial(content_hash, generation)
  → 人工 request_evidence(reason, required evidence, expected prior hash)
  → task=awaiting_evidence；旧奏折保留且不可再裁决
  → 新证据安全摄取并形成 EvidencePacketV1
  → 证据绑定 tenant/task/input version/prior memorial/generation
  → 创建新 outbox generation（幂等键阻止重复重奏）
  → 仅刷新受影响合同分析 section
  → ContractRiskItemV1[] → ContractReviewPackV1
  → canonical CourtReview single writer 重审
  → quality + provenance gate
  → 新 FinalMemorial version 追加写入并 supersede 旧版本
  → 用户只可对精确 current content_hash 作裁决
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `EvidencePacketV1` | 安全摄取输出 + 证据绑定服务 | 合同分析、provenance gate | 绑定 tenant/task/input version/digest、prior memorial hash、generation；非空文本不得自升可信 |
| `ContractRiskItemV1` | 最小刑部合同分析 | review pack/API | file version、page/clause、raw excerpt、riskLevel、explanation、missingEvidence、recommendedRevision、sourceLabel、engineTier |
| `ContractReviewPackV1` | 当前 DecisionTask 内的合同能力 | canonical CourtReview writer | 只生成 candidate，不绕过质量/来源门，不创建第二 review |
| generation lineage | W04 outbox/execution identity | worker、状态投影、重审 | 新 generation 追加写；迟到旧 generation 不得覆盖 current |
| FinalMemorial version lineage | canonical formalization gate | 裁决 API、史馆 | 旧版本 immutable + superseded；新版本追加并绑定 supersedes/content hash |
| 精确裁决绑定 | EmperorDecision/裁决入口 | FinalMemorial、史馆 | stale content hash、重复补证或跨租户对象替换必须失败 |

## 范围

- 中文、中国大陆法域的合成采购/销售/服务合同最小纵切。
- 三个 W05 v1 证据/合同契约及 fail-closed evidence/conflict/stale gate。
- request_evidence 对精确旧奏折和补证要求的不可变绑定。
- 补证完成后创建新 generation，重算受影响 section，走既有 single-writer CourtReview 与质量/来源门。
- 新正式奏折以 append-only version 替代旧版本，所有裁决绑定精确 current content hash。
- 公共后端 API 与真实数据库 seam 的 TDD 证据；已有前端可调用入口只做兼容性验证，不修改 UI。

## 非目标

- 不修改前端页面或交互（W07）。
- 不生成 PDF/DOCX/JSON 成果附件（W06）。
- 不实现完整 41 司或通用工作流引擎。
- 不创建第二 Mission、DecisionTask、CourtReview、FinalMemorial 或 archive 事实源。
- 不使用真实客户数据，不接入 LangGraph，不发布或切换生产。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 非空 URL/文本/模型自述 | 保持 `UNVERIFIED`，不能晋升可信证据 | W05 amendment RED 010 |
| critical/high 风险缺 file version/page/clause/raw excerpt | provenance/quality gate 失败，不生成 current 正式奏折 | W05 amendment RED 009 |
| 证据缺失、冲突、过期 | API 中显式显示，不静默补真 | W05 amendment RED 011 |
| 用户对旧 content hash 补证或裁决 | 409/fail closed；不改变 current lineage | stale-object RED |
| 重复提交同一补证 | 复用同一 evidence request/generation，不重复生成奏折 | idempotency RED |
| 旧 generation 迟到完成 | 保留审计但不能覆盖 current review/final | generation fencing RED |
| 新 generation 未过质量/来源门 | 旧版本仍可审计但不可被误标 current；任务保持待补证/复核 | formalization RED |
| 新奏折成功形成 | 旧版本 immutable `superseded`，新版本成为唯一 current | lineage RED/GREEN |
| 跨租户/用户或对象替换 | 403/404 fail closed，无存在性泄漏 | authz RED |
| capability 未激活或 flag 关闭 | 正文、附件、token、tool 权限为零；停止新分析并保留历史 | authority/rollback test |

## 风险与回滚边界

最大风险是把补证做成“再次覆盖同一行”，导致旧裁决与新证据失去可审计关系；其次是迟到
generation 覆盖新结果、重复请求生成多份正式奏折，以及模型自述被当证据。控制方式是
append-only evidence/generation/final lineage、精确 hash 乐观并发门、W04 generation fencing、
single writer 和质量/来源门。回滚只关闭 W05 合同分析/重奏 flag，停止创建新 generation；
保留旧输入、证据请求、候选、奏折版本和审计，不用旧公式重解释。

## 计划确认记录

- 批准人：Product Owner（`lyt`）
- 批准日期：2026-07-23
- 批准范围：仅为 `R0-W05` 上述单 Packet；effective base `67bcc78e`
- 明确未批准：W06–W09、前端 UI、真实客户数据、LangGraph、推送/合并、发布、生产切换

## 验收标准

- exact approval 绑定 base commit/tree、W05 单 Packet 范围与明确排除项。
- authority v2 只激活 `R0-W05`，W04 保持 `MERGED_AND_VERIFIED`，W06 仍被阻断。
- implementation 必须先提交公共 API/真实数据库 seam 的失败测试，再做最小实现。
- 三个 v1 契约、证据门、generation fencing、append-only FinalMemorial lineage 和 stale-hash 裁决全部有 RED/GREEN。
- 既有 canonical completion/single-writer/tenant lineage 回归全绿。
- Standards/Spec 独立双轴审查 0 MUST；合并和生产仍需另行授权。

## 验证计划

批准激活阶段运行 root doctor、authority v2 结构与机器决策。更新 manifest 后，
运行 authority 27 项测试、amendment 10 项测试、doctor，并证明 W05=GO、W04/W06=STOP。
实施阶段严格采用 TDD：先 RED、再最小 GREEN、再重构；最终运行聚焦后端回归和一个真实公共 API
端到端纵切。候选 checkpoint 一次；最终候选身份和未来生产切换各运行一次完整 verification-loop。

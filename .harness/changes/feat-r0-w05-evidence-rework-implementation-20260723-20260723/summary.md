# 变更摘要：feat-r0-w05-evidence-rework-implementation-20260723-20260723

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | feat-r0-w05-evidence-rework-implementation-20260723-20260723 |
| 类型 | feat |
| 状态 | IN_PROGRESS_REVIEW_REMEDIATION_4M_GREEN |
| Owner | Backend / Canonical Runtime |
| 创建日期 | 20260723 |

## 范围

- 主线：R0-W05 evidence-bound rework，纵切 1–4M。
- 文件：公共裁决 API、精确 content hash 门、W05 v1 契约、canonical outbox generation、
  ContractIntakeV1 冻结投影、FinalMemorial/史馆精确身份、Alembic 019–022 及测试。
- 修复：独立预审问题拆成 4G.1–4M；覆盖 generation/publish fence、生产默认关闭的能力门、
  可线性化重放、证据绑定授权/receipt/CAS、链式降级预检、legacy writer 收口和 typed
  `EvidenceReworkGenerationV1`。
- 当前证据：4M RED 为契约模块不存在；GREEN 为 54 passed / 1 skipped，目标 Ruff 通过。
  全量候选验证和修复后独立双轴复审仍待执行。

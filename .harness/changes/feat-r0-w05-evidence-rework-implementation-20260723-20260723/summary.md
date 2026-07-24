# 变更摘要：feat-r0-w05-evidence-rework-implementation-20260723-20260723

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | feat-r0-w05-evidence-rework-implementation-20260723-20260723 |
| 类型 | feat |
| 状态 | MERGED_WITH_POSTMERGE_REMEDIATION_OPEN |
| Owner | Backend / Canonical Runtime |
| 创建日期 | 20260723 |

## 范围

- 主线：R0-W05 evidence-bound rework，纵切 1–4M。
- 文件：公共裁决 API、精确 content hash 门、W05 v1 契约、canonical outbox generation、
  ContractIntakeV1 冻结投影、FinalMemorial/史馆精确身份、Alembic 019–022 及测试。
- 修复：独立预审问题拆成 4G.1–4M；覆盖 generation/publish fence、生产默认关闭的能力门、
  可线性化重放、证据绑定授权/receipt/CAS、链式降级预检、legacy writer 收口和 typed
  `EvidenceReworkGenerationV1`。
- 历史证据：4M RED 为契约模块不存在；GREEN 为 54 passed / 1 skipped，目标 Ruff
  通过。pre-merge implementation H0 `1f1800c7` 的 W05 定向包为 164 passed /
  1 skipped；backend 非排除全量为 3058 passed / 32 skipped / 3 deselected。
- 合并事实：W05 经 `61dfef3607000709be2e9955821c0e47fe16574d` 进入 merge commit
  `3cb508e06464de78facae09b93c132eb16023f94`，两者 tree 相同。
- 纠偏事实：本文件原先把已合并实现继续标成“等待独立复审”，并把当前证据钉在旧
  H0；这两项已由
  `.harness/changes/fix-r0-w05-postmerge-remediation-20260724/` 接管。本表以下 H0
  身份仅作历史 provenance，不再代表当前 review candidate。
- 当前 post-merge 实现候选为
  `0f2a3e4abd99aef345ac2858daa799c5aadc9dc6`；该 H1 的 Standards/Spec
  exact 审查均为 `0 MUST`。它仍是未推送、未合并的 remediation 候选，不改变
  W05/W06 execution authority。

## B..H 历史只读复审交接（已被 post-merge remediation 取代）

| Identity | Value |
| --- | --- |
| Fixed point B | `67bcc78ec5f80d3d1600c676812ddb4cec958eb3` |
| Historical implementation H0 | `1f1800c7e27bc2d5fe88443c53ad934b7f7e1a8b` |
| H0 tree | `e6e5e80827c37ab20e143804c1572b96046dc2d6` |
| H0 binary diff SHA-256 | `b357feece5dd115934ccca7e0f8fbba1e041ba5b924db00f588c5d7e78bdfa22` |
| Branch | `governance/r0-w05-amendment-20260723` |
| Review range | `git diff 67bcc78e..REVIEW_READY_HEAD` |
| Scope | 60 files / 32 implementation commits at H0；evidence-only commit follows |

此交接曾要求复审 Standards 与 Spec 两轴，重点是 generation/publish fencing、feature flag
fail-closed、binding owner/tenant/purpose/receipt、幂等/CAS replay、ContractIntakeV1
冻结范围、只重算 `contract_review`、FinalMemorial append-only/current hash 裁决、
ShiguanArchive 精确身份、019–022 upgrade/downgrade 和 legacy adoption。当前复审身份
与结果只能从上述 post-merge remediation change 读取。

## 文件归属清单

| 文件范围 | 数量 | W05 归属 |
| --- | ---: | --- |
| `.harness/changes/docs-r0-w05-evidence-rework-approval-20260723-20260723/**` | 6 | W05 专属批准、规格与既有独立审查证据 |
| `.harness/changes/feat-r0-w05-evidence-rework-implementation-20260723-20260723/**` | 4 | W05 实施规格、任务、CI 与状态事实 |
| `.harness/manifest/execution-authority.v2.json` | 1 | W05 唯一 ACTIVE execution authority |
| `backend/alembic/versions/019_*`–`022_*` | 4 | generation、memorial 版本、冻结范围与史馆身份 |
| `backend/src/contracts/{contract_review_pack,contract_risk_item,evidence_packet,evidence_rework_generation}.py` | 4 | W05 v1 公共契约 |
| `backend/src/{contract_rework,formal_memorial,schema_adoption,w05_downgrade_guard,w05_feature}.py` | 5 | 局部重算、追加版本、旧库升级、安全拒降与能力门 |
| `backend/src/db/models.py`、`backend/src/execution/{decree_dispatcher,outbox_worker}.py`、`backend/src/secure_ingest/audit.py` | 4 | canonical persistence、generation 派单/消费与 receipt |
| `backend/web/routers/{chaotang,scribe,shangshufang}.py` | 3 | 旧入口收口、current projection 与公共 W05 API |
| `backend/tests/**`（B..H exact diff 中 29 个文件） | 29 | W05 contracts/API/security/concurrency/migration/adoption 回归与冻结基线 |

不存在已提交的“范围外”或“尚不确定”文件。未跟踪的 `backend/uv.lock` 不属于已证明
必要的 W05 产物，未修改、未暂存；全量测试生成的 `backend/knowledge/docs/ima_archived/`
也未进入候选。

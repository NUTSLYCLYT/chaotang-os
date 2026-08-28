# Packet 10-A — Claim-Evidence Pure Kernel V1 Product Successor

任务 ID：`PACKET-10A-CLAIM-EVIDENCE-KERNEL-V1-PRODUCT-SUCCESSOR-20260827`

冻结基线：`origin/ext-dev@29094bc2d7c52f89122338975eddb8130c433c35`

冻结基线 tree：`0028fc93b94aa43e2423141843f92d03642efc22`

> 治理状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION / PRODUCT_STOP`。
> proposed approval 中的 `APPROVED_FOR_ONE_CHILD` 只是未来正式物化后供机器校验的闭合 schema 值；当前 proposed 路径、Task 和 Plan 不构成 approval、machine GO、candidate、验证继承或产品通过。

## Status

Draft

细分状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION / PRODUCT_STOP`

## Product Definition

- 目标用户：需要让奏折、诏令和运行报告中的每一条外部事实都能追溯到明确证据、采用状态和稳定身份的朝堂 Owner、御史与业务审核者。
- 用户行为：上游生产者提交 claims、evidence projections 与 bindings；纯函数内核在任何持久化或外部动作前完成封闭解析、确定性归一化、逐声明绑定、生产者隔离、预算和控制信封校验。
- 最终成果：一个无 I/O、无副作用、确定性的 P10-A Claim-Evidence pure kernel。它只产出可复算的 packet/index/decision/control/public envelope，不能自己获取事实、保存证据或执行外部动作。
- 所属闭环：真实性内核前置阶段。严格顺序为 `P10-A pure kernel → P10-B1 durable commitment → P10-B2 runtime activation`；本包只覆盖 P10-A。
- 当前能力边界：现有 `backend/app/agents/evidence_protocol.py` 继续持有 claim/evidence 语义和 frozen evidence packs；锦衣卫 models/storage 继续持有 evidence identity、source、adoption；史馆 models/storage 继续持有 immutable evidence archive。P10-A 不创建第二套事实源、truth ledger、authority 或持久化系统。
- 诚实结论：P10-A 能证明内核合同和 fail-closed 行为，不能声称 final memorial、decree 或 runtime report 已全面激活逐声明真实性门，也不能声称“消灭所有幻觉”。

## Current Mainline Facts

当前 ext-dev 已有价值：

1. `backend/app/agents/evidence_protocol.py` 已有严格 Pydantic 信封、claim basis、evidence ID、adopted evidence 与 decree-scoped session 语义。
2. 锦衣卫现有 models/storage 已提供证据身份、来源类型、采用状态和持久化边界；史馆现有 models/storage 已提供不可变归档边界。
3. 六部 domain controls、deterministic gates、readiness、Harness、doctor、authority 与 V2 convergence 已是现行治理事实源。
4. 当前 final Chancellor/decree/runtime report 尚未形成统一的逐 claim durable commitment 与最终投影门；这些缺口分别属于后续 P10-B1/P10-B2，不得偷入本 exact3。

唯一安全接入点为 `backend/app/agents/runtime_skills/`：P10-A 以纯函数技能加入当前架构，并从其 `__init__.py` 显式导出；不进入旧 `backend/src/` 运行时，不替代 evidence protocol，不触碰锦衣卫或史馆存储。

## Donor And Identity Boundary

历史 donor ref/tip：`9ed6416d78d4e3c88d4ca9f292d6574af275b9e1`，tree：`4a9abc226c71bd7f267737fb3e6605fdd1a8de29`。

| Legacy path | Bytes | Raw SHA-256 | Git blob | Disposition |
| --- | ---: | --- | --- | --- |
| `backend/src/claim_evidence_gate.py` | 19652 | `sha256:a0b8c77207259f416034d0659c0714925c486d58c968b0221bb41598c39f84b8` | `625f70e5590f6d760dc49bdf037c87af905488a6` | `ABSORB_ADAPT / SEMANTIC_DONOR_ONLY` |
| `backend/tests/test_claim_evidence_gate.py` | 9924 | `sha256:9cf0d67b89e9b315b156c3eafa39dc441330dd464fdf4130d77ec54309d961a9` | `e73b53e7c97614cb0b7ab9e3fb5a9a8734460610` | `ABSORB_ADAPT / SEMANTIC_DONOR_ONLY` |

Donor 只能提供语义和攻击样例。禁止 checkout donor 分支、merge、cherry-pick 或 byte-for-byte copy；禁止继承旧 approval、authority、candidate、verification、review 或通过身份。旧 `backend/src/formal_memorial.py`、`backend/src/shangshufang_loop.py`、旧 swarm 与 persistence 路径精确为 `REJECT / SUPERSEDED_RUNTIME / NO_RESTORATION`。

旧未提交治理包位于 `/home/ubuntu/Projects/chaotang-os/.worktrees/ext-full-value-convergence-v2-20260820`，处置为 `UNCOMMITTED_GOVERNANCE_DONOR_ONLY / NO_AUTHORITY / NO_CANDIDATE_IDENTITY`：

- approval raw：`sha256:c6d5a842016eeca9f4c9db9b3768252ceb796fbd98117d1a2e0acdc3120f796f`
- Task raw：`sha256:ffb44a74bae4be92a3934c911cea535cbb94dbccc614ae845ff98f4a06a484b1`
- Plan raw：`sha256:5d20cb7d10dfe357fcac2ae06cb2abc5fd3b2cad8bc9c94a8becd69520f5bd6f`
- contract draft raw：`sha256:bf8feeb18eca6d7e3d1d33570d77cc306c72d23d12804c076f4336b436930d5b`

上述工作区与字节不得修改、暂存、提交或冒充本 successor 身份。

## Forward-Only Lineage

历史 P10 base `17d6be6538bfbfeeaf5c6fa13eee5d09dd1208a9` 是当前 base `29094bc2d7c52f89122338975eddb8130c433c35` 的祖先；两者之间机械确认有 50 个 first-parent commits。该 lineage 没有任何 commit 触及本轮三个 product paths，因此只构成零重叠证明，不传递任何旧 authority 或 candidate 身份。

当前 exact3 基线身份：

- `backend/app/agents/runtime_skills/__init__.py` 已存在，base blob `cd13efd4d032d80a955c700cff984e1789431c55`，future status `M`。
- `backend/app/agents/runtime_skills/claim_evidence_gate.py` 当前不存在，future status `A`。
- `backend/tests/test_claim_evidence_gate.py` 当前不存在，future status `A`。
- future 结构固定为 `2 ADD + 1 MODIFY`，全部模式 `100644`。

## Frozen P10-A Contract

### Pure-kernel boundary

- 唯一 untrusted public parse boundary 只接受 UTF-8 `bytes | str`，先做 raw-byte 上限，再以保留 duplicate-key 和 Decimal 原始 token 的 strict parser 拒绝重复键、非法 UTF-8/surrogate、NaN/Infinity、语法错误及非规范数字；普通预解析 `dict/list` 不得绕过该入口。
- parser 输出 bounded、closed、deep-frozen typed projection；内部 validated-value helper 只接受该 parser 新建的 immutable tuple/标量对象，不声称能复核已经丢失的 JSON 词法，也不得保存调用方 mapping/list/model 引用。
- evaluator 采用双通道：`untrusted candidate bytes` 与独立的 `TrustedEvidenceContextV1`。后者只能由现有 evidence protocol、锦衣卫 frozen/adopted identity 或史馆 immutable reference 的 server adapter 构造；candidate 中自报的 `ADMITTED`、source、reviewer、producer、owner、run、decree、route 或 role 全部拒绝，不能成为 authority。
- 不读文件、SQLite、HTTP、环境变量、时钟、随机数、缓存、provider、凭据或 source body。
- 所有 public operations 均为确定性纯函数；没有模块级可变 registry、隐式全局状态或运行时插件注入。
- `external_effect_authorized` 必须恒为 `false`，任何输入都不能覆盖。
- v1 derivation registry 与 user-request schema registry 均为空且 sealed；未知 ID、未知 version 或非空注入 fail-closed。

### Closed data model

- Claim、EvidenceProjection、EvidenceBinding、ProducerPacket、PacketIndex、DecisionEnvelope、ControlEnvelope 与 PublicEnvelope 都使用封闭字段集合；unknown field、duplicate key、非法 Unicode、NaN/Infinity、非 JSON value 全部拒绝。
- canonical JSON 使用严格 UTF-8、稳定 key order 与确定性 array policy；每个 identity 采用 self-excluding SHA-256，修改任一可见或控制字段都必须改变 identity 或失败关闭。
- `FACT` 必须绑定至少一个由 `TrustedEvidenceContextV1` 独立证明为 `ADMITTED` 的 evidence projection；candidate 自报 admission 无效。`INFERENCE` 只有 sealed derivation registry 明确允许时才可进入，但 v1 registry 为空，因此当前一律 fail-closed。
- `OPINION` 与 `RECOMMENDATION` 不得携带 evidence 或 derivation 冒充外部事实；未知 claim type 拒绝。
- evidence ID、source type、source ref、adoption status 与 projection digest 必须一致；P10-A 不保存原始证据正文。

### Producer, owner and processing binding

- 每个 claim 和 binding 只有一个 producer owner；跨 producer 重复 ID、claim splice、binding splice 和 aggregate splice 在排序前拒绝。
- 同一 evidence ref 只有在 canonical projection 完全相同时才允许跨 claim/producer 重用；不同 projection 必须失败关闭。
- owner、run、decree、draft、route、scope、producer、packet 和 control identities 必须逐层精确绑定，不能剪接。
- 容器重排可以归一为相同 canonical form，但可信 processing order 必须被明确绑定，不能借排序隐藏处理次序差异。
- claim、evidence、binding、producer packet 和 aggregate budget 必须在物化输出前执行；超限不产生部分结果。

### Executable v1 profile

所有 P10 digest 都输出 `sha256:` 加 64 位 lowercase hex。每个 digest preimage 精确为：

`{"digest_algorithm":"sha256","digest_domain":"courtos.p10a.claim-evidence","object_kind":"<closed literal>","schema_version":"<object schema>","payload":<object excluding only its own digest field>}`

`object_kind`、`schema_version`、`digest_algorithm` 均进入摘要；跨 kind、跨 version、跨 packet/index/decision/control 层级 splice 必须失败。canonical JSON 固定 UTF-8、keys 字典序、`,`/`:` separators、`ensure_ascii=false`、不做 Unicode normalization。

对象 exact fields 冻结如下；未列字段一律拒绝：

schema literal 映射固定为：`ClaimEvidenceCandidateV1=claim-evidence-candidate.v1`、`ClaimProjectionV1=claim-projection.v1`、`ClaimPublicValueProjectionV1=claim-public-value.v1`、`EvidenceProjectionV1=evidence-projection.v1`、`ClaimEvidenceBindingV1=claim-evidence-binding.v1`、`ProducerClaimPacketV1=producer-claim-packet.v1`、`ProducerPacketIndexV1=producer-packet-index.v1`、`ClaimResultV1=claim-evidence-claim-result.v1`、`ClaimEvidenceDecisionV1=claim-evidence-decision.v1`、`ClaimEvidenceControlV1=claim-evidence-control.v1`、`ClaimEvidenceEnvelopeV1=claim-evidence-envelope.v1`、`PublicClaimResultV1=claim-evidence-public-claim-result.v1`、`PublicEnvelopeV1=claim-evidence-public-envelope.v1`、`TrustedEvidenceContextV1=claim-evidence-trusted-context.v1`、`ClaimEvidenceEvaluationV1=claim-evidence-evaluation.v1`；unknown version 全拒。

- `ClaimEvidenceCandidateV1`：`schema_version, producer_packets`；这是 raw JSON 唯一根对象，`producer_packets` 为 `ProducerClaimPacketV1[1..64]`，不得直接传 packet array、aggregate、decision、control 或 trusted context。
- `ClaimProjectionV1`：`schema_version, claim_id, producer_node_id, extractor_id, extractor_version, public_projection_ref, kind, claim_key, public_value_projection, claim_digest, evidence_refs, derivation_ref`。
- `ClaimPublicValueProjectionV1`：`schema_version, template_id, value_type, canonical_value, rendered_value_text, unit, as_of, rendered_as_of_text, source_display`。`bureau-opinion-clause` 固定为 null；entity 固定 `TEXT/nonblank/null unit`；price 固定 `DECIMAL/positive canonical/CNY`。各 extractor 的 nullability 不可配置。
- `EvidenceProjectionV1`：`schema_version, evidence_ref, adapter_id, adapter_version, comparator_id, source_kind, source_assertion_class, source_digest, fact_key, subject_key, category, fact_value_digest, as_of, retrieved_at, evaluated_at, tenant_scope, scope_mode, tenant_id, owner_user_id, run_id, decree_id, projection_digest`。
- `ClaimEvidenceBindingV1`：`schema_version, claim_id, claim_digest, evidence_ref, evidence_projection_digest, relation, binding_digest`；`relation` 只允许 `SUPPORTS`。
- `ProducerClaimPacketV1`：`schema_version, producer_node_id, claims, evidence_projections, bindings, packet_digest`。
- `ProducerPacketIndexV1`：`schema_version, producer_node_id, packet_digest, claim_ids, evidence_refs, binding_digests`。
- `ClaimResultV1`：`schema_version, claim_id, kind, claim_digest, status, binding_digests, truth_label, reason_codes`。
- `ClaimEvidenceDecisionV1`：`schema_version, validator_id, validator_version, aggregate_digest, candidate_digest, evidence_snapshot_digest, claim_results, coverage_scope, uncovered_fields, status, reason_codes, external_effect_authorized, decision_digest`。
- `ClaimEvidenceControlV1`：`schema_version, tenant_scope, scope_mode, tenant_id, owner_user_id, job_id, run_id, decree_id, draft_fingerprint, route_digest, execution_started_at, gate_completed_at, aggregate_digest, candidate_digest, decision_digest, evidence_snapshot_digest, control_ref, external_effect_authorized`。
- `ClaimEvidenceEnvelopeV1`：`schema_version, producer_packet_index, claims, evidence_projections, bindings, decision, control, envelope_digest`。
- `PublicClaimResultV1`：`schema_version, claim_id, kind, status, truth_label, reason_codes`。
- `PublicEnvelopeV1`：`schema_version, coverage_scope, status, claim_results, uncovered_fields, decision_digest, external_effect_authorized, public_envelope_digest`。它默认禁止 source body/ref、locator、raw/canonical value、timestamp、owner/reviewer/producer/internal route identity、credential、URL、路径及内部错误回显；secret canary 不得出现在成功或失败输出。
- `TrustedEvidenceContextV1`：`schema_version, tenant_scope, scope_mode, tenant_id, owner_user_id, job_id, run_id, decree_id, draft_fingerprint, route_digest, evaluated_at, approved_processing_order, evidence_authorities`。它不是 candidate JSON 的字段；`evidence_authorities` 只能是 server adapter 从现有冻结对象建立的 deep-frozen tuple。
- `ClaimEvidenceEvaluationV1`：`schema_version, internal_envelope, public_envelope, evaluation_digest`；`internal_envelope` 为 `ClaimEvidenceEnvelopeV1`，`public_envelope` 为其 redacted `PublicEnvelopeV1`，两者 decision digest 必须一致，evaluation digest 对完整两者做域分离摘要。

`evidence_snapshot_digest` 唯一算法为对完整 `TrustedEvidenceContextV1` exact projection应用上述 domain-separated digest，`object_kind="trusted-evidence-context"`；projection 必须包含 approved processing order 与全部按 `evidence_ref` 排序的 `EvidenceAuthorityV1`。authority/order 的增删改、重复、重排或跨 snapshot splice 必须改变 digest 或失败，Decision 与 Control 中该值必须 exact 相等。

v1 truth label 低到高固定为：`NONFACTUAL < USER_ATTESTED_NOT_INDEPENDENTLY_VERIFIED < ARCHIVED_REFERENCE_NOT_REVERIFIED < SOURCE_REFERENCE_BOUND_NOT_SEMANTICALLY_VERIFIED < EXACT_VALUE_BOUND`。任一 BLOCK 的 truth label 为 null；多来源取最保守上限，不多数投票、不平均、不静默选首条。

sealed registries 固定为 immutable tuple/map，不从 config/env/request/model/source label 扩展：

| Kind | Exact ID/version | Closed role |
| --- | --- | --- |
| extractor | `bureau-opinion-clause.v1@1.0.0` | registered Ready factual clause locator；无 public value |
| extractor | `jinyiwei-entity-reference-renderer.v1@1.0.0` | canonical TEXT entity renderer projection |
| extractor | `jinyiwei-mainland-last-price-renderer.v1@1.0.0` | canonical DECIMAL/CNY renderer projection |
| comparator | `reference-only.v1@1.0.0` | identity/ref/admission only；不得产生 exact semantic label |
| comparator | `exact-text.v1@1.0.0` | TEXT fact-value payload exact equality |
| comparator | `exact-decimal-unit.v1@1.0.0` | decimal/unit/fact-key exact equality；无容差或换算 |
| adapter | `agent-evidence-protocol.v1@1.0.0` | server-derived frozen selected/adopted Evidence Protocol input |
| adapter | `shiguan-adopted-reference.v1@1.0.0` | owner-scoped immutable archive reference；P10-A contract only |
| adapter | `deterministic-entity-reference.v1@1.0.0` | entity renderer result + exact-text comparator |
| adapter | `deterministic-mainland-last-price.v1@1.0.0` | price renderer result + exact-decimal-unit comparator |
| adapter | `user-request-typed-projection.v1@1.0.0` | registered request field contract only；v1 request registry empty |

v1 derivation registry 与 request-schema registry 精确为空。unknown literal/version/input/output 均失败；`INFERENCE` 固定 `DERIVATION_NOT_REGISTERED`。

`TrustedEvidenceContextV1.evidence_authorities` 的元素为 `EvidenceAuthorityV1`，exact fields：`schema_version="claim-evidence-authority.v1", evidence_ref, adapter_id, adapter_version, comparator_id, freshness_policy_id, source_kind, source_assertion_class, source_digest, fact_key, subject_key, category, fact_value_digest, as_of, retrieved_at, evaluated_at, scope_identity, admission_status, conflict_digests`。`admission_status` 只能由 server adapter 设为 `ADMITTED|BLOCKED`；candidate 没有该字段。`scope_identity` exact fields 为 `schema_version="claim-evidence-scope.v1", tenant_scope="courtos-single-tenant.v1", scope_mode="OWNER_ONLY", tenant_id=null, owner_user_id, run_id, decree_id`。

sealed freshness policy registry 只含以下 literals，所有 policy 的 `future_skew_seconds=0`，reference time 只取 TrustedEvidenceContext 的 canonical `evaluated_at`：

- `archive-reference.v1`：`max_age_seconds=null`，只要求 `as_of/retrieved_at/evaluated_at` 不晚于 trusted evaluated_at；映射 historical `agent-evidence-protocol` 与 `shiguan-adopted-reference`。
- `current-observation-300s.v1`：`max_age_seconds=300`；映射 nonhistorical `agent-evidence-protocol` 与 mainland-last-price deterministic adapter。
- `entity-reference-86400s.v1`：`max_age_seconds=86400`；只映射 entity-reference deterministic adapter。
- `user-attested.v1`：`max_age_seconds=null`；只供空 request registry 的 forward contract，v1 不激活。

所有 canonical time 精确匹配 UTC `YYYY-MM-DDTHH:MM:SS.ffffffZ`，不接受 naive、offset display、leap second、future 或 policy 边界外 stale；display timestamp 只能由 registered renderer strict parse 后转为该形式。

`public_projection_ref` 是 tagged union 而非自由字符串：`BUREAU_CLAUSE` exact fields 为 `kind,department_ordinal,bureau_ordinal,claim_ordinal`；`BUREAU_OPINION` exact fields 为 `kind,department_ordinal,bureau_ordinal`。ordinal 使用无前导零 ASCII decimal string，范围 `0..63`，并必须落在 trusted response shape；不接受 JSONPath、pointer、wildcard、负数、空 segment 或额外字段。EvidenceAuthority 的 `evidence_ref` 只接受 safe ASCII ID/ref，不承载 URL、路径或 locator。

五个 adapter 的 closed trusted inputs 固定为：

- `agent-evidence-protocol.v1`：`evidence_id, pack_id, investigation_id, fact_key, category, data_scope, subject, historical, source_type, as_of, retrieved_at, evaluated_at, content_hash, publisher, quality, stance, adopted, pack_status, unresolved, conflict_digests, scope_identity`；只有现有 immutable session 中 selected + adopted + RESOLVED、无 unresolved/conflict 才 ADMITTED。
- `shiguan-adopted-reference.v1`：`evidence_id, pack_id, investigation_id, prearchive_snapshot_digest, source_type, category, data_scope, subject, jurisdiction, as_of, retrieved_at, evaluated_at, scope_identity`；P10-A 只保留固定向量，runtime activation BLOCKED。
- 两个 deterministic adapters：`comparator_id, producer_skill_id, producer_skill_version, renderer_result_digest, input_evidence_projection_digests, fact_key, subject_key, value_type, canonical_value, unit, as_of, retrieved_at, evaluated_at, scope_identity`；entity 只接受 `TEXT/null unit`，price 只接受 `DECIMAL/CNY`。
- `user-request-typed-projection.v1`：`request_schema_id, request_schema_version, registered_field_ref, value_type, canonical_value, unit, request_corpus_digest, scope_identity`；因 request registry 为空，v1 固定 BLOCK。

每个 adapter 输出且只输出 deep-frozen `EvidenceAuthorityV1`；input 中散落或不等于 `scope_identity` 的 owner/run/decree、source label、reviewer 与 admission 字段全部拒绝。三个 extractor 输出且只输出 closed `ClaimProjectionV1`；三个 comparator 输入为同 `fact_key/value_type/canonical_value/unit` 的两个 frozen fact-value payload，输出 fixed PASS/BLOCK reason 与 truth ceiling，不返回自由文本。

资源预算分阶段执行：raw-byte 上限在 UTF-8 decode 前；token/depth/node/string/number 上限在 streaming parse 中；集合、乘积、duplicate 与 trusted processing-order 上限在排序前；internal/public output bytes 在返回前。任何阶段超限都不能产生部分 typed result：

- untrusted serialized input `<=262144` UTF-8 bytes；单 registered typed claim/source input `<=4096` bytes；全部 claims `<=65536` bytes；全部 evidence projections `<=131072` bytes；最终 internal/public envelope 各 `<=32768` canonical bytes。
- 单对象 depth `<=16`、nodes `<=512`，全输入 nodes `<=4096`；单 string `<=2048` Unicode scalars 且 `<=8192` UTF-8 bytes；safe ASCII ID/ref `<=128` chars；producer node `<=100` scalars 且 `<=256` bytes；locator `<=128` ASCII chars。
- claims `<=64`、evidence projections `<=64`、bindings `<=128`、reason/gap codes `<=32`、每 claim evidence refs `<=16`，且 `claims × evidence <=4096`。
- JSON number token 在 parser 中先限 `<=128` ASCII chars，随后 candidate schema 一律拒绝 raw JSON numeric values；typed numeric facts 必须使用 canonical decimal string `-?(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?`，`-0` 拒绝。trusted renderer display token 可为 bounded lowercase scientific notation，但 adapter 必须先转成无指数 canonical string。Decimal coefficient `<=38` digits、scale `0..12`、adjusted exponent `-12..37`；NaN/Infinity、超长 exponent、negative-zero 歧义与 boundary+1 全部拒绝。
- 所有 boundary、boundary+1、depth/node/string/Decimal/Unicode expansion/output tests 必须冻结；超限只返回 closed code `BUDGET_EXCEEDED`，不得回显输入。

canonical order 唯一：claims 按 `(extractor registry ordinal, claim_id)`；evidence 按 `evidence_ref`；bindings 按 `(claim_id,evidence_ref)`；claim results 与 claims 同序；packet index/aggregate 只按 `TrustedEvidenceContextV1.approved_processing_order`。duplicate ID/ref/binding 在排序前拒绝。边界完成 bounded deep copy 后只保存 tuple/frozen scalar/new object；调用方之后修改原 list/dict 不得改变投影或摘要。

reason code closed enum 为：`NONFACTUAL_CLASSIFIED, USER_ATTESTED_BOUND, ARCHIVED_REFERENCE_BOUND, SOURCE_REFERENCE_BOUND, EXACT_VALUE_MATCH, CLAIM_MISSING_BINDING, EVIDENCE_REF_UNKNOWN, EXTRACTOR_NOT_REGISTERED, ADAPTER_NOT_REGISTERED, COMPARATOR_NOT_REGISTERED, DERIVATION_NOT_REGISTERED, IDENTITY_MISMATCH, DIGEST_MISMATCH, EVIDENCE_CONFLICT, FRESHNESS_INVALID, PROJECTION_NOT_CANONICAL, PUBLIC_PROJECTION_MISMATCH, NUMERIC_VALUE_NOT_EXACTLY_BOUND, BUDGET_EXCEEDED, DUPLICATE_ID, CYCLE_DETECTED, AGGREGATE_MISMATCH`；输出按声明顺序去重，禁止自由文本错误。

exact public API 只导出 `ClaimEvidenceGateError`、`TrustedEvidenceContextV1`、`ClaimEvidenceEvaluationV1`、`parse_claim_evidence_candidate_v1`、`evaluate_claim_evidence_v1`。函数签名固定为 `parse_claim_evidence_candidate_v1(raw: str | bytes, /) -> ClaimEvidenceCandidateV1` 与 `evaluate_claim_evidence_v1(raw: str | bytes, /, *, trusted_context: TrustedEvidenceContextV1) -> ClaimEvidenceEvaluationV1`；evaluate 必须内部调用同一 strict parser，不能接受预解析 dict。失败只抛 `ClaimEvidenceGateError`，其公开 `.code`/message 只能是 closed reason code，不能包含输入、locator、source 或 exception repr。`runtime_skills/__init__.py` 只能给 `_LAZY_EXPORTS` 和 `__all__` 增量增加这五项，不得 eager import、删除/改名旧导出或暴露内部 registry；package import、五项 lazy resolution、签名/return shape 与未知导出 AttributeError 必须测试。

### Grounding and locator rules

- 数值使用精确 Decimal 语义，保留正负号、负零策略、指数、单位和上限；禁止 substring、Unicode 混淆、中文数字近似、逗号拆分或单位换算猜测。
- timestamp 必须是有时区、可比较且在调用方显式给出的 reference time/freshness contract 内；内核不得自己读取时钟。
- extractor、adapter、comparator 使用 sealed ID/version；unknown combination fail-closed。
- locator 使用闭合类型和界限；禁止 leading-zero 歧义、wildcard、开放 JSONPath、越界 page/clause、template drift。

## Acceptance Criteria

- [ ] Owner 精确确认 proposed approval 的 RFC 8785 canonical digest；raw SHA 和三文件 bundle 只作字节与包身份校验。
- [ ] 正式 approval commit 是 `29094bc2d7c52f89122338975eddb8130c433c35` 的直接单亲子，只含正式 approval、Task、Plan 三条路径，模式全部 `100644`。
- [ ] 远端精确等于 approval commit 后，machine authority 返回 `GO / APPROVED_FOR_ONE_CHILD`；否则产品保持 STOP。
- [ ] candidate 只含 exact3，结构精确为 `2 ADD + 1 MODIFY`，全部 `100644`，没有新依赖或第二套 runtime/persistence。
- [ ] 27 个冻结负向节点先形成对应真实 RED，再由最小实现逐项 GREEN；若基线已通过，必须如实记录 proof gap，不伪造 RED。
- [ ] 9 个冻结正向节点必须证明 admitted FACT、exact text/decimal、合法 NONFACTUAL、shared evidence、canonical reorder、processing-order identity、public value/evaluation shape 和完整 envelope round-trip；全量 BLOCK 的空实现不得通过。
- [ ] focused、五组现有证据基线、backend-full、exact3 Ruff、readiness、Harness、doctor、authority regression、V2 convergence、结构与 diff-check 全绿。
- [ ] product-authority regression 只在进程级 `TMPDIR=/tmp` 下运行；backend-full 若环境需要，使用 `TMPDIR=/tmp TEMP=/tmp TMP=/tmp`，不得持久修改配置。
- [ ] Governance、Python Design 与 Security Review 均 `GO / P0=0 / P1=0 / P2=0`。
- [ ] P10-B1、P10-B2、candidate commit/push、Pilot、Release 和部署分别等待后续 Owner 授权。

## Delivery Constraints

- 当前阶段只允许三份治理草案及其只读验证/复审；不物化正式 approval，不运行 product authority，不修改 exact3，不运行产品测试，不 commit、不 push。
- future candidate 唯一修改范围为 exact3；需要第四条路径、dependency 文件、evidence protocol、锦衣卫、史馆、API、数据库或前端路径立即 STOP。
- 不得创建 second Claim-Evidence runtime、truth ledger、事实源、authority 或 durable store。
- 不得把 donor 中的旧 final memorial、swarm 或 persistence 路径接回现行架构。
- 不得通过删测、skip、放宽 closed contract、接受 unknown field、可变 registry、近似数值或 fail-open 换取通过。
- P10-A 不得写 source body、credential、secret、网络响应或用户隐私；public envelope 只能包含 `PublicEnvelopeV1` 的 exact allowlist，不得包含内部 source/ref/locator/value/identity。

## Affected Modules

- 模块：`runtime_skills` 下的纯 Claim-Evidence deterministic kernel、显式导出以及对应独立测试。
- 允许路径：`backend/app/agents/runtime_skills/__init__.py`、`backend/app/agents/runtime_skills/claim_evidence_gate.py`、`backend/tests/test_claim_evidence_gate.py`。
- 依赖模块：现有 evidence protocol、锦衣卫 evidence identity/source/adoption 与史馆 immutable archive 只作为合同参照和回归边界，本轮不修改。

## Technical Plan

严格顺序为：治理冻结 → 正式 approval commit/push → machine GO → exact3 独立 candidate → 27 个真实负向 RED + 9 个正向缺实现 RED → 最小纯函数实现 → focused/baseline/backend-full/Ruff/治理矩阵 → Governance/Python/Security 三审 → candidate evidence 冻结 → 等待本地 candidate commit 授权。P10-B1 与 P10-B2 必须在 P10-A 主线落地后分别重新治理，不得并入本轮。

## Implementation Report

- 已完成：实时远端与 base commit/tree 只读核验；当前主线能力、事实源边界、历史 donor bytes、旧治理 donor、first-parent lineage 和 exact3 零重叠的机械盘点。
- 已冻结：唯一接入点、exact3、`2 ADD + 1 MODIFY`、纯函数边界、27 个负向节点、9 个正向节点及验证矩阵。
- 未完成：Owner digest 确认、正式 approval、machine GO、RED/GREEN、产品实现、产品验证、独立三审、candidate commit/push、P10-B1、P10-B2、Pilot、Release 或部署。
- 历史 donor 的通过或失败只作设计证据；不得继承旧 `PACKET-10A-CLAIM-EVIDENCE-KERNEL-V1-20260821` 的 approval/authority/candidate/verification/review 身份。

## Acceptance Review

- 治理包：等待 strict JSON/schema、`validateApprovalManifest`、`productTaskErrors=[]`、完整 Harness、canonical/raw/bundle 和三路独立审查完成后，提交 Owner 确认。
- 产品：`PRODUCT_STOP`；当前无 formal approval、无 machine GO、无 candidate、无 runtime activation。
- 任一远端漂移、schema/合同失败、第四条 product path、第二套事实源、持久化/外部副作用、测试失败或独立 P0–P2 立即 `STOP / NO_REANCHOR`。

## Frozen Negative Matrix

未来 candidate 必须以一个精确 pytest node 对应一个类别，至少覆盖：

1. strict JSON duplicate key、unknown field、noncanonical number、NaN/Infinity、非法 surrogate。
2. Claim/Evidence/Binding/Packet/Index/Decision/Control/Public envelope self-excluding digest 篡改。
3. FACT 缺 admitted binding、未知 evidence ID、adoption/source/projection 不一致。
4. INFERENCE 在空 v1 derivation registry 下 fail-closed。
5. runtime registry 注入、非空 user schema registry 或未知 schema version。
6. OPINION/RECOMMENDATION 携带 evidence/derivation 和未知 claim kind。
7. source label、reviewer、producer self-review 和 trusted-role spoof。
8. 数值 substring、Unicode 混淆、中文数字、逗号拆分、单位近似。
9. Decimal 正负号、negative zero、exponent、nonfinite 与预算上限。
10. naive/future/stale timestamp 与 display/canonical splice。
11. unknown extractor/adapter/comparator ID 或 version。
12. locator bounds、leading zero、wildcard、开放 JSONPath、clause/template drift。
13. duplicate claim/evidence/binding ID 在 canonical sorting 前拒绝。
14. 容器重排 canonical identity 与 trusted processing order 的一致性。
15. cross-producer duplicate、empty producer index、packet aggregate splice。
16. shared evidence 同 ref 同 canonical projection 可复用一次；不同 projection 失败。
17. owner/run/decree/draft/route/scope/control splice。
18. budget 在 materialization 前执行，且所有 decision/control 的 `external_effect_authorized=false` 不可覆盖。
19. candidate 不能自报 admission/source/reviewer/owner/role 替代独立 `TrustedEvidenceContextV1`。
20. object kind/schema version/层级的 digest domain splice 一律失败。
21. raw bytes、depth、nodes、string、Decimal、集合和输出全部做 boundary/boundary+1。
22. parse 后修改调用方原始 list/dict 不得改变 frozen projection 或摘要。
23. PublicEnvelope 成功、BLOCK 和 error 输出都不得泄露 source/ref/locator/value/内部身份或 secret canary。
24. raw candidate 根对象、unknown/duplicate root fields、直接 packet array 或 trusted context 注入全部失败。
25. freshness policy、UTC 边界、stale/future 与 tagged locator 的边界/越界全部闭合。
26. trusted snapshot digest 必须绑定全部 authorities 与 approved processing order，跨 snapshot splice 失败。
27. import 与全部 public API 在 monkeypatch filesystem/network/env/clock/random/provider/cache 后仍无访问和副作用。

## Frozen Positive Matrix

未来 candidate 还必须以九个精确 pytest nodes 证明：

1. server-derived admitted FACT reference binding 可完整 round-trip。
2. trusted context 下 exact-text FACT 通过。
3. trusted context 下 exact-decimal-unit FACT 通过。
4. 无 evidence/derivation 的 OPINION 与 RECOMMENDATION 以 NONFACTUAL 通过。
5. 同一 ref + 同一 canonical projection 的 shared evidence 全局只保存一次。
6. 仅容器序列化重排保持 canonical digest 相同。
7. trusted processing order 改变时 packet index 与 aggregate digest 必须改变。
8. 完整 internal/public envelope 可从 closed fields 重新计算全部 digest 并 round-trip。
9. `ClaimPublicValueProjectionV1` 与 `ClaimEvidenceEvaluationV1` exact return shape 可 round-trip，未知字段拒绝。

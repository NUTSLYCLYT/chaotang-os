# Packet 10-A — Claim-Evidence Kernel V1 Contract-Complete Product Successor

任务 ID：`PACKET-10A-CLAIM-EVIDENCE-KERNEL-V1-CONTRACT-COMPLETE-SUCCESSOR-20260828`

冻结基线：`origin/ext-dev@125328d02d8b6899c6ce295690ec3f3416d17258`

冻结基线 tree：`0f733e5a7366ddf8aae11abaa032fe6bb59d2d8b`

## Status

Draft

细分状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION / PRODUCT_STOP`

## Product Definition

- 本 successor 继续交付 P10-A 无 I/O、无副作用的 Claim-Evidence pure kernel，产品范围仍精确为原 exact3，顺序仍为 `P10-A → P10-B1 → P10-B2`。
- predecessor approval commit `125328d02d8b6899c6ce295690ec3f3416d17258` 的 machine authority 已返回 `GO / APPROVED_FOR_ONE_CHILD`，但在任何产品字节写入前，独立测试、Python 与 Security 只读复核发现安全关键合同欠定义。
- Owner 常驻授权下的 predecessor authority disposition 精确为 `ABANDONED_BY_OWNER_STANDING_MANDATE_AFTER_INDEPENDENT_REVIEW_UNCONSUMED / REISSUE_REQUIRED`，原因 `APPROVAL_CONTRACT_UNDERDETERMINED`；不得消费、恢复、继承或 re-anchor。新 approval commit 前必须再次确认它没有产生 product child。
- predecessor approval、Task、Plan 继续作为历史证据保留；其 Task raw `sha256:386db57bf847ff140319a1793b1bdcb36b2eb8f4684a453c665173c452472a60` 与 Plan raw `sha256:0de9b2512c8b093884fe5ab4a411032192a5ddcb11a5d41dcb223e52310dd229` 是语义 donor，不传递 approval、authority、candidate、验证或审查身份。
- 本 successor 完整采用 predecessor 中未被下文替换的 pure-boundary、closed-fields、sealed registries、freshness、budget、canonical ordering、public redaction、exact3 和 27+9 测试合同；下文是有优先级的闭合替换，任何冲突以下文为准。

## Contract Completion

### Digest registry and preimages

统一 wrapper 精确为：

`{"digest_algorithm":"sha256","digest_domain":"courtos.p10a.claim-evidence","object_kind":"<literal>","schema_version":"<literal>","payload":<exact payload>}`

以 UTF-8、`ensure_ascii=false`、keys 字典序、`,`/`:` separators、禁止 Unicode normalization 的 canonical JSON 计算 SHA-256，输出 `sha256:` 加 64 位 lowercase hex。映射固定为：

| Identity | schema_version | object_kind | own digest field |
| --- | --- | --- | --- |
| public value | `claim-public-value.v1` | `claim-public-value` | none |
| fact value | `claim-evidence-fact-value.v1` | `fact-value` | none |
| claim | `claim-projection.v1` | `claim-projection` | `claim_digest` |
| evidence | `evidence-projection.v1` | `evidence-projection` | `projection_digest` |
| binding | `claim-evidence-binding.v1` | `claim-evidence-binding` | `binding_digest` |
| producer packet | `producer-claim-packet.v1` | `producer-claim-packet` | `packet_digest` |
| producer index | `producer-packet-index.v1` | `producer-packet-index` | `index_digest` |
| candidate | `claim-evidence-candidate.v1` | `claim-evidence-candidate` | none |
| aggregate | `producer-packet-aggregate.v1` | `producer-packet-aggregate` | none |
| response shape | `claim-evidence-response-shape.v1` | `response-shape` | none |
| trusted context | `claim-evidence-trusted-context.v1` | `trusted-evidence-context` | none |
| claim result | `claim-evidence-claim-result.v1` | `claim-result` | none |
| decision | `claim-evidence-decision.v1` | `claim-evidence-decision` | `decision_digest` |
| control | `claim-evidence-control.v1` | `claim-evidence-control` | `control_ref` |
| internal envelope | `claim-evidence-envelope.v1` | `claim-evidence-envelope` | `envelope_digest` |
| public claim ref | `claim-evidence-public-claim-ref.v1` | `public-claim-ref` | none |
| public envelope | `claim-evidence-public-envelope.v1` | `claim-evidence-public-envelope` | `public_envelope_digest` |
| evaluation | `claim-evidence-evaluation.v1` | `claim-evidence-evaluation` | `evaluation_digest` |

规则：有 own digest field 的对象只排除本对象该字段，保留所有嵌套 identity；无 own digest field 的对象对完整 exact projection 求摘要。`ProducerPacketIndexV1` exact fields 修正为 `schema_version,producer_node_id,packet_digest,claim_ids,evidence_refs,binding_digests,index_digest`。`PublicClaimResultV1` 不单独摘要，由 public envelope 摘要保护。

- `candidate_digest`：对完整 `ClaimEvidenceCandidateV1` 求 `claim-evidence-candidate` digest；其中 producer packets 只按 `producer_node_id` ASCII 字典序、claims/evidence/bindings 按 predecessor canonical order 归一，因此 candidate digest 独立于 trusted processing order。
- `index_digest`：对单个 index 排除自身 `index_digest` 后求摘要。
- `aggregate_digest`：payload 精确为 `{"producer_packet_index":[<完整 indexes 含 index_digest>]}`；indexes 只按 trusted `approved_processing_order` 排列，schema/object kind 使用上表 aggregate 项。processing order 改变时每个 member `index_digest` 保持不变，但 index 序列、trusted snapshot、aggregate 和全部下游 digest 必须改变。
- `control_ref`：就是 Control 排除自身 `control_ref` 后的 self-excluding digest，不存在第二个 control digest。
- `fact_value_digest`：payload 精确为 `{"fact_key":...,"subject_key":...,"value_type":...,"canonical_value":...,"unit":...}`；entity 使用 `TEXT` 与 null unit，price 使用 `DECIMAL` 与 `CNY`。
- `public_claim_ref`：对 `{"claim_digest":"sha256:<hex>"}` 使用上表 public-claim-ref schema/kind 求摘要；PublicClaimResult 不得携带 raw candidate `claim_id`。
- 生成顺序固定为 public value → claim/evidence → binding → packet → index → response shape → candidate/snapshot → aggregate → claim results → decision → control → internal envelope → public envelope → evaluation。

### Closed literals and deterministic derivation

- `validator_id="p10a-claim-evidence-gate.v1"`，`validator_version="1.0.0"`。
- ClaimResult、Decision 与 PublicEnvelope 的 `status` 只允许 `PASS|BLOCK`；任一 claim result BLOCK 则 Decision/Public 均 BLOCK，否则 PASS。
- `coverage_scope` 只允许 `DECLARED_CLAIMS_ONLY`。
- `uncovered_fields` 是去重、按固定枚举顺序的 tuple，只允许 `FACT_WITHOUT_ADMITTED_BINDING` 与 `INFERENCE_DERIVATION_UNAVAILABLE`；不得复制 claim/source/value/locator/owner/route 或自由文本。PASS 时必须为空。
- ClaimResult reason 按 claim canonical order、每 claim 按 predecessor closed reason enum 顺序去重；Decision reason 为 claim reason 的同序去重聚合；Public 从 Decision 投影，不能重新解释输入。
- `execution_started_at` 与 `gate_completed_at` 都精确等于 trusted context 的 canonical `evaluated_at`；禁止读取 clock。
- source literals 只允许：`source_kind=USER_INPUT|ARCHIVE_REFERENCE|DETERMINISTIC_RENDERER`；`source_assertion_class=USER_ATTESTED|ARCHIVED_REFERENCE|EXACT_TEXT|EXACT_DECIMAL_UNIT`；`category=GENERAL|MARKET_QUOTE|ENTITY_REFERENCE|ARCHIVE_RECORD`。

adapter/comparator executable matrix 穷举如下，表外组合全部 `COMPARATOR_NOT_REGISTERED`；`EvidenceProjectionV1` 与 `EvidenceAuthorityV1` exact fields 均在 `comparator_id` 后新增 `comparator_version`：

| adapter_id | adapter_version | comparator_id | comparator_version | source_kind | assertion | category | freshness | truth ceiling | PASS reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `agent-evidence-protocol.v1` | `1.0.0` | `reference-only.v1` | `1.0.0` | `USER_INPUT` | `USER_ATTESTED` | `GENERAL` | `archive-reference.v1` | `USER_ATTESTED_NOT_INDEPENDENTLY_VERIFIED` | `USER_ATTESTED_BOUND` |
| `shiguan-adopted-reference.v1` | `1.0.0` | `reference-only.v1` | `1.0.0` | `ARCHIVE_REFERENCE` | `ARCHIVED_REFERENCE` | `ARCHIVE_RECORD` | `archive-reference.v1` | `ARCHIVED_REFERENCE_NOT_REVERIFIED` | `ARCHIVED_REFERENCE_BOUND` |
| `deterministic-entity-reference.v1` | `1.0.0` | `exact-text.v1` | `1.0.0` | `DETERMINISTIC_RENDERER` | `EXACT_TEXT` | `ENTITY_REFERENCE` | `entity-reference-86400s.v1` | `EXACT_VALUE_BOUND` | `EXACT_VALUE_MATCH` |
| `deterministic-mainland-last-price.v1` | `1.0.0` | `exact-decimal-unit.v1` | `1.0.0` | `DETERMINISTIC_RENDERER` | `EXACT_DECIMAL_UNIT` | `MARKET_QUOTE` | `current-observation-300s.v1` | `EXACT_VALUE_BOUND` | `EXACT_VALUE_MATCH` |

extractor/public-projection matrix 穷举如下，表外组合全部 `EXTRACTOR_NOT_REGISTERED` 或 `PUBLIC_PROJECTION_MISMATCH`：

| extractor/version | allowed kind | locator | template_id | value/render rules |
| --- | --- | --- | --- | --- |
| `bureau-opinion-clause.v1@1.0.0` | `FACT` | `BUREAU_CLAUSE` | null | public value object必须整体为 null |
| `bureau-opinion-clause.v1@1.0.0` | `OPINION|RECOMMENDATION` | `BUREAU_OPINION` | null | public value object必须整体为 null |
| `jinyiwei-entity-reference-renderer.v1@1.0.0` | `FACT` | `BUREAU_OPINION` | `jinyiwei-entity-reference.v1` | `TEXT`；canonical非空；rendered_value_text精确等于canonical；unit/as_of/rendered_as_of_text均null；source_display=`锦衣卫实体引用` |
| `jinyiwei-mainland-last-price-renderer.v1@1.0.0` | `FACT` | `BUREAU_OPINION` | `jinyiwei-mainland-last-price.v1` | `DECIMAL`正 canonical；unit=`CNY`；rendered_value_text=`<canonical> CNY`；rendered_as_of_text精确等于canonical as_of；source_display=`锦衣卫大陆市场最后价` |

### Trusted constructors and locator authority

- exact public exports 仍只有 predecessor 五项。构造器签名精确为 `TrustedEvidenceContextV1(*, tenant_scope: str, scope_mode: str, tenant_id: None, owner_user_id: str, job_id: str, run_id: str, decree_id: str, draft_fingerprint: str, route_digest: str, evaluated_at: str, approved_processing_order: tuple[str, ...], evidence_authorities: tuple[dict[str, object], ...], approved_locator_authorities: tuple[dict[str, object], ...])`。只接受 exact built-in `str|None|tuple|dict`，拒绝 subclass、list、property/proxy和未知字段；constructor 是明确 caller-trust/server-adapter boundary，不声称自己证明上游来源，但 candidate JSON 永远不能构造或嵌入它。
- 复制前以 iterative trusted walker 执行与 raw parser相同的 depth `<=16`、全root nodes `<=4096`、单个 registered semantic record local nodes `<=512`、string `<=2048 scalars/8192 UTF-8 bytes`；evidence authorities `<=64`、locator authorities `<=64`、processing order `1..64`、全部 claim ordinals合计 `<=4096`、每 authority conflict digests `<=32`。任何超限在复制前 `BUDGET_EXCEEDED`。
- `TrustedEvidenceContextV1` exact fields 增加 `approved_locator_authorities`，并进入完整 trusted snapshot digest。其元素 exact fields 为 `schema_version="claim-evidence-locator-authority.v1",producer_node_id,department_ordinal,bureau_ordinal,claim_ordinals,response_digest`。`response_digest` 必须匹配 `sha256:[0-9a-f]{64}`，并精确等于对 `{"producer_node_id":...,"department_ordinal":...,"bureau_ordinal":...,"claim_ordinals":[...]}` 使用 schema `claim-evidence-response-shape.v1`、object kind `response-shape` 的 domain-separated digest。
- locator authorities 必须按 `(producer_node_id,department_ordinal,bureau_ordinal)` 严格升序，`claim_ordinals` 为无重复严格升序的 `0..63` decimal strings；evidence authorities 必须按 `evidence_ref` 严格升序。duplicate 或乱序在任何 canonical sort 前失败。`approved_processing_order` 保持顺序敏感，不排序。
- producer ID grammar 精确为 ASCII regex `[A-Za-z][A-Za-z0-9_.:-]{0,99}`；同一规则用于 packet `producer_node_id`、`approved_processing_order` 和 locator authority `producer_node_id`。`approved_processing_order` 元素必须 unique，长度 `1..64`，并与 candidate producer packets 的 `producer_node_id` 集合精确相等；missing/extra/duplicate 或同一 packet无法形成恰一 index 时，在排序前 `AGGREGATE_MISMATCH`。
- `BUREAU_OPINION` 必须精确匹配 producer/department/bureau authority；`BUREAU_CLAUSE` 还必须使 claim ordinal 成为该 authority `claim_ordinals` 成员。仅通过 `0..63` 语法检查不足以 admission。
- `EvidenceAuthorityV1` 与 locator authority 不新增 public export；只能作为 TrustedEvidenceContext 构造输入，经 exact schema 验证和深冻结后使用。

### Structural error versus semantic BLOCK

- structural failure 到 code 的映射固定为：lexical/UTF-8/BOM/surrogate/raw-number/syntax/unknown-field/unknown-schema/constructor-type/shape=`PROJECTION_NOT_CANONICAL`；budget=`BUDGET_EXCEEDED`；duplicate JSON key或ID=`DUPLICATE_ID`；registry injection或unknown extractor=`EXTRACTOR_NOT_REGISTERED`；unknown adapter=`ADAPTER_NOT_REGISTERED`；unknown comparator/version/tuple=`COMPARATOR_NOT_REGISTERED`；digest/cross-kind/level=`DIGEST_MISMATCH`；owner/run/decree/draft/route/scope=`IDENTITY_MISMATCH`；freshness/order-invalid=`FRESHNESS_INVALID`；locator/template/renderer=`PUBLIC_PROJECTION_MISMATCH`；numeric=`NUMERIC_VALUE_NOT_EXACTLY_BOUND`；shared conflict=`EVIDENCE_CONFLICT`；processing permutation/index/aggregate=`AGGREGATE_MISMATCH`。unknown未映射 structural failure固定 `PROJECTION_NOT_CANONICAL`。所有异常 `from None`，不得保存或回显底层 cause/context/input。
- 已通过结构与身份校验的候选中，FACT 无 admitted exact binding 或 INFERENCE 因空 derivation registry 不可用，返回完整确定性 `BLOCK` evaluation；不抛自由文本异常。
- OPINION/RECOMMENDATION 合法无证据时返回 PASS/NONFACTUAL；若携带 evidence/derivation 属结构违规并抛错。
- 输出对象不是 public parse input。冻结的 output-tamper 测试修正为：测试内独立 oracle 必须复算每层摘要；对应输入任一字段变化必须改变该层及所有下游 identity，cross-kind/version/level digest splice 必须在其可输入层被拒绝。不得声称存在未导出的 output verify API。
- mutable-after-parse 测试只适用于 TrustedContext 构造输入和返回的 frozen projection；raw parser 只接受 exact `str|bytes`，`bytearray|dict|list|subclass` 必须拒绝。
- reason enum 只有 22 项，`<=32` 是不可达上限；不得伪造第 33 项。边界测试覆盖所有可达集合上限和 unknown reason rejection。

### Parser and public safety

- raw `str|bytes` 必须 exact-type。str 先以 scalars `>262144` 快速拒绝，再以每块最多4096 scalars的 strict incremental UTF-8 encoder累计 bytes，超过262144立即停止且不形成完整 encoded copy；bytes先检查长度。JSON decoder 前必须进行 bounded iterative lexical scan，拒绝 BOM、lone surrogate、NaN/Infinity、raw JSON number、nested duplicate 和非法 UTF-8。
- lexical counting机械规则：root container depth=`1`；仅 object/array child container使depth `+1`；每个 object、array及scalar value各计一个node，object key不计node但按解码后 string budget检查；string在JSON unescape后按Unicode scalars与重新UTF-8编码bytes计数；全root node总数 `<=4096`。`<=512` 只适用于 Claim、PublicValue、Evidence、Binding、ProducerPacketIndex、ClaimResult、EvidenceAuthority、LocatorAuthority 等单个 registered semantic record 的 local projection：计自身container、scalar fields和direct field containers；嵌套 registered record各只计一个opaque node，并由其自身另计local budget。Candidate、ProducerPacket、TrustedContext、Decision、Control、Internal/PublicEnvelope和Evaluation等aggregate/root对象只受全root 4096及各冻结collection/output预算，不受512 local limit。number token按原始ASCII token chars计；边界检查在相应 token/container完成前执行。
- PublicEnvelope 必须从 exact allowlist新建，不得 internal-copy-then-pop。`PublicClaimResultV1` exact fields覆盖 predecessor为 `schema_version,public_claim_ref,kind,status,truth_label,reason_codes`；raw claim_id 不得公开，candidate claim_id 只能匹配 `clm_[0-9a-f]{64}`。成功、BLOCK 和错误路径都不得出现 source/ref/locator/value/timestamp/internal identity/secret canary。
- Decision、Control、Public 三处 `external_effect_authorized=false` 由实现强制生成，不从 candidate 或 trusted input复制。

## Acceptance Criteria

- [ ] predecessor one-child authority保持未消费并明确废弃；本 successor approval 独立基于 `125328d02d8b6899c6ce295690ec3f3416d17258`。
- [ ] 正式 approval commit 只含新 approval、Task、Plan 三路径；machine authority 返回新的 `GO / APPROVED_FOR_ONE_CHILD` 后才实施 exact3。
- [ ] exact3 仍精确 `2 ADD + 1 MODIFY`、全部 `100644`、无新依赖、无第二 runtime/ledger/store。
- [ ] 27 个负向与 9 个正向节点先 RED 后 GREEN；摘要必须由测试内独立 oracle 固定 golden vectors 复算。
- [ ] focused、五组 evidence baseline、backend-full、Ruff、readiness、Harness、doctor、authority regression、V2、结构与 diff-check 全绿。
- [ ] 产品完成后 Governance、Python Design、Security 与 Python Code Review 均 `GO / P0=0 / P1=0 / P2=0`。

## Delivery Constraints

- approvalCommitPaths 只能是本轮正式 approval、Task、Plan 三路径。
- future product paths 仍精确为 `backend/app/agents/runtime_skills/__init__.py`、`backend/app/agents/runtime_skills/claim_evidence_gate.py`、`backend/tests/test_claim_evidence_gate.py`。
- 禁止修改 predecessor 治理文件、P01、readiness、Harness、authority、evidence protocol、锦衣卫、史馆、API、数据库、前端或依赖文件。
- 禁止 donor byte copy、旧 authority/candidate/verification/review继承、P10-B1/B2 偷入、I/O、clock/random/env、mutable registry和 fail-open。

## Affected Modules

- 模块：P10-A Claim-Evidence pure kernel、runtime_skills lazy exports 与独立测试。
- 允许路径：`backend/app/agents/runtime_skills/__init__.py`、`backend/app/agents/runtime_skills/claim_evidence_gate.py`、`backend/tests/test_claim_evidence_gate.py`。

## Technical Plan

冻结本三文件 → 物化正式 approval并普通 fast-forward落地 → 新 machine authority → 唯一 exact3 writer → 36节点真实 RED → 最小纯内核 GREEN → 完整矩阵 → 四路只读独立审查 → 身份冻结 → 单一 candidate commit/普通 fast-forward → P10-B1 successor。任何远端漂移、第四路径、合同冲突、验证失败或 P0–P2 立即 STOP。

## Implementation Report

- 已完成只读诊断；exact3 candidate 工作区仍 clean，predecessor authority 未消费任何产品字节。
- 独立结论：Security `NO-GO / P1`；Python design `NO-GO / P1`；test design `STOP / APPROVAL_CONTRACT_UNDERDETERMINED`。
- 本文件仅补齐治理合同，不批准产品、不构成 candidate 或通过。

## Acceptance Review

状态保持 `DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION / PRODUCT_STOP`。待 strict JSON/schema、productTaskErrors、Harness、canonical/raw/bundle 与独立 Governance/Python/Security 三审全部 GO 后，依常驻 Owner 授权自动物化新 approval；其后仍须新 machine GO。

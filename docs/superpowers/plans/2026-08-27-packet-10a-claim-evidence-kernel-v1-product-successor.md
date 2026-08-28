# Packet 10-A — Claim-Evidence Pure Kernel V1 Product Successor Plan

状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION / PRODUCT_STOP`

任务：`PACKET-10A-CLAIM-EVIDENCE-KERNEL-V1-PRODUCT-SUCCESSOR-20260827`

基线：`origin/ext-dev@29094bc2d7c52f89122338975eddb8130c433c35`

基线 tree：`0028fc93b94aa43e2423141843f92d03642efc22`

## Phase 0 — Freeze Governance Only

1. 当前只创建 proposed approval、Task、Plan；不得物化 `.harness/approvals/`、运行 authority、修改产品、执行产品测试、commit 或 push。
2. 只读核对远端、base tree、当前事实源、donor identity、50 个 first-parent commits 与 exact3 零重叠。任一漂移立即 STOP，不 re-anchor。
3. proposed approval 的 `APPROVED_FOR_ONE_CHILD` 是未来正式 approval 的闭合 schema 值；当前三文件保持 non-authorizing。
4. 对三文件执行 strict JSON、duplicate-key rejection、Draft 2020-12 schema、`validateApprovalManifest`、`productTaskErrors=[]`、精确路径/模式/差异、RFC 8785 canonical/raw/bundle 和完整 Harness。
5. Governance、Python Design、Security 三路审查只读；任一 P0–P2 先修三文件，再重跑全部治理验证和摘要。
6. Owner 精确确认 canonical approval digest 后，才能另行授权正式 approval 物化和一次三文件 commit。

## Phase 1 — Future Approval And Authority

以下均需新授权：

1. 将 proposed JSON 相同 bytes 物化为 `.harness/approvals/PACKET-10A-CLAIM-EVIDENCE-KERNEL-V1-PRODUCT-SUCCESSOR-20260827.json`；proposed 临时路径不得进入 commit。
2. approval commit 必须是冻结 base 的直接单亲子，只含 manifest 三条 `approvalCommitPaths`，全部 `100644`。
3. 普通 fast-forward push 前后只读验证实时 `origin/ext-dev`；漂移即 STOP，禁止 merge/rebase/fetch/pull/force-push。
4. 远端精确等于 approval commit 后只运行一次 machine authority。只有 `GO / APPROVED_FOR_ONE_CHILD` 且 digest 匹配 Owner 确认值时，才可申请 exact3 产品写入。

## Phase 2 — Future RED And Pure Kernel Implementation

1. 从 approval commit 创建唯一、干净、隔离的 candidate 工作区，仅一个产品字节写入者。
2. 先核对基线：`runtime_skills/__init__.py` 为 MODIFY，两个新文件为 ADD；未来结构必须精确 `2 ADD + 1 MODIFY`、全部 `100644`。
3. 在 `backend/tests/test_claim_evidence_gate.py` 先物化 Task 冻结的 27 个负向节点和 9 个正向通过节点。负向分别证明真实 RED；若某节点基线已通过，记录 `PROOF_GAP_NOT_IMPLEMENTATION_DEFECT`，不得伪造 RED。正向必须先证明当前缺少实现而失败，禁止全量 BLOCK 空实现通过。
4. 在 `backend/app/agents/runtime_skills/claim_evidence_gate.py` 实现最小 pure kernel，在 `runtime_skills/__init__.py` 只增加所需显式导出。
5. 禁止 donor byte copy；仅吸收其 claim/evidence binding、canonicalization、numeric grounding 和 independent-review 的有效语义，并适配现行 app 架构。
6. 任何第四条路径、新依赖、I/O、mutable registry、第二套事实源/ledger/authority、旧 runtime 恢复或 B1/B2 需求立即 STOP。

## Phase 3 — Pure Kernel Design Rules

1. 唯一 untrusted public entry 接受 bounded UTF-8 `bytes | str`；raw-size gate 先于 duplicate-preserving/Decimal-token strict parse。已解析对象 helper 只对 parser 生成的 deep-frozen typed projection 私有开放，不接受普通 dict/list。
2. evaluator 分离 `untrusted candidate bytes` 与 server-derived `TrustedEvidenceContextV1`。candidate 自报 admission/source/reviewer/owner/role 全拒；trusted context 只由现有 evidence protocol、锦衣卫或史馆 adapter 构造。
3. 所有 identity 使用 Task 冻结的 `digest_domain + object_kind + schema_version + digest_algorithm + payload` self-excluding SHA-256，逐层绑定 owner/run/decree/draft/route/scope/producer/packet/control；跨 kind/version/level splice 失败。
4. Claim 类型闭合；FACT 必须由 trusted context 证明 admitted evidence binding；v1 INFERENCE 因 derivation registry 为空而 fail-closed；OPINION/RECOMMENDATION 不携带事实证据冒充。
5. EvidenceProjection 只在 internal envelope 承载 purpose-limited identity/source/adoption/locator/value/timestamp；PublicEnvelope 严格使用 Task exact allowlist，默认禁止 source/ref/locator/value/timestamp/内部身份/错误回显和 secret canary。
6. 三 extractor、三 comparator、五 adapter、空 derivation/request-schema registries 及其 literal/version/role 按 Task 冻结为 immutable tuple/map；运行时输入不能添加或替换 handler。
7. 数值使用 exact Decimal；timestamp 使用 trusted context 显式 reference time；locator 使用闭合 schema。禁止近似、隐式 clock 或宽松路径表达。
8. raw bytes、depth、nodes、strings、Decimal、claim/evidence/binding、乘积和 output budgets 使用 Task 的 exact 常量，在 generic container、排序、摘要和 materialization 前 fail-closed。
9. producer packet/index 在聚合前验证唯一 ownership 和 trusted processing order；shared evidence 仅在 canonical projection 相同条件下复用。parse 后只保留深不可变新对象，不保存调用方可变引用。
10. 所有控制与公开信封强制 `external_effect_authorized=false`，输入不得覆盖。
11. exact public symbols 仅为 Task 冻结的五项；`runtime_skills/__init__.py` 只增量更新 `_LAZY_EXPORTS`/`__all__`，不得 eager import 或扩大内部 API。
12. freshness policy 使用 Task 冻结的四项 sealed registry、canonical UTC 与 exact max-age；locator 只接受两种 tagged union 和 `0..63` 无前导零 ordinal。
13. `evidence_snapshot_digest` 必须是完整 TrustedEvidenceContext（含全部 authorities 与 approved processing order）的 domain-separated digest，并被 Decision/Control exact 共用。
14. import 与全部 public API 必须在 monkeypatch filesystem/network/env/clock/random/provider/cache 下证明零访问、零副作用；测试不得靠实现自报。

## Phase 4 — Verification From Zero

同一未变 candidate bytes 上按 proposed approval 运行：

1. 27 个精确负向 pytest nodes 和 9 个精确正向 pytest nodes；正向向量防止永远 BLOCK 的空实现。
2. `backend/tests/test_claim_evidence_gate.py` focused。
3. 现有 evidence protocol、six-ministry controls/gates、Shiguan adopted/archive 五组基线回归。
4. exact3 Ruff。
5. backend-full；proposed approval 以受控 Node wrapper 只对 Python 子进程机械设置 `TMPDIR=/tmp TEMP=/tmp TMP=/tmp`，不得改变 capture、选择器、并发或持久配置。
6. readiness、root Harness、Harness self-test、doctor check/tests、hook self-test。
7. product-authority regression 由 proposed approval 的受控 Node wrapper 只对子进程机械设置 `TMPDIR=/tmp`，不得持久修改系统、用户、Git、Python 或 Node 配置；环境证明进入 verification evidence。
8. V2 convergence check/tests、candidate exact3 structure、`git diff --check`。
9. 任一失败、永久等待、环境 bootstrap 错误、字节漂移或范围扩大立即 STOP；环境错误不得冒充产品通过。

## Phase 5 — Independent Review And Evidence Freeze

1. 全矩阵通过后重新启动独立 Governance Review、Python Design Review、Security Review；治理阶段三审结论不得继承为产品审查。
2. Governance 检查事实源唯一性、P10-A/B1/B2 分层、approval/product paths、身份/authority 生命周期。
3. Python Design 检查纯函数性、类型/不可变性、canonical/digest、Decimal/timestamp/locator、budget-before-materialization、既有 evidence protocol 兼容。
4. Security 检查 parser confusion、digest splice、producer/owner/reviewer spoof、registry injection、resource exhaustion、data leakage 与 fail-closed。
5. 任一 P0–P2 为 NO-GO。三审 GO 后冻结 exact3 raw/blob/mode/bytes、bundle、combined full-index diff、RED/GREEN、verification 和 candidate evidence digest。
6. 完成后 STOP；candidate commit、push、P10-B1、P10-B2、Pilot、Release、发布与部署均等待 Owner 新授权。

## Phase 6 — Future Candidate Commit

1. candidate commit 必须是 approval commit 的直接单亲子，只含 exact3，精确 `2 ADD + 1 MODIFY`，模式全部 `100644`。
2. 提交前后复核 commit/tree/parent、paths/status/mode/raw/blob、bundle、combined diff 和工作树 clean。
3. 任何机器 authority 要求的连续 verification 必须绑定同一 candidate SHA/tree、approval digest 和验证矩阵；失败或字节变化从零开始。
4. 普通 fast-forward push 另行授权；禁止 force-push、merge、rebase、fetch 或 pull。

## P10-B1 And P10-B2 Boundary

- P10-B1 durable commitment 才能设计持久化 claim/evidence/binding/decision identity；必须复用锦衣卫/史馆现有唯一事实源和存储边界，另起 successor。
- P10-B2 runtime activation 才能把已提交 commitment 接入 final memorial、decree、runtime report 的最终真实性门；必须另起 successor 并做真实浏览器/端到端链。
- P10-A 不写数据库，不更改 API，不激活 final writer，不接受“全部功能已融合”或“幻觉已消除”的结论。

## Evidence And Digest Algorithms

- 文件 raw：对原始 UTF-8 bytes 做 SHA-256；Git blob 使用标准 Git blob identity。
- 三文件 bundle：按 path 字典序组成 `{path,mode:"100644",bytes,rawSha256:"sha256:<hex>"}` JSON array，对 RFC 8785 canonical UTF-8 bytes 做 SHA-256。
- proposed approval canonical：strict parse 后对 RFC 8785 canonical UTF-8 bytes 做 SHA-256；raw SHA、canonical digest、bundle digest 不得混称。
- future exact3 bundle 使用同一记录算法；combined full-index diff 按 path 字典序串联逐路径 full-index binary diff bytes 后 SHA-256。
- RED/GREEN 与 verification evidence 必须记录 base、approval digest、candidate SHA/tree、命令、环境归一化、exit code 与输出摘要；donor evidence 只能保留历史标签。

## Stop Conditions

- `origin/ext-dev` 离开冻结 base，或 machine authority 非 GO；
- proposed/formal approval、Task、Plan、schema、digest、路径、模式或 parent 身份不一致；
- exact3 外出现第四条路径、依赖文件、第二写入者或工作树污染；
- 引入 I/O、持久化、网络、clock/random/env、mutable registry、第二套事实源/ledger/authority；
- 将 P10-B1/P10-B2、旧 final memorial/swarm/persistence 偷入 P10-A；
- 27 个负向、9 个正向、focused、baseline、backend-full、Ruff、readiness、Harness、doctor、authority、V2、结构或 diff-check 任一失败；
- 独立 Governance、Python Design 或 Security Review 出现 P0–P2。

触发任一条件立即 `STOP / NO_REANCHOR`，保留证据，申请最窄 successor；不得继承 donor authority、candidate、verification 或 review 身份。

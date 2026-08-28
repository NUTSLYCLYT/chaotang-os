# P10-A Claim-Evidence Kernel V1 Contract-Complete Successor Plan

状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION / PRODUCT_STOP`

任务：`PACKET-10A-CLAIM-EVIDENCE-KERNEL-V1-CONTRACT-COMPLETE-SUCCESSOR-20260828`

基线：`125328d02d8b6899c6ce295690ec3f3416d17258`，tree `0f733e5a7366ddf8aae11abaa032fe6bb59d2d8b`

## Phase 0 — Authority Lifecycle

1. 在 Owner 常驻授权下，将 predecessor `PACKET-10A-CLAIM-EVIDENCE-KERNEL-V1-PRODUCT-SUCCESSOR-20260827` 的 one-child authority 固定为 `ABANDONED_BY_OWNER_STANDING_MANDATE_AFTER_INDEPENDENT_REVIEW_UNCONSUMED / REISSUE_REQUIRED`；新 approval commit 前确认没有 product child。
2. 保留 predecessor 三文件和 clean candidate 工作区作为证据，不修改、不删除、不继承身份。
3. 本 successor 独立基于当前 ext-dev；任何漂移停止，不 re-anchor。

## Phase 1 — Governance Freeze

1. 三文件冻结完整 object-kind/preimage、PacketIndex `index_digest`、candidate/aggregate/control_ref、fact-value、closed status/source/coverage、穷举 registry tuple、public renderer、control time、trusted constructor预算、locator authority、processing permutation、error-code与输出 oracle合同。
2. 执行 strict JSON、duplicate rejection、Draft 2020-12 schema、`validateApprovalManifest`、`productTaskErrors=[]`、完整 Harness、canonical/raw/bundle。
3. Governance、Python Design、Security 独立只读审查；任一 P0–P2 修正三文件并从零复核。
4. 三审 GO 后物化 formal approval，创建三文件直接单亲 commit并普通 fast-forward推送；运行一次新 product authority。

## Phase 2 — RED And Implementation

1. 只在新 approval commit 的唯一隔离 candidate 工作区写 exact3；保持 `2 ADD + 1 MODIFY` 与 `100644`。
2. 先物化 27 负向和 9 正向节点。测试内实现独立 canonical/digest oracle，不调用产品私有 helper；processing-order正向节点精确为 `test_processing_order_change_preserves_member_index_digest_and_changes_aggregate_digest`。
3. 分别证明 parser、budget、digest、binding、registry、numeric、freshness、locator、producer、identity、redaction、purity 和正向三类 factual/nonfactual向量的真实 RED。
4. 最小实现采用 bounded pre-scan、strict parse、deep freeze、sealed registries、双通道 trusted context、逐层 digest 与 allowlist public projection。
5. 不新增输出 verify API；输出 tamper 由独立复算与输入传播测试证明。

## Phase 3 — Verification

在同一未变 bytes 上运行 approval verification 全矩阵：36 exact nodes、focused、五组 baseline、backend-full、exact3 Ruff、readiness、root Harness/self-test/doctor/hook、`TMPDIR=/tmp` authority regression、V2、exact3 structure 与 diff-check。环境临时目录只进程级设置。

## Phase 4 — Independent Review And Landing

1. Governance、Python Design、Security、Python Code Review 均须 `GO / P0=0 / P1=0 / P2=0`。
2. 冻结 raw/blob/mode/bytes、exact3 bundle、combined diff、RED/GREEN、verification 和 candidate evidence。
3. 常驻 Owner 授权下创建一次直接单亲 candidate commit并普通 fast-forward推送；禁止 force-push、merge、rebase。
4. P10-A落地后自动进入P10-B1只读范围冻结；不部署。

## Stop Conditions

远端漂移、machine STOP、第四路径、新依赖、第二事实源/runtime/store、I/O或外部副作用、合同无法唯一复算、验证失败、独立 P0–P2 均立即 STOP并保全证据。

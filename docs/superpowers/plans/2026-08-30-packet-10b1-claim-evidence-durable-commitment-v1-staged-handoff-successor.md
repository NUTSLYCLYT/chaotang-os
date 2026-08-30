# P10-B1 Claim-Evidence Durable Commitment V1 Staged Handoff Successor Plan

## Objective

在 `a41890f0c86c499a4b8133decd73a712baa0f19c / 2df52b20c7ebafd6e7629cc07abdfb777be2ccdd` 上，以同一exact8范围保留durable staged authority handoff，同时完成B1 inert commitment、closed schema与固定HTTP边界，形成不可提交shadow并冻结exact6 prerequisite身份。

## Governance freeze

1. 前序exact8固定为 `STOP / APPROVAL_RUNTIME_CONTRACT_CONTRADICTION / UNCOMMITTED_BYTE_EVIDENCE_ONLY`；其one-child authority按 `ABANDONED_BY_OWNER_UNCONSUMED / REISSUE_REQUIRED` 退出生命周期，不存在product child，authority、candidate、verification和review身份均不得消费、恢复、继承或re-anchor。
2. 新包冻结B1信任边界：B1无non-null writer；未来B2 writer必须另获authority并服从lifecycle/CAS；不得以单一未提交SQLite事务包裹外部authority commit。
3. 校验strict JSON、duplicate key、Draft 2020-12 schema、manifest、product task、路径、模式、Harness与三路只读审查。
4. approval普通FF落地并取得新machine GO后，才允许重物化exact8 shadow；shadow不commit/push。

## RED and GREEN

1. 先锁定六项existing async crash/reconciliation门禁为不可回退GREEN；用状态表覆盖reserve、pending durable、authority commit、durable marker与activation。commit-before-marker永不自动promote，只能在新authority/reissue流程下CAS abandon/reconcile；release false/exception禁止后续commit、marker、activation。
2. 保留preexisting non-null在reserve前固定503/零registry事件；任一明确storage boundary观察到non-null后固定失败关闭。不得用负例宣称未被boundary观察到的post-preflight rogue writer可以跨系统原子化。
3. 恢复staged accept/marker/activation public methods与monkeypatch/ambiguity合同；每个storage transaction继续用SQL NULL CAS。
4. schema用无WAL validation connection在首次shape读取前取得`BEGIN IMMEDIATE`；同一connection/transaction完成dispatch、migration与canonical-new重验，退出closed transaction后才允许runtime WAL。按Task冻结的完整JSON framing与RFC8785 identity算法闭合fresh empty与四种existing shape；两个predecessor canonical rebuild并保持terminal backfill、markers、rows和idempotency mapping。允许事务内canonical child/rebuild对象但最终object set必须精确为exact-new；unknown拒绝前后database bytes、journal mode和sidecar集合不变。
5. worker每个execution/archive/publish storage boundary重验commitment。未来writer协议留给独立P10-B2：新tenant-aware schemaVersion绑定Tenant Principal、owner/job/request/draft/digest/revision，owner-only v1不写入；CAS禁止pending/reservation/commit及所有active/side-effect states，不在B1创建writer或新锁事实源。

## Verification

运行P10-A、exact8 focused（含async integration）、Ruff、POSIX backend-full、readiness、Harness/self-test/Doctor/Doctor tests/hook、authority regression、V2及diff check。shadow approval的raw backend-full/readiness machine commands在prerequisite落地前必须保持STOP，阻止shadow成为product child；人工失败拓扑只允许 `RUNTIME_SCHEMA_CLOSED_DIGEST_MISMATCH` 与 `SIX_MINISTRY_CLOSED_PAIR_MISMATCH`，任何第三根因立即停止。Governance/Python/Security任一P0–P2即NO-GO。

## Prerequisite and final successor

shadow冻结exact8 bundle、new schema digest、65-path runtime fingerprint和successor fingerprint后，不创建product commit。基于最新ext-dev签exact6 compatibility prerequisite，路径仍精确为runtime registry、backup、两套对应测试、Python readiness validator与Node Harness validator。exact6只追加new closed digest与第六ordered pair。其落地后重新签final exact8，byte-for-byte重物化、全矩阵、三审、machine candidate verification和普通FF。

## STOP conditions

远端漂移、machine STOP、第九路径、删除crash recovery、non-null writer、新表/trigger/ledger、第三类backend-full根因、Tenant Principal冒认、验证失败或独立审查P0–P2均立即停止。禁止shadow product commit/push、Pilot、Release和部署。

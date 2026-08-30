# P10-B1 Claim-Evidence Durable Commitment V1 Shadow Lineage Successor Plan

## Objective

在 `ed16947fa233a7753d03eca99bab0257edb50e2c / 4093980ccc86d664c38684d99f71a6c32db05515` 上形成不可提交的 exact7 shadow，机械冻结新 SQLite schema digest、65-path runtime fingerprint 与 prerequisite failure topology。该阶段只提供 inert OWNER_ONLY persistence primitive，不绑定 Tenant Principal、不写 non-null、不激活 runtime truth gate。

## Governance freeze

1. 冻结三文件、exact7、`0 ADD + 7 MODIFY`、predecessor `BYTE_DONOR_ONLY` 和 19-commit zero-overlap lineage。
2. strict JSON、duplicate-key rejection、Draft 2020-12 approval schema、`validateApprovalManifest`、`productTaskErrors=[]`、Harness 与三路只读审查全绿。
3. 创建 direct-single-parent 三文件 approval commit并普通 FF；运行一次 machine authority，非 `GO / APPROVED_FOR_ONE_CHILD` 即停止。

## RED

在三个现有测试文件先形成真实 RED：exact-old→new transactional expand；old logical preimage/row count/idempotency不变；exact-new restart零写；unknown/partial/index/FK/trigger错误零写；closed canonical decoder；legacy NULL replay不变；legal/malformed/spliced non-null对全部 storage mutation、claim sweep/CAS、worker、owner GET/cancel、真实 accept route 零写。

## GREEN

1. `models.py` 只增加 nullable raw commitment字段；公开 response 不增加 sidecar。
2. `storage.py` 在任何 DDL/DML 前做 `BEGIN IMMEDIATE` raw-shape dispatch，只允许单列 ALTER，并以旧列 RFC8785 logical preimage前后等式证明 expand-only。
3. 全部既有行 SELECT/UPDATE/DELETE/CAS 必须同时带 `claim_evidence_commitment_json IS NULL`，新 INSERT 显式写 SQL NULL；不得用 Python 先读替代 SQL 条件。
4. `worker.py` 只 defense-in-depth，non-null job 永不进入 executor、authority或部门调用。
5. `api/decree_jobs.py` 对 legacy NULL保持旧响应，对 non-null返回既有受控 unavailable且零泄漏。
6. 不修改 `api/decrees.py`；真实 accept route若无法由 store boundary闭合则 STOP/改签 exact8。

## Security boundary

- B1 只承认 `OWNER_ONLY / tenant_id=null` 的历史 v1语义，不声称 Tenant Principal。
- 不使用 `RuntimeBindingLedger` 或新 SQLite 作为 truth source。
- 不写 non-null、不进入 `RESULT_READY` truth activation；non-null/B1 commitment 不触发 archive/publish，legacy SQL NULL 作业保持既有 archive/publish 行为。
- P10-B2 必须新 schema/version，并包含 server-owned CurrentUser principal commitment、完整 lease/owner/state/idempotency CAS 与全套 splice/replay负例。

## Shadow verification

1. P10-A、exact7 targeted/focused、Ruff、Harness/self-test/Doctor/hook、authority regression、V2、diff check全绿。
2. POSIX temp backend-full自然结束；完整失败节点必须唯一归因到 `RUNTIME_SCHEMA_CLOSED_DIGEST_MISMATCH` 或 `SIX_MINISTRY_CLOSED_PAIR_MISMATCH`。
3. 机械冻结 seven-file raw/blob/mode/bytes、bundle、combined diff、new schema digest、runtime fingerprint、successor fingerprint与verification evidence。
4. Governance、Python Code、Security任一 P0–P2立即 NO-GO。

## Prerequisite and final successor

shadow双审GO后不创建product commit，authority标记 `ABANDONED_UNCONSUMED / PREREQUISITE_REISSUE_REQUIRED`。随后 exact6 精确覆盖：

- `backend/app/operations/runtime_data_registry.py`
- `backend/app/operations/sqlite_backup.py`
- `backend/tests/test_readiness.py`
- `backend/tests/test_sqlite_backup.py`
- `backend/tests/test_six_ministry_readiness_report.py`
- `scripts/check_harness.mjs`

exact6 只接受 old `sha256:fa4e21efd694b2160197f9202419ed0889b83098e182932ec75231e78fd92b9d` 与 shadow复算 new `sha256:5d928d429bbc134125649a5cbafe320947e0b9150303304cb63186696607707c`；第三值、重复、重排、默认值冒充 observed digest 全拒绝。readiness 旧 5 pair原样同序保留，只允许 Python/Node 同提交原子追加第 6 pair。

exact6 落地后再签 final exact7，byte-for-byte重物化并重新验证；final approval 的 machine matrix 必须显式包含冻结负向节点、POSIX backend-full、exact7结构、Harness与authority回归。P10-B2 tenant-aware runtime activation另行 successor。

## STOP conditions

远端漂移、machine STOP、exact7 第八路径、exact6 第七路径、第三类 full-matrix 根因、non-null写入、Tenant Principal冒认、第二 ledger、旧5 pair被替换/重排、manifest记录默认而非observed digest、验证失败或独立审查 P0–P2 均立即停止。禁止 shadow commit/push、Pilot、Release和部署。

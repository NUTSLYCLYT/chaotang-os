# P10-B1 Claim-Evidence Durable Commitment V1 Exact8 Scope Corrective Successor Plan

## Objective

在 `789586467c70fd6d2f784e2343e4c5f4427e62cf / 71e470018cf105d58c6c592d683abe92d203a89d` 上，以新增且仅新增 `backend/app/api/decrees.py` 的 exact8 scope纠正真实accept-route固定503缺口，形成不可提交shadow并冻结schema/readiness prerequisite身份。

## Governance freeze

1. 冻结exact8、`0 ADD + 8 MODIFY`和exact7的 `STOP / APPROVAL_SCOPE_CONTRADICTION / ABANDONED_UNCONSUMED / BYTE_DONOR_ONLY`。
2. strict JSON、duplicate-key rejection、Draft 2020-12 schema、`validateApprovalManifest`、`productTaskErrors=[]`、Harness和Governance/Python/Security只读审查全绿。
3. 创建direct-single-parent三文件approval commit并普通FF；运行一次machine authority，非 `GO / APPROVED_FOR_ONE_CHILD` 即停止。

## RED and GREEN

1. 保留真实HTTP RED：已有legal non-null commitment的同键请求当前202 replay；并增加different idempotency key/same draft fingerprint的reserve-before-detection RED。两者目标均为固定503、无sidecar、registry零事件、DB完整快照不变。
2. 增加 malformed/spliced、changed-request 409/503优先级、cross-owner无oracle、legacy NULL和专用异常映射负例；在reserve前调用owner+key+request hash+draft fingerprint只读preflight，只允许`decrees.py`从`app.decree_jobs.storage`直接导入并精确捕获commitment-unavailable，不吞并其他storage错误，不修改`decree_jobs/__init__.py`。
3. 完成exact old/new transactional expand、logical preimage与closed decoder。检测型recover/lookup/owner GET/preflight必须读出non-null并抛专用异常；mutation/DELETE/CAS/claim selection才使用SQL `IS NULL`和rowcount，新INSERT显式NULL，绝不能把non-null过滤成absent。
4. worker和owner API defense-in-depth，任何non-null不进入executor、authority、部门、archive或publish。
5. 若需要第九路径或无法保持legacy行为，立即STOP。

## Verification

运行P10-A回归、exact8 focused、Ruff、POSIX backend-full、readiness失败拓扑、Harness/self-test/Doctor/hook、authority regression、V2和diff check。backend-full只允许 `RUNTIME_SCHEMA_CLOSED_DIGEST_MISMATCH` 与 `SIX_MINISTRY_CLOSED_PAIR_MISMATCH` 两类根因；出现第三类立即STOP。三路独立审查任一P0–P2均NO-GO。

## Prerequisite and final successor

exact7 donor精确绑定base `789586467... / 71e470018...`、四条`100644`路径、RFC8785记录array bundle `sha256:dcb9b300d9c0053618a5c4e83ce685bff88af6ec40fe10fbe38763d0ada2b40c`及普通 `/usr/bin/git diff --binary --no-ext-diff HEAD -- <四路径>` stdout摘要 `sha256:319ce7da4828b28510c78a9a3925bd62d575939ac89964df832d17d63c857f90`；仅作byte donor，不继承candidate/verification/review。shadow不创建product commit/push。冻结eight-file bundle、new schema digest、65-path runtime fingerprint与successor fingerprint后，基于最新ext-dev新签exact6 prerequisite：`runtime_data_registry.py`、`sqlite_backup.py`、`test_readiness.py`、`test_sqlite_backup.py`、Python readiness validator和Node Harness validator。exact6只接受old/new closed digest并在旧5 ordered pairs后原子+1。落地后再新签final exact8，byte-for-byte重物化、全矩阵、三审及machine candidate verification后才可普通FF落主线。

## STOP conditions

远端漂移、machine STOP、第九路径、第三类full-matrix根因、non-null写入、Tenant Principal冒认、第二ledger、旧pair替换/重排、验证失败或独立审查P0–P2均立即停止。禁止shadow commit/push、Pilot、Release和部署。

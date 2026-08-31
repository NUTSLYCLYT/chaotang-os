# P10-B1 Claim-Evidence Durable Commitment V1 Final Exact10 Compatibility Successor Plan

## Objective

在 `9e26f3e9de17d3862256936b2234b81f61e2a90f / bb79aab6667963f011f6a60b3cd6378fc419fe9a` 上重新签发 exact10：byte-for-byte 保留 exact8 八文件，只纠正 `test_readiness.py` 与 `test_sqlite_backup.py` 的 old/new schema 测试夹具。恢复 backend-full 的真实兼容性证明，不修改运行时、registry、backup、readiness、Harness 或 authority。

## Governance freeze

1. 新 task ID：
   `PACKET-10B1-CLAIM-EVIDENCE-DURABLE-COMMITMENT-V1-FINAL-EXACT10-COMPATIBILITY-SUCCESSOR-20260831`。
2. approval commit paths 精确为：
   - `.harness/approvals/PACKET-10B1-CLAIM-EVIDENCE-DURABLE-COMMITMENT-V1-FINAL-EXACT10-COMPATIBILITY-SUCCESSOR-20260831.json`
   - `docs/product/tasks/2026-08-31-packet-10b1-claim-evidence-durable-commitment-v1-final-exact10-compatibility-successor.md`
   - `docs/superpowers/plans/2026-08-31-packet-10b1-claim-evidence-durable-commitment-v1-final-exact10-compatibility-successor.md`
3. proposed 临时路径只用于 Owner 冻结摘要；正式物化后必须移除且不得进入提交。
4. 旧 exact8 authority 固定为 `ABANDONED_BY_OWNER_UNCONSUMED / REISSUE_REQUIRED`；旧 candidate、验证、审查和 authority 身份均不得继承。
5. Owner 确认 canonical digest 后才可物化正式 approval；machine STOP 高于本计划。

## Exact10 candidate paths

原 exact8 frozen donor：

1. `backend/app/api/decree_jobs.py`
2. `backend/app/api/decrees.py`
3. `backend/app/decree_jobs/models.py`
4. `backend/app/decree_jobs/storage.py`
5. `backend/app/decree_jobs/worker.py`
6. `backend/tests/test_decree_job_storage.py`
7. `backend/tests/test_decree_job_worker.py`
8. `backend/tests/test_decree_jobs_api.py`

新增兼容测试范围：

9. `backend/tests/test_readiness.py`
10. `backend/tests/test_sqlite_backup.py`

最终结构必须精确为 `0 ADD + 10 MODIFY`、全部 `100644`。原八文件 bundle 必须保持 `sha256:d750580bbc26138589367aba51710097f044c7193eff9ede097b5fc44c7c3b2f`，原八文件 full-index diff必须保持 `sha256:afce5a35187aaa5b7abfd09f7867e1ed8ea67e26937a151e0ce4e33de6e38c97`。

## RED and minimal correction

1. 在新 authority 后先重物化原 exact8 八文件，保留两个兼容测试文件为基线字节，复跑五节点并证明相同失败拓扑。
   在任何测试编辑前冻结两个文件的 `mode/bytes/raw/blob`，并把精确 node IDs、非零 exit code、stdout/stderr SHA-256、approval commit 与 candidate commit 写入 RFC 8785 canonical RED evidence record。
2. 仅在两个测试文件中增加显式 exact-old/exact-new schema fixture，不得用会自动迁移的 `DecreeJobStore()` 表示旧 schema。
3. old/new、single-ALTER、manifest-forgery 和 source/snapshot splice 每个分支在受测操作前断言实际 digest。
4. 不删除、跳过、xfail、重命名逃逸或降低任何原断言；不修改 production code 或门禁。
5. GREEN 必须证明五节点与两个完整测试文件均通过，同时保留 unknown schema、spliced digest和backup mismatch的 fail-closed 语义。

## Verification

- Machine RED：`candidate-compatibility-red-evidence` 从 final `HEAD^` 在 `/tmp` 重建基线，只覆盖 final `HEAD` 的 frozen exact8 八文件，保留两个 pre-edit tests；解析后的 FAILED node IDs 必须与冻结五节点精确同序相等，拒绝任何 `ERROR/XPASS/XFAIL/SKIPPED` summary，终态必须精确为仅 `5 failed`；record 同时绑定 pre/post `mode/bytes/raw/blob`；不修改仓库或 refs。
- Backend compatibility：`python3 -m pytest -q tests/test_readiness.py tests/test_sqlite_backup.py`。
- P10-A：`python3 -m pytest -q tests/test_claim_evidence_gate.py`。
- P10-B1 focused：storage、worker、jobs API、decrees API、async integration。
- Ruff：manifest exact10 全部 Python paths。
- POSIX backend-full：`TMPDIR=/tmp TEMP=/tmp TMP=/tmp python3 -m pytest -q`，不得改变 capture、并发或选择器。
- Readiness：`tests/test_six_ministry_readiness_report.py`。
- Root：Harness、self-test、doctor check/tests、hook、`TMPDIR=/tmp` product-authority regression、V2 check/tests、`git diff --check`。
- Structure：candidate 是 approval commit直接单亲子，只含十条 `M / 100644`；原八文件 identity 精确匹配 donor。
- Reviews：Governance、Python、Security 三路只读独立审查，任一 P0–P2 为 NO-GO。

## Evidence freeze

双审和完整矩阵通过后，重新冻结：

- 十文件 raw SHA-256、Git blob、mode、bytes；
- exact10 bundle 与 full-index diff；
- 五节点 RED→GREEN evidence digest，必须绑定 approval commit、candidate commit、pre/post 两文件 `mode/bytes/raw/blob` identity、精确 node IDs、RED 非零 exit code和 stdout/stderr digest；
- verification evidence digest 与 candidate evidence digest；
- approval commit、candidate commit、tree、parent和实时远端 identity。

不得沿用 exact8 的 candidate、验证、审查或 machine 结论。

## STOP conditions

远端或 donor 漂移、machine STOP、第十一条路径、原八文件任一字节变化、兼容测试之外的新编辑、失败拓扑变化、门禁弱化、backend-full失败、独立审查 P0–P2 或需要扩大范围时立即停止。禁止 force-push、merge、rebase、fetch、pull、Pilot、Release和部署。

## Successor queue

P10-B1 exact10 普通 fast-forward 落地且单航道释放后，才恢复 CT-00 V2 与后续能力融合治理；不得并行形成第二 runtime、第二 authority 或第二事实源。

# P10-B1 Exact10 RED Verifier Corrective Successor Plan

## Goal

在不改变产品字节、authority 实现、Harness 或测试选择器的前提下，修正 machine-bound RED evidence 对 pytest `FAILED <node> - <reason>` 输出的确定性解析，并把冻结 exact10 在全新 one-child authority 下 byte-for-byte 重物化、复验和普通 fast-forward 落地。

## Frozen lineage

- 新 approval base：`d7561f0bf213959c564f4f37636741792719dff7`
- base tree：`5d2d6ab6afd90c9dc463cc8ccaf67d532120bf6d`
- rejected donor：`4cbccf5c5d7a442c96a370734696053931042bf5`
- donor tree：`a8e5138f8b759fafd54eb97f8d66ff5715c2d6e1`
- donor exact10 bundle：`sha256:b331117a553c95d616c7c5bbef5a7f2f43c1031453f1f935ebab582ac1294243`
- donor full-index diff：`sha256:583f451f9ae76baad2a4f92fd9b90f08f300d8375aba81b0f5ca7b928af892d9`

前序 machine verdict 为 `STOP / VERIFICATION_FAILED`。前序 candidate、authority、验证与审查身份全部不可继承；只允许机械复制十文件字节。

## Governance correction

旧 verifier 使用 `^FAILED (.+)$`，会把 pytest 展示后缀 ` - reason` 纳入 node ID。新 verifier 使用双重闭合规则：

1. `FAILED` 后只捕获第一个无空格 node ID；
2. 只允许可选 ` - reason` 展示后缀；
3. 捕获后的 node IDs 必须与冻结五节点精确同序相等；
4. 内层 pytest 必须 exit code `1`；
5. 禁止 `ERROR/XPASS/XFAIL/SKIPPED`；
6. 终态必须唯一匹配 `5 failed`；
7. pre/post 两测试文件 mode/bytes/raw/blob、approval/candidate identity及输出摘要写入 RFC 8785 evidence record。

另加 `candidate-exact10-structure-frozen-identity`：逐文件绑定十条 `100644` 的 bytes/raw/blob，复算 exact10 bundle 与 full-index diff，防止 byte donor 漂移。

## Exact product scope

结构必须精确为 `0 ADD + 10 MODIFY`：

- `backend/app/api/decree_jobs.py`
- `backend/app/api/decrees.py`
- `backend/app/decree_jobs/models.py`
- `backend/app/decree_jobs/storage.py`
- `backend/app/decree_jobs/worker.py`
- `backend/tests/test_decree_job_storage.py`
- `backend/tests/test_decree_job_worker.py`
- `backend/tests/test_decree_jobs_api.py`
- `backend/tests/test_readiness.py`
- `backend/tests/test_sqlite_backup.py`

## Execution sequence

1. 校验三文件 strict JSON、schema、closed contract、Task 合同和完整 Harness。
2. 冻结三文件 canonical/raw/bundle，创建唯一 approval commit并普通 fast-forward。
3. 运行一次新 product authority；非 GO 立即停止。
4. 创建干净 candidate工作区，从 `4cbccf5c5...` 对十路径 byte-for-byte 重物化。
5. 先运行纠正后的 RED verifier和 frozen-identity verifier。
6. 运行 compatibility、P10-A、P10-B1 focused、Ruff、POSIX backend-full、readiness及全部根级门禁。
7. Governance、Python、Security 三路独立只读复审；任一 P0–P2 为 NO-GO。
8. 创建唯一 candidate commit，运行一次 machine verify-candidate。
9. 机器 PASS、远端仍为新 approval时普通 fast-forward；不部署。

## Verification matrix

- Compatibility：`python3 -m pytest -q tests/test_readiness.py tests/test_sqlite_backup.py`
- P10-A：`python3 -m pytest -q tests/test_claim_evidence_gate.py`
- P10-B1 focused：storage、worker、jobs API、decrees API、async integration。
- Ruff：manifest exact10 全部 Python paths。
- Backend-full：`python3 -m pytest -q`，保持默认 capture 与选择器。
- Readiness：`tests/test_six_ministry_readiness_report.py`。
- Root：Harness、self-test、doctor、hook、product-authority regression、V2、`git diff --check`。
- Machine：corrected RED evidence、exact10 structure、exact10 frozen identity、完整 verification matrix。

## STOP and rollback

远端漂移、审批摘要漂移、machine STOP、第十一条路径、任何 donor 字节变化、RED 节点或顺序变化、测试门禁失败、独立审查 P0–P2 时立即 STOP。回滚方式为不推送 candidate；已经落地的治理 approval 保留为历史证据。禁止 force-push、merge、rebase、fetch、pull、Pilot、Release和生产部署。

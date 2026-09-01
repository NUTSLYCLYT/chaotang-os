# P14 Exact30 Readiness Compatibility Verification Environment Corrective Successor

Task ID: `PACKET-14-EXACT30-READINESS-COMPATIBILITY-VERIFICATION-ENVIRONMENT-CORRECTIVE-SUCCESSOR-20260901`

## Status

Draft

`NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本任务是 P14 exact30 readiness exact2 的 forward-only verification-environment corrective successor。前序治理 approval `74200072908fd590617d0723d639490d79431f95 / 69138e8f047ff06e27e712e4ec1931a6d2bc95ee` 已普通 fast-forward 落地，其 exact2 字节在提交前完整矩阵全绿，并形成直接单亲本地 child `b8fe3e13630005db11eb638fbbda30d4417e5ea1 / 132cb2de28a34d9ba2bcc0bfcf38ec07be55a029`。

提交后执行前序 packet 的 17 条 committed-candidate 门禁时，01–05 全绿，06 focused pytest 在测试收集前因默认 `TEMP/TMP=/mnt/c/Users/admin/AppData/Local/Temp` 导致 capture 临时文件 `FileNotFoundError`。同一 committed child 在仅进程级 `TMPDIR=/tmp TEMP=/tmp TMP=/tmp` 下立即 `16 passed`，工作树保持 clean。该事实固定为 `ENVIRONMENT_CONTRACT_MISMATCH / NOT_CANDIDATE_REGRESSION`；但前序 packet 已 fail-closed 停止，因此本地 child 固定为 `REJECTED_POST_COMMIT_ENVIRONMENT_CONTRACT / NO_PUSH / BYTE_DONOR_ONLY / NO_VERIFICATION_INHERITANCE`。

本 successor 不改变 exact2 产品语义或字节，只将所有 pytest 与临时仓敏感验证明确置于进程级 POSIX `/tmp`，并从当前远端 `742000729…` 全新签发三文件 approval。未来 candidate 必须 byte-for-byte 重物化冻结的两文件，重新执行全部 18 条门禁（含 POSIX 临时目录预检）和独立三审；前序 child 不得推送、恢复、继承或 re-anchor。

## Acceptance Criteria

- [ ] approval commit 是 `742000729…` 的直接单亲 child，只新增本轮三份治理文件，全部 `100644`。
- [ ] future candidate 只修改 `backend/tests/test_six_ministry_readiness_report.py` 与 `scripts/check_harness.mjs`，精确 `2 M / 100644`。
- [ ] candidate 两文件 raw/blob/bytes、bundle `sha256:fd7dc8d7afdec2c99df166cd2cdcb231a0ea72b9bcc65b090845880fd7a5be2c` 与 full-index diff `sha256:58b17810b439e5c5f06be297024d96b7974ed6f912c8e75b4d466680186bad3e` 精确不变。
- [ ] old9 原样、同序保留；只追加唯一第十 pair，集合差 `+1/-0`；四 exclusions、69/65、review identity 与 successor paths 不变。
- [ ] focused、backend-full、Harness Doctor tests、product-authority regression 及其他临时仓敏感验证只使用进程级 `TMPDIR=/tmp TEMP=/tmp TMP=/tmp`；预检必须证明 `/tmp` 为 ext4 且具备读写、截断、chmod 与删除语义；不得持久修改系统、用户、Git、Python、pytest 或 Node 配置。
- [ ] 新 candidate 上 18 条 committed-candidate 门禁和 Governance/Python/Security 三审全绿后，才允许普通 fast-forward 推送。

## Delivery Constraints

- 不修改 exact2 donor、P14 exact30 donor、历史 readiness 报告或第三路径。
- 不把默认 Windows 临时目录失败降格为测试通过，也不以 pre-commit 证据替代 post-commit 门禁。
- 不创建第二套 readiness、Harness、authority、事实源或运行时。
- 不 push `b8fe3e136…`，不 merge、rebase、force-push、Pilot、Release、生产发布或部署。

## Affected Modules

- 模块：六部 readiness Python/Node closed ordered-pair validators 的验证环境合同。
- 允许路径：`backend/tests/test_six_ministry_readiness_report.py`、`scripts/check_harness.mjs`。

## Technical Plan

1. 冻结本三文件治理包并等待 Owner 精确确认 canonical digest。
2. 普通 fast-forward 落地 approval，从最新 ext-dev 创建唯一隔离 candidate。
3. 从 rejected child 或原 donor byte-for-byte 重物化 exact2 两文件；不得继承 candidate 或验证身份。
4. 在明确 POSIX 临时目录的进程环境中运行 18 条门禁和独立三审。
5. 仅全部 GO 后创建直接单亲 exact2 candidate commit，重新运行 committed-tree/remote/byte/完整矩阵，再普通 fast-forward 落地。
6. 基于新的 ext-dev 重签 P14 exact30 successor，并关闭已登记的 CDP/edge promise cleanup P1。

## Implementation Report

尚未实施新 successor。前序本地 child `b8fe3e136…` 的身份与 exact2 donor完全一致；默认环境 post-commit gate06 失败，进程级 POSIX 临时目录诊断复验 `16 passed`。该 child 未推送，实时 `origin/ext-dev` 保持 `742000729…`。

## Acceptance Review

待本治理包冻结、新 candidate 重新物化、18 条 committed-candidate 门禁及独立三审完成后填写。通过只证明 exact2 兼容 pair 在闭合 POSIX 验证环境下安全落地，不证明 P14 exact30、Gate B、Pilot、Release 或部署完成。

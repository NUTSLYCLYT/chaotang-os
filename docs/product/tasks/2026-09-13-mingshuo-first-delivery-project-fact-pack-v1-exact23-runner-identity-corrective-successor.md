# 铭硕第一交付 Project Fact Pack V1 Exact23 Runner Identity Corrective Product Successor

任务 ID：`MINGSHUO-FIRST-DELIVERY-PROJECT-FACT-PACK-V1-EXACT23-RUNNER-IDENTITY-CORRECTIVE-SUCCESSOR-20260913`

冻结基线：`origin/ext-dev@b1e7f0e66b21a1dcc8e0df626de367a5df8bad08`；tree：`8f1c2736e3c188b68910e53d38bbff3bafc56971`。

## Status

Draft

`DRAFT / NON_AUTHORIZING / WAITING_FOR_OWNER_EXACT_DIGEST_AND_PREDECESSOR_DISPOSITION`

## Product Definition

本 forward-only successor 只解决 exact22 验收暴露的一个确定性运行时身份矛盾。exact22 已把 `scripts/run_rc1_release_acceptance.mjs` 更新为包含第八个 runtime data registry identity 的 runner，但 `backend/app/operations/sqlite_backup.py::_TRUSTED_RUNNER_SHA256` 仍冻结旧 runner 摘要；因此真实 SQLite backup 门禁拒绝当前 runner。测试不能删除或放宽，runner 也不能回退，否则会丢失铭硕运行库的 Release/backup 身份。

新候选精确为原 exact22 二十二路径加 `backend/app/operations/sqlite_backup.py`，结构 `5 ADD + 18 MODIFY`，全部 `100644`。第 23 条路径仅更新 `_TRUSTED_RUNNER_SHA256` 为 `sha256:98cdd5e95b0dce4621d578a6a5f1f95885ef4afbdda90122465b1ce642b05d1d`，不得改变备份、恢复、冷写保护、进程身份、锁、凭据、路径或 fail-closed 语义。

目标 runner 来自保全工作区 `/home/ubuntu/ct-p4/mingshuo-first-delivery-exact22-lineage-corrective-candidate-20260913`，该 donor 绑定 HEAD `b1e7f0e66b21a1dcc8e0df626de367a5df8bad08`；runner identity 为 mode `100644`、bytes `178951`、raw SHA-256 `98cdd5e95b0dce4621d578a6a5f1f95885ef4afbdda90122465b1ce642b05d1d`、Git blob `0c1cc91690856344b09fc22195ba2b242f65acb0`。这些身份只证明待重物化字节，不赋予 donor candidate 身份。

前序 exact22 产品尝试保持 `STOP / APPROVAL_SCOPE_CONTRADICTION / UNCOMMITTED_BYTE_EVIDENCE_ONLY`。在 Owner 明确处置其未消费 one-child authority 前，本草案不产生 approval、candidate、验证继承或执行权。处置后，exact22 的 22 文件只可作为 `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE` 重物化，旧 authority 不得 re-anchor。

## Acceptance Criteria

- [ ] 正式三文件未来只能成为 `b1e7f0e66b21a1dcc8e0df626de367a5df8bad08` 的直接单亲子，且 machine authority 只批准一次 exact23 child。
- [ ] 候选精确为 manifest 的 23 路径、`5 ADD + 18 MODIFY`、全部 `100644`，不得出现第 24 路径。
- [ ] `scripts/run_rc1_release_acceptance.mjs` raw SHA-256 精确为 `98cdd5e95b0dce4621d578a6a5f1f95885ef4afbdda90122465b1ce642b05d1d`，运行时可信常量精确绑定相同带前缀摘要。
- [ ] `backend/app/operations/sqlite_backup.py` 除该常量外无其他差异；相关负向测试继续证明篡改 runner、错误进程身份、预建冷写会话与凭据漂移均 fail-closed。
- [ ] approval 自身的不可变 `v17-exact23-byte-contract` 必须从最终 candidate commit 机械证明 runner raw/bytes、trusted constant 单字面量替换、精确 `5 ADD + 18 MODIFY` 和全部 `100644`；不得仅信任候选可修改的测试。
- [ ] exact22 的 Fact Pack、tenant/owner、幂等、source provenance、network namespace、Release registry 和脱敏错误合同全部重新验证，不继承旧通过结论。
- [ ] focused、backend-full、Ruff、Release/relay、Harness/doctor/hook、authority regression、V2、diff 全绿；Governance、Python、Security 三审无 P0–P2；machine verify-candidate PASS。

## Delivery Constraints

- 只允许 proposed approval 冻结的 exact23；第 23 条路径只修正单一可信 runner 摘要，不得顺手重构。
- 不修改 readiness、Scene Pack、WorkProduct、会计、军机处、史馆、前端、BFF、Harness、authority、外部配置或其他数据库语义。
- 不读取客户数据或凭据，不调用 IMA/MCP/外部模型，不生成真实报价，不确认、下载、归档、发布、交易或部署。
- 远端漂移、machine STOP、第 24 路径、第二 evaluator/registry、来源/谱系校验放宽、测试失败或独立审查 P0–P2 时立即停止。

## Affected Modules

- 模块：铭硕 Fact Pack 第一交付、唯一 evaluator relay、runtime data registry、SQLite backup trusted-runner identity 与离线 Release 验证。
- 允许路径：proposed approval 中精确 23 条 product paths；新增范围只有 `backend/app/operations/sqlite_backup.py`。

## Technical Plan

1. Owner 明确放弃 exact22 未消费 authority 后，物化本 successor 正式三文件并取得新 machine GO。
2. 从 exact23 approval commit 建立唯一隔离 candidate；机械重物化 exact22 的 22 条 donor 字节，再只在第 23 条路径更新 trusted runner 摘要。
3. 先证明当前 exact22 字节稳定触发摘要矛盾 RED；更新常量后重跑 SQLite backup focused，确认 runner identity 及既有安全负例 GREEN；最终 candidate 必须再通过 approval 内不可变的 `v17-exact23-byte-contract`。
4. 运行 manifest 全矩阵；独立 Governance/Python/Security Review 检查范围、身份、备份安全、tenant/credential 边界和来源隔离。
5. 字节冻结后创建唯一直接单亲 candidate，复跑受 commit identity 影响的 relay/lineage 与完整矩阵，再执行 machine verify-candidate。
6. 只有机器 PASS、实时远端仍为 approval、路径/模式/摘要不漂移时，才可在后续既有授权覆盖下普通 fast-forward；禁止 force-push 和生产部署。

## Implementation Report

只读复验已在 exact22 未提交字节上稳定得到 `137 passed / 1 failed`；唯一失败为 `backend/tests/test_sqlite_backup.py::test_cli_rejects_a_prebuilt_cold_writer_session`。当前 runner raw SHA-256 为 `98cdd5e95b0dce4621d578a6a5f1f95885ef4afbdda90122465b1ce642b05d1d`，而运行时常量仍为 `sha256:9731695663de08fd4bb65ee2f02d36ed85b3d1355cc54e263a94b2c506946c07`。该失败证明真实运行时完整性断裂，不是测试或环境噪声。

本轮仅编制治理草案；未修改 exact22 donor、未修改产品、未运行新 authority、未提交或推送，也未部署。

## Acceptance Review

Pending strict validation, independent Governance/Python/Security Review, Owner predecessor-authority disposition and exact canonical digest confirmation. 治理草案通过只证明 exact23 范围可供审批，不代表产品已实施或铭硕第一交付闭环已经完成。

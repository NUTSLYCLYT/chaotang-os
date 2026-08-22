# Packet 14 Trusted Artifact Delivery Gap Fix — Single-child Plan

## Contract

- Task：`PACKET-14-TRUSTED-ARTIFACT-DELIVERY-GAP-FIX-V1-20260822`
- Base：`4f32ddff8c9b7ea151dc1f3253ae1fac946a74d1`
- Base tree：`fb87583f550f28d183674559f738b5e06a01afbe`
- Contract SHA-256：`8a40347854ad88d75ca92dd6dba5771ffb7d722f93f7d01b3db101d293fad1dc`
- Product scope：approval manifest 中按字典序冻结的21条路径；路径 4 只允许 P15 synthetic runtime 三项机械兼容修正，路径 11 只允许六部旧测试 fixture/error expectation 与已审 P14 语义对齐。
- Transition：authorize → RED → V2 trigger expand → app/API/BFF/UI adapt → real-stack/full verification → one product child。

## Execution Sequence

1. **Governance**：P14 合同必须先作为单文件单亲提交进入 ext-dev；随后三件套作为第二个独立单亲治理提交。
2. **Authorize**：运行 `node scripts/product-authority.mjs --authorize --task PACKET-14-TRUSTED-ARTIFACT-DELIVERY-GAP-FIX-V1-20260822`；非 GO 立即停止。
3. **RED**：仅用临时 SQLite/产物根复现合同15节点中的已知失败，不碰生产/用户数据。
4. **Storage floor**：以独占事务 expand `confirmation_receipts_guard_insert_v2`，steady state verify-only；加入 P15 唯一 registry。
5. **Application/API**：同事务核 owner/run/PUBLISHED/payload/manifest/file digest，脱敏 public receipt，FastAPI raw bounded parser。
6. **Download/BFF**：稳定 FD、有界 private spool、原子 lease；Next same-origin bounded strict parser 与 length/cancel 校验。
7. **UI**：只在服务端回显 PUBLISHED 后主动加载并展示一次性确认；legacy 无 WorkProduct 保持 download-only。
8. **Synthetic compatibility**：仅在 `backend/app/operations/sqlite_backup.py` 让 synthetic WorkProduct 使用真实
   semantic digest、`synthetic-reply` 和 `user:synthetic-owner`；不得改变 backup/rehearse/writer-stop/release 语义。
9. **Verify**：P15 隔离锁定环境执行后端全量与 Ruff，确认全量测试集合包含 P14 精准文件与第 21 条六部测试；不得再用宿主/user-site Python 生成冗余精准矩阵。随后验证 P15 synthetic backup/rehearse、前端全矩阵/build、P09/P15、V2、Harness 与真实双 owner browser journey。
10. **Review**：独立 backend/frontend/security review；任何 P0/P1 或 NOT_RUN 阻断 candidate。
11. **Handoff**：机器 verify-candidate PASS 后报告 candidate SHA/tree、21路径 diff、证据与回滚，等待 Owner 产品推送决定。

## Stop Conditions

- origin/ext-dev 不再等于 approval commit，或 machine authority 非 GO；
- 需要第22条产品路径、新表/列、新 API namespace、新格式、上传、自动发布或第二 ledger；
- `backend/tests/test_six_ministry_accounting_evidence_adapter.py` 的修改超出 publish-before-confirm、真实 management XLSX binding 与 tamper non-enumerating expectation 三类机械测试对齐；
- `backend/app/operations/sqlite_backup.py` 的修改超出合同冻结的 synthetic digest、reply_id、actor 三项；
- M0/候选需要真实用户数据、secret、外网、真实模型、生产路径、raw trace/HAR、持久 activation 或部署；
- P09-A、P15 registry/readiness/backup/release 身份或 digest 不能精确重放；
- V2 trigger 迁移存在弱 guard 空窗，或 activation 后必须 full revert 才能恢复；
- 下载使用整文件分配、重新打开未验证路径、无界 spool/lease，或 BFF/API 依赖 last-key-wins JSON；
- RED 通过删除/放宽测试获得，或任何 mandatory node 为 FAIL/BLOCKED/NOT_RUN；
- 独立审查仍有 P0/P1。

命中任一条件即保持产品不变，修订合同并重新取得独立 M0；不得隐式扩面。

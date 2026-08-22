# Packet 14 Trusted Artifact Delivery Gap Fix — Single-child Plan

## Contract

- Task：`PACKET-14-TRUSTED-ARTIFACT-DELIVERY-GAP-FIX-V1-20260822`
- Base：`90bb3abd53af4cbb988d74fb818ec76c731576f5`
- Base tree：`be98a2dfc1e981ab40946f1d8f909460522aa583`
- Contract SHA-256：`3c6616245eab3a64d28702c38fd7703cf3303deac0520940ede35f43a5839a58`
- Product scope：approval manifest 中按字典序冻结的19条路径。
- Transition：authorize → RED → V2 trigger expand → app/API/BFF/UI adapt → real-stack/full verification → one product child。

## Execution Sequence

1. **Governance**：P14 合同必须先作为单文件单亲提交进入 ext-dev；随后三件套作为第二个独立单亲治理提交。
2. **Authorize**：运行 `node scripts/product-authority.mjs --authorize --task PACKET-14-TRUSTED-ARTIFACT-DELIVERY-GAP-FIX-V1-20260822`；非 GO 立即停止。
3. **RED**：仅用临时 SQLite/产物根复现合同15节点中的已知失败，不碰生产/用户数据。
4. **Storage floor**：以独占事务 expand `confirmation_receipts_guard_insert_v2`，steady state verify-only；加入 P15 唯一 registry。
5. **Application/API**：同事务核 owner/run/PUBLISHED/payload/manifest/file digest，脱敏 public receipt，FastAPI raw bounded parser。
6. **Download/BFF**：稳定 FD、有界 private spool、原子 lease；Next same-origin bounded strict parser 与 length/cancel 校验。
7. **UI**：只在服务端回显 PUBLISHED 后主动加载并展示一次性确认；legacy 无 WorkProduct 保持 download-only。
8. **Verify**：后端全量与精准矩阵、前端全矩阵/build、P09/P15、V2、Harness，随后真实双 owner browser journey。
9. **Review**：独立 backend/frontend/security review；任何 P0/P1 或 NOT_RUN 阻断 candidate。
10. **Handoff**：机器 verify-candidate PASS 后报告 candidate SHA/tree、19路径 diff、证据与回滚，等待 Owner 产品推送决定。

## Stop Conditions

- origin/ext-dev 不再等于 approval commit，或 machine authority 非 GO；
- 需要第20条产品路径、新表/列、新 API namespace、新格式、上传、自动发布或第二 ledger；
- M0/候选需要真实用户数据、secret、外网、真实模型、生产路径、raw trace/HAR、持久 activation 或部署；
- P09-A、P15 registry/readiness/backup/release 身份或 digest 不能精确重放；
- V2 trigger 迁移存在弱 guard 空窗，或 activation 后必须 full revert 才能恢复；
- 下载使用整文件分配、重新打开未验证路径、无界 spool/lease，或 BFF/API 依赖 last-key-wins JSON；
- RED 通过删除/放宽测试获得，或任何 mandatory node 为 FAIL/BLOCKED/NOT_RUN；
- 独立审查仍有 P0/P1。

命中任一条件即保持产品不变，修订合同并重新取得独立 M0；不得隐式扩面。

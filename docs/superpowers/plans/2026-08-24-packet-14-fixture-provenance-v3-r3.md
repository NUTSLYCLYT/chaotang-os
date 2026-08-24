# Packet 14 Fixture Provenance V3 R3 — Governed Plan

## Contract

- Task：`PACKET-14-FIXTURE-PROVENANCE-V3-R3-20260824`
- Target：`origin/ext-dev`
- Base/tree：`caf040a8d537c4bb4dc44db8b2008089eda82a4d` /
  `9e613368c3d76367b932fb0b0d43969759a03d2f`
- Amendment raw SHA-256：`c63b9968b512565f243227d882af7aadc7896ffbebd4f11132b1fcd0b1f4fd88`
- Proposed manifest digest：`sha256:5c3213ed7d32c527414d770075d5ed971378f42f0049c4ca20148ea93c12c140`
- Product scope：R2 exact32；protected Harness/authority/readiness fingerprint consumer 不属于本产品 child。
- Exit：3个P1与2个P2修复、exact32验证和独立复审全零后冻结最终 fingerprints，停止并进入 compatibility/final M0。

## Governed Sequence

1. 核对远端 base/tree、amendment raw SHA、task ID、approval closed schema、exact32和三文件路径。
2. 建立 collision、generation evidence graph、cleanup observed ledger、fixture UI provenance、confirmation/download fairness 的 RED。
3. 计算 manifest canonical digest与三文件 raw/bundle摘要，完成只读独立治理复审。
4. Owner 精确确认摘要后，只创建恰含三文件、direct parent等于冻结base的本地approval commit。
5. Owner 再确认 commit/tree 后，才允许普通 fast-forward push；不得强推、合并或提交产品代码。
6. 远端双读稳定后，先在外部协调工作树 `/home/ubuntu/Projects/chaotang-os` 运行
   `node scripts/execution-authority.mjs --authorize`，单独清除本次用户任务的 legacy `docs/plans` inventory STOP；
   再在全新干净 ext-dev child 仅运行 canonical
   `node scripts/product-authority.mjs --authorize --task PACKET-14-FIXTURE-PROVENANCE-V3-R3-20260824`。
   前者不是 ext-dev 产品 GO，后者也不能豁免前者；不得在 ext-dev child 调用不存在的 legacy 脚本。
7. 从旧 exact32 dirty candidate 只读提取最小补丁，在新 child 逐文件复核后重放；旧 worktree 永不直接提交。
8. 修复 deterministic ID collision：DB 先拒绝、原子 no-replace、异常补偿不丢旧 bytes。
9. 修复 generation proof：解析并封存真实生成 evidence graph，所有 verdict 从证据推导，raw/prefixed污染负测。
10. 修复 cleanup proof：真实操作时写 ledger，绑定命令结果与 terminal probe，拒绝合成时间线和客户端自报。
11. 修复 fixture UI provenance 与资源公平性，同时保持 owner isolation、完整性重验和 no-store。
12. 跑 exact32 确定性矩阵和独立复审；P0–P3 任一非零则继续修复，不冻结 fingerprints。
13. 全零后记录最终 runtime/successor fingerprints并停止，不修改 protected consumers，不创建candidate commit。
14. 后继 compatibility/final M0 才更新 readiness pair、运行 full backend/Harness/Doctor、创建 isolated candidate，
    并完成同一candidate-bound REALSTACK、GENERATION、DELIVERY-BROWSER 与真实 Chromium 双 Owner 验收。

Bundle 摘要算法固定为：按 `approvalCommitPaths` 排序，为每个文件记录
`{path,bytes,sha256:"sha256:<raw-file-sha256>"}`，放入
`{schemaVersion:"governance-bundle.v1",files:[...]}`，对其 RFC 8785 canonical UTF-8 bytes 计算 SHA-256。
Bundle 摘要不写回这三个文件，避免自引用。

## Required RED

- deterministic artifact ID 已存在、目标文件抢占、并发创建和补偿失败均保持旧 row/bytes/identity。
- generation stdout/evidence graph 含 raw/prefixed workbook digest、fixture ID/digest/work-product/binding/receipt 时拒绝；
  只给 exit=0 或自报 `generationEligible=true` 不得通过。
- cleanup 缺真实 CREATE/DESTROY/PROBE、输出摘要、时间或 identity 时拒绝；late recreate、乱序、硬编码成功拒绝。
- delivery fixture 默认 UI 明示非真实成果；DTO splice 丢 provenance 时测试失败。
- terminal confirmation 重放不得在 SQLite 写锁内执行大文件哈希；需要完整性重验时使用 stable FD 在事务外哈希，
  再用短事务重验状态、identity 与摘要；并发确认不得长期锁住 SQLite writer。
- 下载 lease 取消、超时、断连、慢消费者和跨 Owner 竞争均释放资源且不造成永久饥饿。
- oracle bytes/ZIP metadata/entry digests任一漂移在任何写入前失败关闭。

## Verification Matrix

Approval 内12项按 ID 排序：

1. `backend-focused-pytest`
2. `backend-ruff`
3. `candidate-acceptance-blocked`（固定非零，阻止本包形成candidate eligibility）
4. `frontend-build`
5. `frontend-lint`
6. `frontend-tests`
7. `frontend-typecheck`
8. `product-authority-regression`
9. `release-evidence-regression`
10. `release-recovery-regression`
11. `root-harness-doctor-regression`
12. `v2-convergence-regression`

本包必须另外人工记录：`git diff --check`、exact32 equality、runner fixture/proof negative tests、最终 raw/prefixed
forbidden set、reviewer verdict 和未运行的 compatibility矩阵。后继 final M0 必须运行 backend full、Root Harness/Doctor、
真实浏览器、控制台、截图和同一candidate-bound三证明；不得把本包的focused结果替代final acceptance。

## Stop Conditions

- remote/base/tree/amendment SHA/task ID/manifest digest/exact32/authority 任一不符。
- 外部协调工作树的 legacy `docs/plans` inventory drift 尚未通过独立治理修复；它是本次用户任务的额外 STOP，
  不是 frozen ext-dev authority 架构的一部分，product authority GO 不构成豁免。
- 需要第33产品路径，或需要修改 protected Harness、authority、CI、ADR、readiness fingerprint consumer。
- 旧 dirty worktree 被直接提交、推送、merge、rebase、cherry-pick或作为authority child。
- proof只绑定exit code/命令元数据、cleanup ledger事后合成、fixture默认UI被漂白、资源耗尽风险未关闭。
- 需要生产数据、真实用户工作簿、secret、公网、现有浏览器profile或不可逆外部动作。
- 独立复审 P0–P3 任一非零，或任何失败测试被隐藏、跳过、改成mock或放宽门槛。

## Rollback

- 治理草案：未提交时只放弃三文件；不影响产品和已落地 amendment。
- approval commit：未推送时放弃隔离 worktree；推送后用新的 forward-only successor，禁止重写历史。
- 产品 child：失败时保留证据并放弃 child；不 reset、stash、clean 或覆盖用户工作树。

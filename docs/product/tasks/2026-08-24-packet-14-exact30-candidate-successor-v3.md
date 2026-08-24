# Packet 14 — Exact30 Candidate Successor V3

> 状态：`DRAFT / OWNER_DIGEST_REQUIRED / PRODUCT_STOP`
>
> Task ID：`PACKET-14-EXACT30-CANDIDATE-SUCCESSOR-V3-20260824`
>
> Proposed manifest digest：`sha256:9a312f9c29a0ac0b49a898e0c3e7e3873d67998e7dd0ffde9fcfdb7b6733d126`

## Status

Draft

本 V3 是 P14 的唯一 exact30 收敛入口。三件套只存在于隔离草案区；Owner 精确接受 manifest 与 packet digest、三件套成为
冻结 base 的直接单亲子、远端双读稳定、canonical product authority 返回 GO，且项目级 execution authority 不再 STOP 前，
产品保持停止。

## Product Definition

- Target：`gitee.com/msxn/chaotang-os` / `origin/ext-dev`。
- Base commit/tree：`a0a2c9793bb13035be3be7214ccde8a17663932d` /
  `7b0d0e190f5dd0ebb191c25174608119b06c286a`。
- 范围：approval manifest 中逐字排序的 exact30；两个 work-product BFF cancellation 路径继续由独立 exact2 Packet 处理，
  不得重放 exact32 或暗增第31/32路径。
- 并行 R3：远端 `PACKET-14-FIXTURE-PROVENANCE-V3-R3-20260824` 是 exact32 reviewed-bytes 包，包含故意非零的
  `candidate-acceptance-blocked`，机器虽可返回 product-work GO，但 `canAcceptProductCandidate=false`。它不作为本长任务的产品施工
  authority；本 V3 只吸收其经审查的安全修复语义，不激活 exact32。
- Workbook oracle：完整执行已落地 correction amendment，raw SHA-256
  `c63b9968b512565f243227d882af7aadc7896ffbebd4f11132b1fcd0b1f4fd88`；冻结 1689-byte workbook、raw SHA-256
  `9f11480835418351644da35e5d195686fd64a4a52dde1bf730c268cd298f7c33`、独立 sealed base64 oracle 和五项 ZIP 投影。
- Byte donors：reviewed-remediation exact30 vector
  `sha256:1fc98bd1092108c794ee8bbb505df7e88f18625df0184d67ea59c7463eef2f43` 与 V3-R2 exact30 projection
  `sha256:091053aa4c9b95de4b5fdaaa446622cdff5da2de83e0f7c0c66eda535becf6d9`；23/30路径不同，均只作语义供体。

## Required Remediation

### P1 — artifact collision no-replace

- deterministic artifact ID 在任何文件移动前由 `BEGIN IMMEDIATE` 拒绝已存在 row；碰撞必须零文件写入、零数据库变化。
- canonical pending 文件使用原子 no-replace/reservation，不得覆盖旧目标；RED 保持旧 row、bytes、inode/identity 与输入状态。

### P1 — generation proof binds real evidence

- `P14-GENERATION` 解析并封存实际 accounting generation envelope、artifact/work-product、evidence graph 与服务端 poststate。
- capability/provenance/eligibility/contamination 从证据推导；禁止只扫描命令元数据或硬编码 PASS。
- fixture 任一 ID/digest/work-product/binding/receipt 以及 workbook raw/prefixed SHA 进入真实 generation graph 均失败关闭。

### P1 — cleanup is observed

- 11 类资源在真实 PLAN/CREATE/DESTROY/PROBE 时记录时间、调用身份、退出状态和输出摘要，不得事后合成 1ms 时间线。
- residual、late recreate、identity swap、daemon/权限不可达、缺 probe、乱序或超时均阻止 receipt/round。

### P1 — raw bearer never persists

- raw session ID 只允许存在于 Cookie jar、认证请求和 runner 私有内存；不得进入文件、argv/env/stdin capture、command record、
  stdout/stderr 或 evidence。
- 跨进程只传 canonical digest，Python 从 closed DB rows 重算并唯一匹配；崩溃/失败路径全树 canary 零命中。

### P2 — visible provenance and resource fairness

- 默认确认面明确显示“受控测试夹具、不是实际业务成果、不能作为 generation/release PASS”；DTO 到 UI 不得丢 provenance。
- terminal confirmation 的大文件哈希使用 stable FD 在写事务外完成，再以短事务重验状态、identity 与摘要。
- 下载 lease 按 Owner 公平、短且可回收，取消/断连释放并有界重试；不降低 owner isolation、完整性、no-store 或大小门槛。

## Acceptance Criteria

- [ ] Owner 精确接受 manifest 与三件套 packet digest；治理提交严格三路径、直接单亲、普通 fast-forward。
- [ ] canonical product authority 对 exact Task ID 返回 GO；项目级 execution authority 同时返回 GO。当前后者因未登记的
  `docs/plans/CHAOTANG_MOVABLE_TYPE_LANGGRAPH_IMPLEMENTATION_BLUEPRINT_V1.md` 返回 STOP，只能通过独立治理修复，不能绕过。
- [ ] 产品 changed paths 逐字等于 exact30；需要第31路径立即 STOP。
- [ ] 四个 P1、两个 P2 与 oracle 完整派生矩阵逐项先 RED 后 GREEN。
- [ ] backend focused/full/Ruff/isolated candidate、frontend tests/lint/typecheck/build、release、authority、Root Harness/Doctor/V2 全绿。
- [ ] root + Docker + Chromium 双 Owner + nft + RED 真实预推绑定同一 commit/tree；REALSTACK、GENERATION、DELIVERY-BROWSER
  三证明互不替代。
- [ ] code/Python/TypeScript/security 独立终审 P0=P1=P2=P3=0。
- [ ] 只生成精确 candidate commit/tree/diff/evidence digest 请求 Owner 授权；授权前不推送、不发布、不部署。
- [ ] exact30 推送并双读后立即建立独立 exact2；exact2 完成前不宣称 P14 总体完成。

## Delivery Constraints

- 不 reset、clean、stash、覆盖主工作树、用户未提交资产、生产数据、existing browser profile 或 secret。
- 不复制、merge、rebase、cherry-pick 旧 dirty candidate；逐路径重放经证明的最小语义。
- sealed oracle expected 与 candidate actual 独立；禁止 actual-as-expected、client 自报 PASS 或 fixture 冒充 generation。
- 治理提交、产品 candidate、release/deploy 分别授权。

## Affected Modules

- 模块：artifact lifecycle、accounting work-product、fixture provenance、release evidence、confirmation/download fairness。
- 允许路径：严格等于
  `.harness/approvals/PACKET-14-EXACT30-CANDIDATE-SUCCESSOR-V3-20260824.json` 的 `request.productPaths` exact30。
- Backend：artifact storage/download/confirmation、accounting work-product、SQLite runtime registry/backup/readiness。
- Frontend：report-artifact confirmation/download BFF、backend client provenance DTO、StudyArtifact confirmation/links UI。
- Release：offline build/verify、RC1 acceptance、generation/cleanup/proof/replay contracts。
- Tests：approval exact30 内的 backend/frontend/release 回归；两个 work-product cancellation BFF 路径留给独立 exact2。
- Protected：Harness、authority、CI、ADR、readiness fingerprint consumers、数据库 schema 与 API namespace 均不在产品 child。

## Technical Plan

1. 三件套获批后只提交推送三条治理路径并双读；产品仍 STOP。
2. 独立解除项目级活字计划 inventory STOP；canonical product authority 与项目 authority 均 GO 才建立产品 child。
3. 在 exact30 内融合两个 donor、oracle correction 与并行 R3 安全修复，不吸收 exact2/exact32。
4. 四个 P1、两个 P2 逐项 RED/GREEN，随后运行全部确定性矩阵。
5. 独立代码与安全终审后，运行 root + Docker + Chromium + nft + RED 真实预推。
6. 冻结精确候选身份请求 Owner 产品授权；获批后普通快进，随后独立 exact2。

## Implementation Report

- 旧 V2 三文件治理 commit `f8aaeae36847231007882c4bc3ea2f4defbfe457` 在本地创建后，因远端并行前进被普通 push
  安全拒绝；未强推、未进入远端。
- 并行 exact32 R3 已在远端落地并返回 product-work GO，但项目 execution authority 仍 STOP，且 R3 明确不能接受 candidate。
- V2 预检证据继续作为非授权基线：authority 12/12、release evidence 15/15、release recovery 115/115、Convergence
  20 passed / 1 skipped、Root Harness 与 Doctor PASS。
- 当前只编制 V3 治理草案；未修改、提交或推送产品文件。

## Acceptance Review

Pending。当前只证明两个并行 P14 方向已收敛到一个 exact30 合同，不证明产品候选或真实链路完成。下一决策点是 Owner 是否接受
V3 三件套摘要；即使治理落地，项目级 execution authority STOP 仍必须独立解除。

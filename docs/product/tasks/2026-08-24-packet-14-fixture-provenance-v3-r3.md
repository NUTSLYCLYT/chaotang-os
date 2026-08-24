# Packet 14 — Fixture Provenance V3 R3

> 状态：`DRAFT / NON_AUTHORIZING / PRODUCT_STOP`
>
> Task ID：`PACKET-14-FIXTURE-PROVENANCE-V3-R3-20260824`
>
> Proposed manifest digest：`sha256:5c3213ed7d32c527414d770075d5ed971378f42f0049c4ca20148ea93c12c140`

## Status

Draft

本三件套不产生产品执行权；只有 Owner 精确确认最终 manifest 与 bundle 摘要、
三件套以冻结 base 的直接单亲子落到 `origin/ext-dev`，且 exact Task ID 的 product authority 返回 GO 后，
并且本次任务的外部协调工作树门禁不再返回 STOP，才允许在全新隔离 child 中修改产品代码。

## Product Definition

- 目标：把 Packet 14 V3 候选收口到真实、不可漂白、可回放的前后端交付链路。
- 冻结 base commit/tree：`caf040a8d537c4bb4dc44db8b2008089eda82a4d` /
  `9e613368c3d76367b932fb0b0d43969759a03d2f`。
- Workbook oracle correction amendment：
  `docs/migrations/2026-08-24-packet-14-workbook-oracle-correction-amendment.draft.md`，raw SHA-256
  `c63b9968b512565f243227d882af7aadc7896ffbebd4f11132b1fcd0b1f4fd88`。
- 继承范围：R2 exact32，逐字、排序、数量均保持不变；不得把受保护的 Harness、authority、CI、ADR 或
  readiness fingerprint consumer 塞入产品候选。
- 当前候选只作为只读证据输入：旧 dirty worktree 不得直接提交、推送或作为 product authority child；
  取得 GO 后只把经复核的最小产品 diff 重放到新 child。

## Required Remediation

### P1 — artifact collision must be no-replace

1. `create_pending(... deterministic_artifact_id=...)` 在任何文件移动前，以 `BEGIN IMMEDIATE` 锁定并拒绝已存在
   `artifact_id`；碰撞必须零文件写入、零数据库变化。
2. canonical pending 文件落位必须使用原子 no-replace/reservation 语义，不得用可覆盖目标的 `Path.replace()`。
3. RED 必须证明碰撞后旧 row、旧 bytes、旧 inode/identity 与两个输入文件均保持合同要求的状态。

### P1 — generation proof must bind real evidence

1. Generation proof 必须解析、验证并封存真实 accounting generation 输出或持久化 evidence graph；
   只记录 stdout/stderr 长度与摘要不足以证明内容未受 fixture 污染。
2. `capabilityId`、`provenanceClass`、`generationEligible` 和 contamination verdict 必须由被验证证据推导，
   不得由 runner 硬编码 PASS。
3. raw 与 `sha256:` prefixed workbook digest、fixture IDs/digests/work-product/binding/receipt 任一进入真实 generation
   evidence graph 都必须失败关闭；共享 candidate/source/auth 值不得误拒。

### P1 — cleanup evidence must be observed, not synthesized

1. PLAN/CREATE/DESTROY/PROBE ledger entry 必须在真实操作发生时记录真实时间、命令/调用身份、退出状态与输出摘要。
2. Docker、listener、browser process、marker/session/data root 的 terminal negative observation 必须绑定实际 probe，
   不得在 cleanup 结束后按布尔值补造连续 1ms 时间线或硬编码 `SUCCEEDED`。
3. Replay 必须重新验证实际 lifecycle ledger 与 terminal probe 绑定；late recreate、identity swap、缺 probe、乱序或超时均拒绝。

### P2 — user-visible provenance and resource fairness

1. 浏览器确认面必须明确显示“受控测试夹具、不是实际业务成果、不能作为 generation/release PASS”；
   capability/provenance/generationEligible 不得在 DTO 到 UI 的过程中丢失。
2. terminal confirmation 可先做廉价只读 preflight；若现有完整性合同要求重验，则必须用 stable FD 在写事务外完成哈希，
   再以短 `BEGIN IMMEDIATE` 重验状态、文件 identity 与摘要后提交，重复请求不得长期持有 SQLite 写锁。
3. 下载 lease 必须具备按 Owner 公平性、短且可回收的租约、取消释放和有界重试；两个认证调用方不得长期饿死其他用户。
4. 不得降低发布前完整性重验、owner isolation、`private, no-store` 或最大文件大小门槛。

## Acceptance Criteria

- [ ] 三件套最终 raw/bundle 摘要获 Owner 精确确认，并只作为 base 的直接单亲子提交、普通 fast-forward 推送。
- [ ] 新干净 worktree 上 exact Task ID 的 product authority 明确返回 GO。
- [ ] 在外部协调工作树 `/home/ubuntu/Projects/chaotang-os` 运行
  `node scripts/execution-authority.mjs --authorize`，不再因 `docs/plans` inventory drift 返回 STOP。
  这是本次用户任务的额外前置检查，不属于 frozen ext-dev child 的 canonical product authority，
  也不得在 ext-dev child 中调用不存在的 legacy 脚本。
- [ ] 产品 diff 严格等于 exact32；需要第33产品路径立即 STOP。
- [ ] 上述 3 个 P1 与 2 个 P2 均先 RED、后最小 GREEN，并有负向回归。
- [ ] 修正 oracle 生成的 workbook bytes、ZIP metadata、entry digests、artifact/work-product/binding/postimage 链逐项一致。
- [ ] focused backend、Ruff、前端700项、Lint、TypeScript、生产构建、release runner 与 authority 回归通过。
- [ ] code、Python、TypeScript、安全独立复审达到 P0=P1=P2=P3=0。
- [ ] 冻结最终 product fingerprints 后停止；不得在本包内修改 protected readiness/Harness consumers。
- [ ] 后继 compatibility/final M0 更新并验证 readiness pair，随后运行 backend full、Root Harness/Doctor、
  isolated candidate、真实 Chromium 双 Owner 与三份 candidate-bound 证明。

## Scope and Safety

- 唯一允许产品路径：approval manifest `request.productPaths` exact32。
- 明确保护：大殿结构、军机处、翰林院、认证模型、生产数据库 schema、API namespace、真实数据、用户工作簿、
  现有浏览器 profile、secret、公网、真实模型、支付/发布/删除/外发及其他不可逆动作。
- 不新建前端 BFF/route，不增加第二事实源、第二 ledger、生产 fixture 或第25个蜂群。
- 不 reset、clean、stash、覆盖用户修改；不 commit/push 产品代码，不 merge/rebase/release/deploy。

## Delivery Constraints

- 交付顺序固定为：三件套摘要确认 → 单亲子治理提交 → 单独推送确认 → machine GO → 新 child 产品修复 →
  exact32 验证与独立复审 → fingerprint compatibility → final M0。
- 本 R3 只交付 reviewed product bytes 和最终 fingerprint 输入，不交付可接受 candidate，不宣称真实浏览器验收完成。
- 每个产品文件修改前复核已有 diff；旧 dirty candidate 只读，不直接 commit、push、merge、rebase 或 cherry-pick。
- 所有错误必须失败关闭；禁止通过删除测试、放宽 schema、伪造来源或把 DEMO/FALLBACK 漂白为 LIVE 换取通过。

## Affected Modules

- 模块：artifact lifecycle、fixture provenance、release evidence runner、浏览器确认与资源公平性。
- 允许路径：严格等于
  `.harness/approvals/PACKET-14-FIXTURE-PROVENANCE-V3-R3-20260824.json` 的 `request.productPaths` exact32。
- 后端：artifact storage/download/confirmation、SQLite backup/fixture seed、runtime registry/readiness projection。
- 前端：report-artifact BFF cancellation/no-store、backend client provenance DTO、StudyArtifact confirmation/links UI。
- 发布验证：offline build/verify 与 RC1 acceptance runner 的 generation、cleanup、proof、replay contracts。
- 测试：仅 approval exact32 内的 backend/frontend/runner 回归；protected readiness/Harness consumer 留给后继 compatibility。

## Technical Plan

1. 在新获权 child 重放 exact32 的已审最小差异，并立即建立5组阻断问题的 RED。
2. 先修 artifact no-replace 与廉价 terminal preflight，再修下载公平性，保持 owner isolation 和完整性重验。
3. 贯通 delivery fixture provenance 到默认 UI，明确非真实成果且禁止晋级 generation/release PASS。
4. 让 generation proof 消费真实 evidence graph；让 cleanup ledger 在真实操作时生成并绑定 terminal probes。
5. 重放修正后的 workbook oracle，逐项核对 ZIP metadata、entry、DB、work-product、binding、postimage 与 receipt。
6. 运行 focused matrix 和独立复审；全零后冻结 fingerprint 输入并停止，交给 compatibility/final M0。

## Verification Boundary

本 R3 是 reviewed-product-bytes 包，不是假装 final acceptance。approval matrix 只包含 exact32 可独立证明的确定性命令，
并保留公开、无副作用、故意非零的 `candidate-acceptance-blocked`。`backend-full-pytest`、Root Harness/Doctor 和
真实 candidate acceptance 依赖最终 fingerprint compatibility，不在本包内伪绿；它们必须由后继 final M0 在同一
candidate commit/tree 上补齐，不能以 mock、fallback、NOT_RUN 或静态数据替代。

## Implementation Report

- 当前仅创建 successor task、plan、approval 草案。
- Amendment 已以单文件提交 `caf040a8d537c4bb4dc44db8b2008089eda82a4d` 落到 `origin/ext-dev`，并完成两次远端核验。
- 旧 R2 dirty candidate 共有 exact32 修改；前端700/700、Lint、typecheck、build通过；backend 4185通过、4跳过，
  仅2项 readiness fingerprint预期失败；Ruff通过。
- 最终独立复审阻断为3个P1、2个P2；本 R3 将它们全部纳入，不把测试通过误写成可交付。
- 外部协调工作树的 execution authority 当前仍因未登记的
  `docs/plans/CHAOTANG_MOVABLE_TYPE_LANGGRAPH_IMPLEMENTATION_BLUEPRINT_V1.md` 返回 STOP；该治理差异必须独立修复，
  本产品 approval 不修改或绕过它。Frozen ext-dev child 的唯一产品 consumer 仍是
  `node scripts/product-authority.mjs --authorize --task PACKET-14-FIXTURE-PROVENANCE-V3-R3-20260824`。
- 未修改或提交任何产品代码；未运行真实 candidate/browser，因为 machine GO 尚未产生。

## Acceptance Review

- 当前结论：`Pending`。治理草案结构完成前不请求摘要确认；machine GO、产品修复和 final acceptance 均未发生。
- 已有证据：amendment 单文件远端落地；R2 exact32 候选的前后端矩阵；三路独立复审的3个P1与2个P2。
- 放行条件：三件套治理复审全零、Owner 双阶段确认、product authority GO、产品复审全零，以及后继 final M0
  的 full backend、Harness、真实浏览器和三份 candidate-bound 证明全部通过。
- 当前不得声称：产品已完成、前后端全部可用、真实发布验收完成或 candidate 可提交推送。

## Rollback

- 三件套未提交前：删除这三个草案即可，不影响已落地 amendment 或用户工作树。
- approval commit 未推送前：放弃该隔离 worktree 即可。
- 产品阶段：只在新 child 重放；失败时保留证据并放弃 child，不修改历史、不强推、不覆盖用户文件。

# Packet 14 — Exact30 Candidate Successor V3

> 状态：`IN_PROGRESS / BUILDX_REAL_CLI_P1 / GOVERNANCE_AMENDMENT_REQUIRED / PRODUCT_STOP`
>
> Task ID：`PACKET-14-EXACT30-CANDIDATE-SUCCESSOR-V3-20260824`
>
> Proposed manifest digest：`sha256:ec466d73c16bd0b86cccc26ea67a028b4165364f94d308cde8b5de76207dbd3d`

## Status

In Progress

本 V3 是 P14 的唯一 exact30 收敛入口。verification-contract amendment 已作为
`13a78831395c40b2b1bc73d4d6ff9d89d6854af4` 落地；canonical product authority 对 digest
`sha256:934da038a53f8cd7fd2d5306b91e4e8990c96959234112cdd29a932ae0340f46` 返回 GO。其本地 exact30 候选
`54656b4cfc60d4830eb92a4b4735541b4ea4cef1` / tree `6ef7a89836a6703565f452120af4b9d2e1926805` 已通过 15 项
candidate authority 与独立代码/安全终审，P0=P1=P2=P3=0。

专用发行版 `Chaotang-RC1-Validation-SSD-20260818` 随后安装并冻结合同精确 Docker `29.6.1`、Buildx `v0.35.0`、
BuildKit `v0.31.1`。在启用 nft 和完整真实预推之前，真实 runner 命令
`docker buildx inspect --bootstrap --format {{json .}}` 稳定返回 exit `125 / unknown flag: --format`；`buildx inspect --help`
证明该冻结版本只支持 `--bootstrap`、`--builder`、`--debug` 与 `--timeout`。现有单元测试以 mock JSON 返回 BuildKit 版本，未覆盖
真实 CLI surface。独立 supported-interface probe 进一步证明 `buildx ls --format {{json .}}` 在同一空 Docker data root 返回唯一
`Current=true` / `Driver=docker` builder，且 `Nodes[0].Version=v0.31.1`。这是新的 P1 verification-contract defect，旧候选只保留
作失败审计，不得推送。

本 successor amendment 只把三件套重锚到 `13a788…af4`，增加 toolchain version drift/downgrade non-goal，并把真实 CLI
RED/GREEN 与 replacement candidate 要求纳入闭环；exact30/exact2、产品路径、既有 verification、业务语义和冻结工具版本不变。
新三件套获批、落地、远端双读且 canonical authority 对新 digest 返回 GO 前，产品保持停止。

## Product Definition

- Target：`gitee.com/msxn/chaotang-os` / `origin/ext-dev`。
- Base commit/tree：`13a78831395c40b2b1bc73d4d6ff9d89d6854af4` /
  `d7d9d4a9b41e93e029436ae4f95a4c2fd1af7afd`。
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

### P1 — Buildx real CLI compatibility

- Docker `29.6.1`、Buildx `v0.35.0`、BuildKit `v0.31.1` 身份不变；禁止通过升级、降级或替换二进制绕过失败。
- runner 只能调用 Buildx `v0.35.0` 真实支持的参数，并必须从真实 builder 状态验证 BuildKit 精确为 `v0.31.1`；解析错误或
  版本缺失均 fail-closed。
- 已证明的机器可读接口为 `buildx ls --format {{json .}}`，其 stdout 是每 builder 一条 JSON 的 NDJSON；successor 必须逐非空行
  严格解析并只接受唯一 current builder、`Driver=docker`、非空 `Nodes`、全部 `Status=running` 且全部 `Version=v0.31.1`，重复
  current、空节点、非法行或未知字段形状均拒绝。
- 测试必须先复现 unsupported `inspect --format` RED，再证明 supported CLI GREEN；mock executor JSON 只能作逻辑单测，不能替代
  专用发行版真实命令预检。

### P2 — visible provenance and resource fairness

- 默认确认面明确显示“受控测试夹具、不是实际业务成果、不能作为 generation/release PASS”；DTO 到 UI 不得丢 provenance。
- terminal confirmation 的大文件哈希使用 stable FD 在写事务外完成，再以短事务重验状态、identity 与摘要。
- 下载 lease 按 Owner 公平、短且可回收，取消/断连释放并有界重试；不降低 owner isolation、完整性、no-store 或大小门槛。

## Acceptance Criteria

- [ ] Owner 精确接受 Buildx successor amendment manifest 与三件套 packet digest；治理提交严格三路径、直接单亲、普通
  fast-forward。
- [ ] `origin/ext-dev` canonical product authority 对 exact Task ID 返回 GO，approval digest 与 Owner 接受值精确一致。
- [ ] 共享主工作区的 legacy execution-authority 保持 fail-closed；它不属于 P14 authority chain，不得被修改、伪装、移植或解释为
  P14 GO。事实依据：目标分支不包含该 consumer；legacy V1 固定 `AMENDMENT_REQUIRED / INACTIVE / STOP`；legacy V2 无 active
  work package 且没有 P14 task identity。
- [x] 产品 changed paths 逐字等于 exact30；需要第31路径立即 STOP。
- [ ] 五个 P1、两个 P2 与 oracle 完整派生矩阵逐项先 RED 后 GREEN；前四个 P1 的既有 GREEN 不替代 Buildx P1。
- [ ] backend focused/Ruff/installed-wheel isolated full candidate、frontend tests/lint/typecheck/build、release、authority、Root
  Harness/Doctor/V2 全绿；不得用 host/user-site Python 替代 installed candidate 证据。
- [ ] root + Docker + Chromium 双 Owner + nft + RED 真实预推绑定同一 commit/tree；REALSTACK、GENERATION、DELIVERY-BROWSER
  三证明互不替代。
- [ ] replacement candidate 的 code/Python/TypeScript/security 独立终审 P0=P1=P2=P3=0；旧候选终审不得继承。
- [ ] 只生成精确 candidate commit/tree/diff/evidence digest 请求 Owner 授权；授权前不推送、不发布、不部署。
- [ ] exact30 推送并双读后立即建立独立 exact2；exact2 完成前不宣称 P14 总体完成。

## Delivery Constraints

- 不 reset、clean、stash、覆盖主工作树、用户未提交资产、生产数据、existing browser profile 或 secret。
- 不复制、merge、rebase、cherry-pick 旧 dirty candidate；逐路径重放经证明的最小语义。
- 不向 host 或 user-site Python 安装候选，不把 checkout `app` 与持久 site-packages metadata 拼接为验收证据。
- 不改变或漂移 Docker/Buildx/BuildKit 冻结版本来适配 runner；修复发生在 exact30 内的 runner/test 兼容合同。
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

1. verification-contract 三件套获批后只提交推送三条治理路径并双读；产品仍 STOP。
2. 在干净、隔离的 `origin/ext-dev` 身份上取得 canonical product authority 精确 GO 后，才建立产品 child；共享主工作区 legacy
   authority 继续 fail-closed，不把活字计划 inventory 漂移带入或解释为 P14 权限。
3. 旧 `54656b…cef1` 保留审计但不得修改或推送；在 exact30 内建立 replacement child，不吸收 exact2/exact32。
4. 先完成 Buildx 真实 CLI RED/GREEN，再复核原四个 P1、两个 P2 与全部确定性矩阵。
5. 独立代码与安全终审后，先运行冻结 Buildx CLI 预检，再运行 root + Docker + Chromium + nft + RED 真实预推。
6. 冻结 replacement commit/tree/diff/evidence digest 请求 Owner 产品授权；获批后普通快进，随后独立 exact2。

## Implementation Report

- 旧 V2 三文件治理 commit `f8aaeae36847231007882c4bc3ea2f4defbfe457` 在本地创建后，因远端并行前进被普通 push
  安全拒绝；未强推、未进入远端。
- 并行 exact32 R3 已在远端落地并返回 product-work GO，但 R3 明确不能接受 candidate，也不作为本 exact30 authority。
- V2 预检证据继续作为非授权基线：authority 12/12、release evidence 15/15、release recovery 115/115、Convergence
  20 passed / 1 skipped、Root Harness 与 Doctor PASS。
- 首个 V3 三件套已作为 `6fc07f4b4fb52a11b164f44bc2fbe9c9532a6c54` 推送；机器核验后发现任务文档额外要求的
  legacy GO 在目标分支不存在、在共享主线又按规范不可达。当前只重签原三件套；未修改、提交或推送产品文件。
- authority-correction 三件套已作为 `c174872f42c31b3d7a20c727a7c42c4a136c45dc` 推送并双读；legacy authority 继续
  fail-closed，canonical product authority 对 exact Task ID 返回 GO 后才恢复隔离施工。
- 六部继任指纹 amendment 已作为 `02546eeb85cc84c944942673ab194c1e28972378` 普通快进推送并双读；在该干净 HEAD
  重新运行 canonical product authority 返回 `STOP / APPROVAL_COMMIT_PARENT_INVALID`，证明旧 approval 不能跨越后继治理提交复用。
- 前次 re-anchor 仅更新 approval/task/plan 的 base/tree 与 manifest digest；productPaths、verification、nonGoals、exact2 隔离和
  legacy fail-closed 语义逐字保持不变。
- exact30 当前严格 30 路径，`git diff --check` 与 Ruff 通过；runner 51 passed / 1 sandbox-only skip，offline build 19/19，
  offline verify 27/27，backend 受影响矩阵 250/250，frontend 703/703 且 lint/typecheck/build 全绿。
- 独立代码终审与安全终审均为 GO，P0=P1=P2=P3=0。继任内容指纹为
  `sha256:268cab13e516d0f716f600819f2bddc8242269312d392eca4ed1be2de05ce051`；该六部继任指纹 amendment 只把该精确值加入与
  runtime 指纹 `sha256:c95630be3d79f2641ff6e483f4096b0763b9e5071544f1e0ead0d7e24eb1cba5` 配对的封闭允许集合。
- re-anchor 三件套已作为 `aade8f8e6a1a5fc8a5c39a420394eec9d8e70622` 推送；exact30 V3 候选
  `86f5b12c4064f6ed2bfefef800cbd2091b6fd439` / tree `baa188f961a1fbe0464f730912678f2627d4019c`
  已完成 isolated runtime-lock：4200 collected、4195 passed、5 skipped、0 failed，candidate wheel digest
  `sha256:ae4ea737ec025cbb3e4ec6d871093128e4a2a247b38ae710ba3d442d7007e3c2`。
- candidate authority 的 focused gate 在相同净化环境中 255/255 通过；raw full gate 为 4192 passed、4 skipped、4 failed，
  失败均为 host Python 缺失 installed distribution metadata。独立终审定级 P1/NO_GO，并禁止写 user site。相同 runtime-lock
  在 300 秒硬限下再次以 239.92 秒全绿，证明保留 gate 可在 authority 上限内完成且没有降低覆盖。
- verification-contract amendment 已作为 `13a78831395c40b2b1bc73d4d6ff9d89d6854af4` 普通快进推送；其 exact30 candidate
  `54656b4cfc60d4830eb92a4b4735541b4ea4cef1` / tree `6ef7a89836a6703565f452120af4b9d2e1926805` / patch digest
  `sha256:1ae8666a991a9b69c973046eece73a80621263b925e3c8134287690f6e1e59c2` 已通过机器 15 gates 与独立终审。
- 专用 RC1 的真实 Buildx `v0.35.0` 预检对候选 runner 命令返回 exit `125 / unknown flag: --format`；runner raw SHA-256
  `07c177830ee62a03726ef5d5d9c2f288293a6ddfb62415c3cd0b0c56b3c74c07`。失败发生在 nft/完整预推之前；没有推送、发布或部署。
  候选副本、容器、隔离 Docker data、临时网络状态均已清理，专用发行版已停止。
- 同一冻结二进制的 supported-interface probe 证明 `buildx ls --format {{json .}}` 返回 current Docker builder 与
  `Nodes[].Version=v0.31.1`；probe 使用全新空 data root，完成后再次清除 daemon data/socket/config 并停止专用发行版。

## Acceptance Review

Pending。旧 exact30 产品字节、机器 gates、installed-wheel 与独立终审已经完成，但真实冻结 Buildx CLI 证明 runner 参数合同
不兼容，因此 `54656b…cef1` 不可推送。本 successor 三件套获批并落地后，必须建立 replacement candidate，先关闭真实 CLI P1，
再重新取得 authority GO/PASS、独立终审并运行 Root Harness/Doctor、其余全回归与 root + Docker + Chromium + nft + RED 真实预推。
当前不证明任何产品候选可推送、发布或部署；下一决策点是 Owner 是否接受本 successor amendment manifest 与 packet digest。

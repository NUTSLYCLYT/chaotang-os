# Packet 14 — Exact30 Candidate Successor V4

> 状态：`DRAFT / RELEASE_ACCEPTANCE_CLOSURE / PRODUCT_STOP`
>
> Task ID：`PACKET-14-EXACT30-CANDIDATE-SUCCESSOR-V4-20260824`
>
> Product authority：`NOT_YET_ISSUED`

## Status

Draft

当前只有治理准备授权；本 task 不授予产品施工、提交或推送权限。

## Product Definition

在不牺牲既有 P14 功能、证据强度、工具版本和 exact2 边界的前提下，建立 replacement exact30 candidate，并关闭三项真实发布阻断：installed-wheel 外部配置布局、trusted runner 候选外固定、cleanup 绝对截止时间。

## Canonical identity

- Repository/branch：`gitee.com/msxn/chaotang-os` / `ext-dev`
- Governance base：`525acd21e38dd388a77c5361c9ef89257cd23de5`
- Governance base tree：`cb42dd9d7fb4d695d04bbe3e10b2d12e6ae11b88`
- Supersedes：`PACKET-14-EXACT30-CANDIDATE-SUCCESSOR-V3-20260824`
- Product paths：逐字等于 V3 approval exact30；path-set digest
  `45a46a2e70a4e8a526287cadef3740e3b6e833159ba5168e5236576f0ba8c276`
- Delta boundary：新增差异只允许 `scripts/run_rc1_release_acceptance.mjs` 与其 `.test.mjs`；其余 28 条 exact30 必须等于
  Gate B Owner-confirmed Gate A reviewed-baseline raw manifest。
- Separate scope：两个 work-product cancellation BFF 路径继续由独立 exact2 Packet 处理。

## User-visible outcome

本任务不增加新页面或业务功能。完成后，用户已有前后端能力在正式发布验收中能由“真正安装的后端 wheel”完整运行；发布器不能靠候选自证可信，也不会因清理动作挂死而无限阻塞。

## Required outcomes

### 1. Installed candidate is real and complete

- 测试只导入隔离 wheel 与同一安装中的 distribution metadata。
- runner 从冻结 candidate snapshot 确定性 staging 外部 `backend/config`，形成与 Docker `/app/app` + `/app/config` 等价的只读布局。
- candidate-external expected inventory 固定为当前 base tree 的两条普通文件：`jinyiwei_mcp.yaml`（6958 bytes，
  `71e36188…16f79`）与 `providers.yaml`（797 bytes，`82614f8a…4a1e`）；禁止 candidate 枚举生成 expected。
- 不修改 `backend/pyproject.toml` 或 `backend/config/**`，不把配置或 secret 打进 wheel。
- installed-wheel 全量从已观测的 `4025 passed / 105 failed / 4 skipped` 收敛到 `4130 passed / 0 failed / 4 skipped`。

### 2. Runner trust is externally anchored

- Gate A 只允许物化本地 candidate；冻结后由独立工具计算 pin，Owner 在 Gate B governance parent 中确认 expected。
- candidate-external、root-owned immutable supervisor 从同一 `O_NOFOLLOW` FD 流式 copy-and-hash，前后 `fstat`，对临时副本 `fsync`、只读封存、
  原子发布后再启动；禁止 hash 后重新按路径打开。候选 runner 不是自己的 trust root。
- actual 从 candidate stable bytes 计算，并在任何候选代码导入、evidence 写入或外部动作前由 supervisor 比较。
- self-hash、自报 JSON、candidate actual-as-expected 均不得铸造 trusted identity。

### 3. Cleanup has a hard end

- 单调时钟 absolute deadline 覆盖每个 Promise、subprocess、probe 与 remove。
- deadline 到达必须中止当前动作并有界返回；不能靠动作返回后的 timestamp 判断代替中止。
- candidate-external supervisor 在启动前独立冻结 total/cleanup/grace/finalization 四个预算，以 cgroup v2 hard watchdog 执行
  `SIGTERM → fixed grace → cgroup.kill/SIGKILL`；candidate deadline 只能缩短剩余时间，不能延长，覆盖阻塞 event loop、`setsid` 与忽略信号的孙进程。
- 超时、残留、daemon 不可达或 late recreate 均不得产生 acceptance PASS。

## Preserved behavior

- V3 的 artifact no-replace、generation evidence、observed lifecycle、raw bearer zero-persistence、Buildx v0.35 real CLI compatibility、visible provenance 与 Owner-fair download lease 全部保留。
- Docker `29.6.1`、Buildx `v0.35.0`、BuildKit `v0.31.1` 不漂移。
- workbook sealed oracle、REALSTACK/GENERATION/DELIVERY-BROWSER 三证明、双 Owner、nft 与 RED 真实预推不降低。
- 不新增第31路径，不触碰 frozen Hall、大殿、军机处或翰林院产品面。

## Affected Modules

- 模块：release acceptance runner、installed-wheel runtime layout、trusted runner identity、cleanup lifecycle。
- 允许路径：后续 machine-readable V4 approval manifest 逐字登记的 V3 exact30；当前草案不授权其中任何路径。
- Release：`scripts/run_rc1_release_acceptance.mjs` 及其既有 exact30 tests。
- Frozen backend evidence：SQLite backup implementation/tests 属于 28 条 reviewed-baseline 字节，不得因 external pin 修改；确需修改必须 STOP 并重签 scope。
- Installed runtime：隔离 wheel 测试布局；不修改 wheel packaging 或配置事实源。
- Protected/out of scope：Harness、authority、CI、ADR、readiness consumers、exact2 与所有产品页面。

## Acceptance Criteria

- [ ] 三文件治理草案经独立复审，Owner 精确确认摘要后才允许另行提交/推送。
- [ ] Gate A machine GO 只授权本地物化；Gate B product-authority GO 只授权 product child；独立 supervisor-authority GO 才授权候选外执行，三者不得混用。
- [ ] 产品 diff 路径逐字等于 exact30；需要第31路径立即 STOP。
- [ ] 30 行 raw manifest 证明 28 条 Gate A reviewed-baseline 字节不变、只有两条 runner delta；path-set 相同不能替代该证明。
- [ ] installed config missing/mutation/symlink/race RED 与 installed-wheel `4130/0/4` GREEN。
- [ ] candidate self-update、module drift、同 inode 同 size 原地 TOCTOU、same-source expected/actual、绕过 runner 内校验 RED 与 single-FD supervisor GREEN。
- [ ] never-settling cleanup、阻塞 event loop、`setsid`/忽略信号的子孙进程、candidate 不报告或延后 cleanup deadline、deadline-before-start、mid-command expiry、daemon unavailable、partial cleanup、late recreate RED；全部在 supervisor hard deadline 内返回。
- [ ] backend focused/Ruff/isolated installed-wheel full、frontend test/lint/typecheck/build、release/authority/Harness/Doctor/V2 全绿。
- [ ] 冻结 candidate 后重算 readiness pair；机器 oracle 不接受时另行完成精确 correction，不伪造 GO。
- [ ] 专用发行环境以同一 commit/tree 完成 root + Docker + Chromium 双 Owner + nft + RED 真实链路。
- [ ] replacement candidate 的代码、Python、TypeScript 与安全独立终审没有未关闭 P0–P2。
- [ ] Owner 另行确认 exact product commit/tree/diff/evidence digest 后才可普通快进；不发布、不部署。

## Delivery Constraints

本 task 不是 approval manifest。旧 V3 authority 不能跨新治理 parent 或用于本 V4。方向同意、文件草案、摘要确认、Review 或旧候选测试都不能代替 machine GO。Gate A 不能铸造 release PASS；Gate B 必须在 candidate 冻结和 Owner pin 之后另行批准。

当前仓库没有已证明满足本合同的 candidate-external supervisor 或 release-execution machine authority；`product-authority` 不能授权外部 side effects。
因此当前 V4 的 release-execution 阶段明确 BLOCKED。必须另立受保护治理 work package，物化 supervisor、schema、grant/status 命令、安装证据并取得机器 GO；本 task 不授权该实现。

最终 readiness pair 依赖尚未获准创建的产品字节，当前只能记录基线 pair 与只读候选 pair。若最终 pair 变化，按 amendment 的独立 oracle-correction 流程执行；校验器路径不得塞进产品 exact30。

## Stop conditions

- canonical remote/base/tree、exact30、工具版本、配置来源或外部 pin 漂移；
- protected supervisor work package 尚未落地，或其独立 machine authority 未明确 GO；
- 试图打包管理员配置、使用 host/user-site metadata、从网络补配置或让 candidate 生成 expected；
- cleanup 可超过绝对 deadline，或超时后仍生成 PASS/receipt；
- readiness pair 未获机器接受、任何 P0–P2 未关闭、真实链路或独立复审失败；
- 未经精确授权提交、推送、合并、发布或部署。

## Technical Plan

1. 先单独落地三文件治理包，再批准只允许本地物化的 V4-A implementation authority。
2. 从获批 parent 建立干净 replacement worktree；只改两条 runner delta，先 RED 后 GREEN，禁止正式 release acceptance。
3. 冻结 30 条产品字节与 readiness pair；完成必要 oracle correction，并由 Owner 冻结 Gate A reviewed-baseline/delta、config、runner/module 和 external supervisor manifests。
4. 另立受保护 supervisor/release-execution authority work package并取得机器 GO；否则停止。随后用 distinct successor Task ID 落地 Gate B product approval，从其 parent 重放相同字节。
5. 跑完整 backend/frontend/release/governance/真实发行矩阵及独立复审；最后再请求 exact product 推送授权。

详细步骤、证明矩阵与回滚见同名 V4 governed plan。

## Implementation Report

尚未实施产品代码。本轮只在隔离 worktree 创建三份非授权治理草案；没有 commit、push、merge、release 或 deploy。

## Acceptance Review

Pending。只有在 V4 machine GO、三项修复、最终 readiness oracle 闭环、完整验证和独立复审全部完成后才能转为 accepted。

## Rollback

治理草案阶段只放弃隔离 worktree 的三份新增文档。产品阶段只放弃未推送 replacement child 并保留失败证据；不改写远端历史，不清理或覆盖用户工作树。

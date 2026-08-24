# Packet 14 — Exact30 Candidate Successor V4

> 状态：`READY_FOR_OWNER_DIGEST / V4_CORRECTION_SUCCESSOR / GATE_A_IMPLEMENTATION_ONLY / PRODUCT_STOP`
>
> Task ID：`PACKET-14-EXACT30-CANDIDATE-SUCCESSOR-V4-20260824`
>
> Proposed approval digest：`sha256:b3519d0123337a0a41dba7651aa0d4303a9ca953da9e3c171a689a51c1d67712`

## Status

Ready

旧 V4 Gate A 三件套已作为 `94135d0e3c7b24a9359573a27c9bd385484d8bc6` 远端落地，但其任务文本仍错误声明
“尚未提交或推送”，并把 Buildx 普通模板输出误当成每 builder 一条 JSON，同时把 runner 完整性联动错误限制为两条 delta。
旧 approval digest `sha256:cdca1cbe4d69fc8eb8286c033935a8036cece0fec13eb8b39f0dfcc5d9cc96d4` 因此被本 forward
correction successor 取代且不得复用。本三件套当前只在隔离工作树编制，尚未提交或推送；产品继续 STOP。

## V4 Finality Rule

V4 是 P14 exact30 的最终治理版本。除非独立代码或安全终审发现新的 P0 安全问题，否则禁止创建 V5、V6 或同类治理
successor，也不得用非安全性 P1–P3 问题重开版本链。V4 落地并取得全部所需 machine GO 后，只冻结一个精确产品候选：
在现有 exact30 边界内修复 installed-wheel layout、external runner pin 与 cleanup absolute deadline 三项发布阻断，完成本合同
全部回归、独立终审与真实预推矩阵，然后结束 P14。任何新的 P0 安全问题必须先 STOP、保存证据并取得 Owner 新授权。

## Product Definition

在不牺牲既有 P14 功能、证据强度、工具版本和 exact2 边界的前提下，建立 replacement exact30 candidate，并关闭三项真实发布阻断：installed-wheel 外部配置布局、trusted runner 候选外固定、cleanup 绝对截止时间。

## Canonical identity

- Repository/branch：`gitee.com/msxn/chaotang-os` / `ext-dev`
- Gate A correction base：`94135d0e3c7b24a9359573a27c9bd385484d8bc6`
- Gate A correction base tree：`cab89b02b63c05c9cd252daa3df70362a1a94eaf`
- Old V4 Gate A approval：已作为上述 base 落地；其 approval/task/plan 正是本 successor 需要 forward-correct 的三条治理路径。
- Supersedes：旧 digest `sha256:cdca1cbe4d69fc8eb8286c033935a8036cece0fec13eb8b39f0dfcc5d9cc96d4`，以及
  `PACKET-14-EXACT30-CANDIDATE-SUCCESSOR-V3-20260824`。
- Product paths：逐字等于 V3 approval exact30；path-set digest
  `45a46a2e70a4e8a526287cadef3740e3b6e833159ba5168e5236576f0ba8c276`
- Delta boundary：新增差异只允许 `scripts/run_rc1_release_acceptance.mjs`、其 `.test.mjs` 与
  `backend/app/operations/sqlite_backup.py` 中唯一 runner-integrity fingerprint；其余 27 条 exact30 必须等于 Gate B
  Owner-confirmed Gate A reviewed-baseline raw manifest。SQLite delta 只能把内部指纹更新为冻结 runner 的精确 raw SHA-256，
  不能改变 backup 行为或充当候选外信任根。
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
- `sqlite_backup.py` 的 candidate-side runner fingerprint 继续作为内部 defense-in-depth，并必须与冻结 runner raw bytes 精确一致；
  candidate 可同时修改两者这一事实正是 external supervisor 独立 pin 仍不可替代的原因。

### 3. Cleanup has a hard end

- 单调时钟 absolute deadline 覆盖每个 Promise、subprocess、probe 与 remove。
- deadline 到达必须中止当前动作并有界返回；不能靠动作返回后的 timestamp 判断代替中止。
- candidate-external supervisor 在启动前独立冻结 total/cleanup/grace/finalization 四个预算，以 cgroup v2 hard watchdog 执行
  `SIGTERM → fixed grace → cgroup.kill/SIGKILL`；candidate deadline 只能缩短剩余时间，不能延长，覆盖阻塞 event loop、`setsid` 与忽略信号的孙进程。
- 超时、残留、daemon 不可达或 late recreate 均不得产生 acceptance PASS。

## Preserved behavior

- V3 的 artifact no-replace、generation evidence、observed lifecycle、raw bearer zero-persistence、Buildx v0.35 real CLI compatibility、visible provenance 与 Owner-fair download lease 全部保留。
- Buildx `v0.35.0` 的唯一获准机器接口是原生 `buildx ls --format json`。旧 `inspect --format` 必须维持 unsupported RED；
  `buildx ls --format {{json .}}` 是普通 Go template，会分别渲染 builder/node 行并产生重复 builder JSON，也必须维持 RED。
- Docker `29.6.1`、Buildx `v0.35.0`、BuildKit `v0.31.1` 不漂移。
- workbook sealed oracle、REALSTACK/GENERATION/DELIVERY-BROWSER 三证明、双 Owner、nft 与 RED 真实预推不降低。
- 不新增第31路径，不触碰 frozen Hall、大殿、军机处或翰林院产品面。

## Affected Modules

- 模块：release acceptance runner、installed-wheel runtime layout、trusted runner identity、cleanup lifecycle。
- 允许路径：后续 machine-readable V4 approval manifest 逐字登记的 V3 exact30；当前草案不授权其中任何路径。
- Release：`scripts/run_rc1_release_acceptance.mjs` 及其既有 exact30 test。
- Backend integrity：只允许更新 `backend/app/operations/sqlite_backup.py` 的 `_TRUSTED_RUNNER_SHA256` 一值，使其绑定最终冻结 runner；
  该文件其余字节和 `backend/tests/test_sqlite_backup.py` 属于 27 条 reviewed-baseline，不得漂移。
- Installed runtime：隔离 wheel 测试布局；不修改 wheel packaging 或配置事实源。
- Protected/out of scope：Harness、authority、CI、ADR、readiness consumers、exact2 与所有产品页面。

## Acceptance Criteria

- [x] 旧 V4 Gate A 三件套作为 `94135d0e…8bc6` 远端落地并双读；其旧 digest 已因 P1 合同矛盾被 successor 取代。
- [ ] Owner 精确确认本 correction successor approval/task/plan 三文件摘要后，才允许另行创建并推送该治理提交。
- [ ] Gate A machine GO 只授权本地物化；Gate B product-authority GO 只授权 product child；独立 supervisor-authority GO 才授权候选外执行，三者不得混用。
- [x] Gate A verification matrix 含永久 `candidate-acceptance-blocked`：内层稳定 exit `86 / GATE_A_IMPLEMENTATION_ONLY`，外层 authority 稳定 `STOP / VERIFICATION_FAILED`；因此该 child 不能被本 approval 接受。
- [ ] 产品 diff 路径逐字等于 exact30；需要第31路径立即 STOP。
- [ ] 原生 `buildx ls --format json` GREEN；旧 `inspect --format` 与普通 `{{json .}}` builder/node 重复输出均为真实 RED。
- [ ] 30 行 raw manifest 证明 27 条 Gate A reviewed-baseline 字节不变、只有 runner、runner test、SQLite runner fingerprint
  三条 delta；path-set 相同不能替代该证明。
- [ ] installed config missing/mutation/symlink/race RED 与 installed-wheel `4130/0/4` GREEN。
- [ ] candidate self-update、module drift、同 inode 同 size 原地 TOCTOU、same-source expected/actual、绕过 runner 内校验 RED 与 single-FD supervisor GREEN。
- [ ] never-settling cleanup、阻塞 event loop、`setsid`/忽略信号的子孙进程、candidate 不报告或延后 cleanup deadline、deadline-before-start、mid-command expiry、daemon unavailable、partial cleanup、late recreate RED；全部在 supervisor hard deadline 内返回。
- [ ] backend focused/Ruff/isolated installed-wheel full、frontend test/lint/typecheck/build、release/authority/Harness/Doctor/V2 全绿。
- [ ] 冻结 candidate 后重算 readiness pair；机器 closed set 不接受即终态 `STOP / NO_GO`，不创建 correction、re-anchor 或后继治理版本，也不伪造 GO。
- [ ] 专用发行环境以同一 commit/tree 完成 root + Docker + Chromium 双 Owner + nft + RED 真实链路。
- [ ] replacement candidate 的代码、Python、TypeScript 与安全独立终审没有未关闭 P0–P2。
- [ ] Owner 另行确认 exact product commit/tree/diff/evidence digest 后才可普通快进；不发布、不部署。

## Delivery Constraints

本 task 与同名 machine-readable approval 必须作为同一三文件治理提交落地。旧 V3 authority、旧 V4 digest 或旧 V4 GO
都不能跨本 correction parent 复用。方向同意、文件草案、摘要确认、Review 或旧候选测试都不能代替 machine GO。
Gate A 不能铸造 candidate/release PASS；Gate B 必须在 candidate 冻结和 Owner pin 之后以 distinct Task ID 另行批准。

V4 finality rule 是硬停止条件：除新的 P0 安全问题外，不得通过创建后继治理版本消化失败；非 P0 问题必须在同一个获批 V4
精确候选和既有 exact30 路径边界内修正、重跑并闭环。

当前仓库没有已证明满足本合同的 candidate-external supervisor 或 release-execution machine authority；`product-authority` 不能授权外部 side effects。
因此当前 V4 的 release-execution 阶段明确 BLOCKED。必须另立受保护治理 work package，物化 supervisor、schema、grant/status 命令、安装证据并取得机器 GO；本 task 不授权该实现。

最终 readiness pair 依赖尚未获准创建的产品字节，当前只能记录基线 pair 与只读候选 pair。最终 pair 必须被现有 machine
closed set 接受；不接受即终态 `STOP / NO_GO`，不得创建 oracle correction、approval re-anchor 或后继治理版本，校验器路径也不得塞进产品 exact30。

## Stop conditions

- canonical remote/base/tree、exact30、工具版本、配置来源或外部 pin 漂移；
- protected supervisor work package 尚未落地，或其独立 machine authority 未明确 GO；
- 试图打包管理员配置、使用 host/user-site metadata、从网络补配置或让 candidate 生成 expected；
- cleanup 可超过绝对 deadline，或超时后仍生成 PASS/receipt；
- readiness pair 未获机器接受、任何 P0–P2 未关闭、真实链路或独立复审失败；
- 未经精确授权提交、推送、合并、发布或部署。

## Technical Plan

1. Owner 确认本 correction proposed approval digest 与三文件 bundle 后，只落地 approval/task/plan 三文件 Gate A governance
   successor；远端双读后在新 parent 重新取得 canonical machine GO。
2. 从获批 parent 建立干净 replacement worktree；只改 runner、runner test 与 SQLite runner fingerprint 三条 delta，先 RED 后
   GREEN，禁止正式 release acceptance。
3. 冻结 30 条产品字节与 readiness pair；确认现有 machine closed set 精确接受，并由 Owner 冻结 Gate A reviewed-baseline/delta、config、runner/module 和 external supervisor manifests；不接受即终态停止。
4. 另立受保护 supervisor/release-execution authority work package并取得机器 GO；否则停止。随后用 distinct successor Task ID 落地 Gate B product approval，从其 parent 重放相同字节。
5. 跑完整 backend/frontend/release/governance/真实发行矩阵及独立复审；最后再请求 exact product 推送授权。

详细步骤、证明矩阵与回滚见同名 V4 governed plan。

## Implementation Report

旧 V4 Gate A approval/task/plan 已作为 `94135d0e3c7b24a9359573a27c9bd385484d8bc6` 落地；对象级复核确认其 tree
`cab89b02b63c05c9cd252daa3df70362a1a94eaf`、三条治理路径和旧 approval digest 精确。真实 Buildx 证明随后确认普通
`{{json .}}` 模板对 builder/node 重复渲染，且 runner 字节改变必然要求 SQLite 内部 fingerprint 同步。本 correction 只修正上述
治理合同；当前没有提交、推送、产品施工、release 或 deploy。

## Acceptance Review

Pending。旧 digest 不构成当前授权；只有本 correction 落地并取得新 machine GO、三项修复、最终 readiness oracle 闭环、
完整验证和独立复审全部完成后才能转为 accepted。

## Rollback

本 correction 草案阶段只放弃隔离工作树的三文件差异；远端旧 V4 保留审计但不得授权后续工作。产品阶段只放弃未推送
replacement child 并保留失败证据；不改写远端历史，不清理或覆盖用户工作树。

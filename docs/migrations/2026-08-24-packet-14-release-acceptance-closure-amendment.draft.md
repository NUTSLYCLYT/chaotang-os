# Packet 14 — Release Acceptance Closure Amendment（Draft）

> 状态：`DRAFT / NON_AUTHORIZING / OWNER_DIGEST_REQUIRED / PRODUCT_STOP`
>
> Successor task：`PACKET-14-EXACT30-CANDIDATE-SUCCESSOR-V4-20260824`
>
> Canonical base：`origin/ext-dev@525acd21e38dd388a77c5361c9ef89257cd23de5`
>
> Base tree：`cb42dd9d7fb4d695d04bbe3e10b2d12e6ae11b88`

## 1. Purpose

本 amendment 只为 Packet 14 关闭三项已经由真实验收暴露的发布阻断：

1. installed-wheel 测试运行时缺少与生产容器等价的外部配置布局；
2. trusted runner 只证明“候选如何描述自己”，没有绑定候选之外的不可变期望；
3. cleanup 只有事后超时判断，没有能中止挂死 Promise/子进程的绝对截止时间。

本文件、对应 task 与 plan 都只是治理草案，不是 product authority。Owner 未精确确认三文件摘要、治理包未按单亲普通快进落地、后续 approval manifest 未获机器 `GO` 前，禁止修改产品代码。

## 2. Re-anchor and observed evidence

- 远端身份经两次只读核验稳定为 commit `525acd21e38dd388a77c5361c9ef89257cd23de5`、tree
  `cb42dd9d7fb4d695d04bbe3e10b2d12e6ae11b88`、parent `13a78831395c40b2b1bc73d4d6ff9d89d6854af4`。
- 该提交只更新 V3 approval/task/plan；V3 exact30、exact2 边界与冻结工具版本保持不变。
- source backend locked environment：`4130 passed / 4 skipped / 0 failed`。
- installed-wheel controlled runtime：`4025 passed / 4 skipped / 105 failed`；首个稳定根因是 installed `app` 相邻位置没有
  `config/jinyiwei_mcp.yaml`。Docker 运行时通过 `COPY config ./config` 提供相邻外部配置，wheel 本身只安装 `app`。
- 现有 runner process identity 对候选 runner/module 自哈希，但没有与 approval-parent、Owner 冻结摘要或其他候选外信任根比较；候选可同时改变实现与自报值。
- 现有 cleanup 记录时间并在完成后检查超时，但挂死的清理 Promise 或子进程可永不返回，因此仍能无限阻塞 acceptance。

## 3. Closed product scope

- 产品修改范围继续逐字等于 V3 approval 的 exact30，path-set digest 保持
  `45a46a2e70a4e8a526287cadef3740e3b6e833159ba5168e5236576f0ba8c276`。
- 三项新增产品 delta 只允许落在 `scripts/run_rc1_release_acceptance.mjs` 与
  `scripts/run_rc1_release_acceptance.test.mjs`。其余 28 条 exact30 必须与最终 Owner 确认的 Gate A reviewed-baseline raw-byte manifest 完全相同；
  仅 path-set 相同不能证明没有夹带业务变化。
- 历史文档中的 donor commit `54656b4cfc60d4830eb92a4b4735541b4ea4cef1` / tree
  `6ef7a89836a6703565f452120af4b9d2e1926805` 当前不在 canonical object store，不能单独作为可读取的字节证明。Gate A 必须在
  隔离环境物化并独立复审 exact30，生成 30 行 path/type/mode/size/raw-SHA-256 manifest；Gate B 才能把其中 28 条冻结为不可变 reviewed baseline、
  只允许上述两条 runner delta。
- `backend/pyproject.toml`、`backend/config/**`、Harness、authority、CI、ADR、readiness fingerprint consumers 均不是产品 child 路径。
- installed-wheel 修复不得把管理员配置、secret 或环境专属值打进 wheel；只允许由受信 runner 从已绑定的 candidate snapshot
  确定性复制现有 `backend/config` 到隔离测试运行时，使布局等价于生产容器的 `/app/app` + `/app/config`。
- 两个 work-product BFF cancellation 路径仍属于独立 exact2；不得扩张为 exact31/exact32。

## 4. Amendment A — installed-wheel configuration layout

### Required behavior

- runner 在安装 wheel 后、执行 pytest 前创建只读、root-owned、不可跟随 symlink 的 runtime layout，使 installed `app` 的父目录包含
  candidate snapshot 中精确的 `config/` 文件集。
- 配置来源必须绑定 base/candidate commit、tree、相对路径、类型、大小和 raw SHA-256；禁止从 host cwd、用户目录、环境变量或网络补齐。
- expected inventory 必须由候选外治理 parent 固定为恰好两条普通文件：
  `backend/config/jinyiwei_mcp.yaml`（mode `100644`、size `6958`、raw SHA-256
  `71e36188dde543eee2950ccf798df5f869e44ec51409428122c446c9d6416f79`）与
  `backend/config/providers.yaml`（mode `100644`、size `797`、raw SHA-256
  `82614f8a05931ec1dd10ed62cdb1a98396e08c1971ff483f3dd9559849ff4a1e`）。禁止从 candidate 枚举结果反向生成 expected。
- staging 必须拒绝额外文件、缺失文件、symlink、hardlink、设备节点、权限漂移、复制中变化和 digest 不一致。
- archive source、test runtime staging 与 installed runtime staging 三份投影必须分别重算并精确等于该候选外 inventory。
- wheel 仍只表达 Python package；配置继续是部署者提供的外部运行配置，不改变生产配置所有权。

### Mandatory RED/GREEN

- RED：仅安装 wheel、不给受信配置布局时，以稳定 `RUNTIME_CONFIG_MISSING` 类错误失败，不得被 checkout `PYTHONPATH` 偶然救活。
- RED：缺失、篡改、额外、软链或竞态配置必须在 backend tests 前 fail-closed。
- GREEN：受信 staging 后，installed-wheel 全量必须达到 `4130 passed / 4 skipped / 0 failed`，且证明 import 与 distribution metadata 都来自同一隔离安装。

## 5. Amendment B — trusted runner external pin

### Required behavior

- **当前机器阻断**：canonical `product-authority.m0.approval.v1` 只能授权 product child，不能授权候选外 side effects；现有
  `execution_authority_ext` 也尚未评估且没有证明 release supervisor 语义。external supervisor 及其 release-execution authority 必须另立受保护治理 work package，
  指定 manifest schema、status/authorize 命令、安装路径、供应证据与机器 GO。在该包真实落地并返回 GO 前，本 V4 只能走 Gate A，Gate B 与正式 acceptance 保持 BLOCKED。
- trusted pre-launch verifier/supervisor 必须位于 candidate tree 之外，来自专用发行环境的 root-owned、只读、不可变工具镜像；Gate B 必须
  登记其 authority、绝对路径、镜像/文件 raw digest、解释器/toolchain digest 与启动参数。未识别并验证该 supervisor 时保持 STOP。
- Gate A implementation approval 只允许本地物化 exact30 candidate，禁止运行正式 release acceptance、铸造 trusted identity、提交或推送。
- candidate 字节冻结后，由独立只读工具计算 runner、全部传递本地模块和 exact30 Gate A reviewed-baseline/delta manifest；Owner 确认候选外 pin manifest，
  再以新的 Gate B release-execution approval 固定 expected。Gate B 改变 governance parent 后，必须把相同 raw bytes 重放为它的唯一 product child；
  禁止从该 child 的自报值生成 expected。
- supervisor 对每个来源只打开一次 `O_NOFOLLOW` FD，从同一 FD 单次流式“复制并哈希”到 root-owned 临时文件；复制前后 `fstat`，校验
  copied bytes digest 后 `fsync`、只读封存并原子发布，禁止校验后重新按路径打开。只从该已验证副本启动 runner。比较和封存完成前，不得导入候选代码、
  创建 evidence、启动 Docker/network/browser 或执行任何候选动作。
- expected 与 actual 不得由同一候选进程、同一可改对象或自报 JSON 同源产生。runner、传递依赖、验证入口及摘要算法必须形成封闭集合；
  未知依赖、文件替换、inode/size/digest 漂移均 fail-closed。
- product authority 的 ordinary test matrix 不能单独充当该 trust root；正式 release acceptance 必须由上述 candidate-external supervisor 启动。

### Mandatory RED/GREEN

- RED：同时修改 runner 和它自报的 digest，仍必须在任何不受信动作前被候选外 pin 拒绝。
- RED：修改任一 sealed local module、增删依赖、TOCTOU 替换或让 expected/actual 同源都必须失败。
- RED：同 inode、同 size 在 hash 与 copy 间原地修改，必须由单 FD copy-and-hash 与前后 `fstat` 拒绝。
- GREEN：supervisor 精确匹配 Gate B 冻结集合、从已验证只读复制件启动后，process identity 才可铸造，并在所有后续 evidence 中保持同一值。

## 6. Amendment C — cleanup absolute deadline

### Required behavior

- 进入 `finally` 时只计算一次单调时钟绝对 `cleanupDeadline`；不得在每个步骤重新延长期限。
- 每个清理 Promise 与子进程都使用 `remaining = max(0, cleanupDeadline - now)`；实际 timeout 为既有上限与 remaining 的较小值。
- deadline 到达时必须 abort/terminate 当前清理动作并有界回收子进程；不得等待一个永不 settle 的 Promise。
- deadline 已耗尽时，后续 acceptance cleanup/probe 不再启动，结果稳定失败且不得生成 receipt、round PASS 或 release evidence PASS。
- Gate B external authority 必须冻结 acceptance total budget、cleanup budget、SIGTERM grace 与 finalization budget。supervisor 在启动 runner 前用自己的
  单调时钟计算 total absolute deadline；candidate 的 cleanup phase 只能缩短 remaining，永远不能创建、延后或延长外层 deadline。
- supervisor 必须把整个 acceptance 放入专属 cgroup v2，并设置不依赖 Node event loop 的硬 watchdog。到达 total/cleanup 外层期限后执行
  `SIGTERM → fixed grace → cgroup.kill/SIGKILL`，杀死能 `setsid` 的子/孙进程树；process group 只能辅助，不能替代 cgroup。runner 内部 AbortSignal 只是第一层。
- supervisor 可在 kill 后使用独立、冻结且有界的 evidence-finalization budget 做只读残留探测；它不得继续 candidate cleanup，也不得把迟到清理倒写为 PASS。
- 若仍需运维级紧急清理，只能作为 acceptance 之外的人工动作，不能倒写为本轮通过证据。

### Mandatory RED/GREEN

- RED：never-resolving close/probe/remove、阻塞 event loop、忽略 SIGTERM 或 `setsid` 的子/孙进程、candidate 不报告 cleanup start/报告延后 deadline、deadline-before-start、mid-command expiry、daemon unavailable、partial cleanup 与 late recreate。
- GREEN：supervisor 在冻结的 hard deadline + finalization budget 内返回稳定错误并证明进程树已终止；正常路径仍留下 11 类资源真实 PLAN/CREATE/DESTROY/PROBE 证据。

## 7. Readiness fingerprint gate

指纹算法是按排序后的受保护路径依次哈希 `path + NUL + raw bytes + NUL`，用于证明验证器看到的是同一组实现字节，不是业务进度分数。

- 新基线当前 pair：runtime
  `sha256:013bfb8272e936be85c2d470033787c3b7f105ad6eae2dfe680373df023b5e69`，successor
  `sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924`；它是当前机器允许的 legacy pair。
- 只读候选工作树当前 pair：runtime
  `sha256:c95630be3d79f2641ff6e483f4096b0763b9e5071544f1e0ead0d7e24eb1cba5`，successor
  `sha256:9d10d2bed258e632c909719f05df50c6b33530d9f40be2458a38dd063fcde3c5`。
- 当前机器第二个允许 pair 的 successor 值是
  `sha256:268cab13e516d0f716f600819f2bddc8242269312d392eca4ed1be2de05ce051`，因此该只读候选 pair 不被允许，不能宣称 Harness GO。
- replacement exact30 中重放的既有受保护路径决定最终 pair；两条新增 runner delta 本身不属于 six-ministry fingerprint 路径，不改变该 pair。
  最终值仍只能在 Gate A 的 30 条 raw bytes 冻结后确认。不得预猜、用 actual-as-expected，或在本治理草案中伪造最终值。
- 冻结 candidate 后若 pair 未在封闭 oracle 中，必须 STOP，另行取得 Owner 对精确 pair 与受保护 oracle correction 路径的摘要授权；该 correction 与产品 child 分离，完成后重新锚定 product approval。不得为省步骤绕过此门。

## 8. Authority sequence

1. 本三文件草案完成检查与独立复审；Owner 精确确认 manifest/bundle 摘要。
2. 另行授权后，只创建并普通快进恰含这三路径的单亲治理提交；远端双读。
3. **Gate A / implementation authority**：编制 machine-readable V4-A approval，只授权在隔离 worktree 本地物化 exact30；明确禁止正式 release
   acceptance、trusted identity、产品提交/推送。canonical authority GO 后才施工两条 runner delta。
4. 冻结 candidate raw bytes，由 candidate-external 独立工具生成 30 行 Gate A reviewed-baseline/delta manifest、runner/module pin manifest、最终 readiness pair；独立复审并请 Owner 确认。
5. 若 readiness pair 未在封闭 oracle 中，先完成独立 correction 治理闭环。同时另立 protected supervisor/release-execution authority work package；
   它未机器 GO 时本流程明确 BLOCKED，不得把 product-authority 解释成外部执行授权。
6. 在新的 distinct successor Task ID 下，把 supervisor grant identity、config inventory、28 条 reviewed-baseline raw bytes、2 条 delta raw bytes和
   runner/module pin 写入 Gate B governance packet；其 machine product approval 只授权唯一 product child，外部 side effects 另由 supervisor authority 授权。
7. Gate B 落地会使 Gate A child 失效；必须从 Gate B product approval parent 建立全新 child，只重放完全相同的 30 条 raw bytes。product-authority GO、
   supervisor-authority GO 与 candidate-external preflight 三者都通过后才允许运行正式 acceptance。
8. 全部门禁、真实发行环境、独立代码/安全复审全部通过后，才请求 exact product commit 推送授权。

任何方向确认、草案、Review 结论或旧 V3 GO 都不能替代上述新 parent 上的 V4 machine GO。

## 9. Non-goals and stop conditions

- 不修改工具版本、不降低测试、timeout、隔离、owner、nft、真实浏览器或证据门槛。
- 不把配置打入 wheel，不新建配置事实源，不从 host/user-site 拼接 installed candidate 证据。
- 不修改 exact2、数据库 schema、API namespace、生产数据、secret、现有浏览器 profile 或外部系统。
- 不复用、merge、cherry-pick 或推送旧 dirty candidate。
- remote/base/tree、三文件路径、exact30、external pin、absolute deadline、指纹 gate 任一漂移立即 STOP。

## 10. Rollback

本草案未提交时，回滚只需放弃干净隔离 worktree 中这三份新增文件；不触碰共享工作树。治理提交一旦获批并推送，只能用 forward successor 纠正，不改写历史。产品 candidate 失败时保留证据并放弃该 child，不 reset、clean、stash 或覆盖用户资产。

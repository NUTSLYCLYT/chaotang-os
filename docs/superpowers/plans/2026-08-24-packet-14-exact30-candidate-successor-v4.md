# Packet 14 Exact30 Candidate Successor V4 — Governed Plan

## Contract

- Task：`PACKET-14-EXACT30-CANDIDATE-SUCCESSOR-V4-20260824`
- Target：`origin/ext-dev`
- Governance base/tree：`525acd21e38dd388a77c5361c9ef89257cd23de5` /
  `cb42dd9d7fb4d695d04bbe3e10b2d12e6ae11b88`
- Execution state：`DRAFT / NON_AUTHORIZING / PRODUCT_STOP`
- Scope：V3 exact30；exact2、protected Harness/authority/readiness consumers 与配置源文件保持范围外。
- Only new remediation：installed-wheel layout、external runner pin、cleanup absolute deadline。

## Phase G0 — Governance preparation

1. 在干净 detached worktree 重验 remote commit/tree/parent 与三份目标路径无冲突。
2. 记录 installed-wheel `4025/105/4`、source `4130/0/4`、runner self-pin 与 cleanup post-hoc timeout 的真实证据。
3. 用项目定义的 `path + NUL + bytes + NUL` 算法重算 readiness pair：
   - baseline：`013bfb…e69 / 709eba…924`；
   - current read-only candidate：`c95630…ba5 / 9d10d2…3c5`；
   - 当前 machine second pair：`c95630…ba5 / 268cab…519`，因此 current candidate 仍 STOP。
4. 只创建 amendment/task/plan 三份草案；运行 diff、Harness、Doctor、authority fail-closed 检查与独立安全复审。
5. 输出逐文件 raw SHA-256、sorted manifest SHA-256 与 path-NUL-content-NUL bundle SHA-256，请 Owner 精确确认。未确认不提交。

## Phase G1 — Governance landing（requires new Owner authorization）

1. 只创建恰含三份草案路径的单亲治理 commit；parent 必须是 `525acd…de5`。
2. 普通 fast-forward 推送并双读 commit/tree/paths；禁止强推、merge、release 或 deploy。
3. 基于新 parent 编制 closed **V4-A implementation approval**，复用 V3 exact30，但明确只允许本地物化 candidate；禁止正式 release
   acceptance、trusted identity、产品提交/推送。
4. Owner 精确确认 V4-A digest 并落地；canonical product authority 对 V4-A 返回 GO 前保持产品 STOP。

## Phase P0 — Clean replacement child

1. 从获批治理 parent 建立新的干净 detached product worktree；不复制、merge、cherry-pick 旧 dirty candidate。
2. 确认 changed paths 空集，再按已审查语义逐路径实施；新增 delta 只允许 runner 与 runner test 两条路径。其余 28 条 exact30 从
   Gate A reviewed baseline 物化，最终必须有逐路径 raw manifest 证明字节未漂移。
3. 先运行现有 V3 回归，证明 Buildx real CLI、artifact、generation、bearer、lifecycle、provenance 与 fairness 没有退化。

## Phase P1 — Installed-wheel layout

1. RED：隔离安装 wheel 后禁止 checkout/user-site，复现 `config/jinyiwei_mcp.yaml` 缺失。
2. 在 runner/test 既有 exact30 内实现 candidate-bound config staging：expected 由 governance parent 固定为
   `jinyiwei_mcp.yaml@71e36188…16f79/6958/100644` 与 `providers.yaml@82614f8a…4a1e/797/100644`；精确文件清单、stable-FD hash、no symlink/hardlink/special file、只读 owner 与复制后重验。
3. RED：missing、extra、mutated、symlink、race、wrong owner/mode、host cwd fallback。
4. GREEN：运行 focused 与完整 installed-wheel；必须 `4130 passed / 4 skipped / 0 failed`，并记录 wheel digest、app origin、dist-info origin 与 config tree digest。

## Phase P2 — External runner pin

1. V4-A 完成后冻结 candidate，由独立只读工具计算 runner 与全部传递依赖 raw digest；candidate 自报不作为 expected。
2. 当前 repository 没有可证明该语义的 supervisor authority；先另立 protected work package，物化 manifest schema、grant/status 命令、root-owned immutable supervisor、供应证据与机器 GO。
3. Owner 在 distinct Gate B successor governance parent 中冻结 expected，并登记 supervisor grant identity、绝对 path/image digest、toolchain 与参数。
4. supervisor 对每个来源只打开一次 `O_NOFOLLOW` FD，从该 FD 流式 copy-and-hash；前后 `fstat`，临时副本 digest 匹配后 `fsync`、只读封存并原子发布，只从该副本启动 runner。
5. RED：runner+self-report 同改、绕过 runner 内校验、单模块 drift、依赖增删、同 inode/同 size 原地 TOCTOU、invalid expected、actual-as-expected。
6. GREEN：只有 supervisor 对 Gate B expected 精确匹配才铸造 process identity；后续 command/evidence 全程绑定同一 digest。

## Phase P3 — Absolute cleanup deadline

1. 用注入式 monotonic clock 与 abortable executor 先写 never-settling RED。
2. `finally` 入口冻结唯一 deadline；所有 command/Promise timeout 取 remaining 与既有上限较小值。
3. external authority 冻结 total acceptance、cleanup、SIGTERM grace、finalization 四预算；supervisor 在启动前以自身 monotonic clock 计算
   total absolute deadline，candidate 只能缩短 remaining，不能提供或延后外层 deadline。
4. supervisor 将 acceptance 放入专属 cgroup v2，并以不依赖 Node event loop 的 watchdog 在到期后执行
   `SIGTERM → fixed grace → cgroup.kill/SIGKILL`；process group 与内部 abort 只是辅助层。
5. deadline 后不再启动 candidate cleanup，不生成 receipt/round/PASS；supervisor 只在独立固定 finalization budget 内探测进程树和资源残留。
6. 覆盖 deadline-before-start、mid-command、hung Promise、阻塞 event loop、candidate 不报告/延后 cleanup、`setsid`/忽略信号的子孙进程、daemon unavailable、partial cleanup、late recreate 与正常 11-resource lifecycle。

## Phase P4 — Fingerprint finalization

1. 产品字节冻结后重算完整 runtime/successor pair；记录算法、排序路径、commit/tree 与 raw pair。
2. 若 machine closed set 不接受，立即 STOP；不得修改测试期望使之自动接受。
3. 另行编制只覆盖受保护 oracle consumer 的 correction amendment，取得 Owner 精确摘要授权并落地。
4. correction 改变 product approval parent 后，重新锚定 approval 并再次取得 canonical GO；产品 exact30 不吸收 oracle 路径。

## Phase G2 — Release-execution pin

1. 生成并独立复审 30 行 product raw manifest：28 条 Gate A reviewed-baseline 必须完全相同，只有 runner/runner-test 两条 delta；历史 donor object 不可读，不把历史名称冒充字节证明。
2. 生成 runner/transitive-module pin manifest、两文件 config inventory 与 external supervisor identity；Owner 精确确认全部摘要。
3. protected supervisor work package 先落地并由其自身 machine status 返回 GO；product-authority 不能替代该外部授权。
4. 使用 distinct successor Task ID 编制并落地 Gate B product approval。Gate A 只作施工审计，不得复用其 parent、Task ID 或 GO。
5. 从 Gate B approval commit 建立新 child，重放与冻结 manifest 完全相同的 30 条 raw bytes；任一 byte 漂移立即 STOP 并重签。
6. Gate B product-authority GO、supervisor-authority GO 均存在后，由 external supervisor 做 pre-launch pin 与 hard watchdog；缺一不运行正式 acceptance。

## Phase V — Verification

1. Scope：exact30 path-set、diff check、secret/canary、no checkout/user-site contamination。
2. Backend：focused、Ruff、runtime-lock isolated full installed candidate。
3. Frontend：tests、lint、typecheck、build；现有 provenance/confirmation/download 行为不退化。
4. Release：offline build/verify、recovery、authority、Root Harness/Doctor/V2；所有命令使用冻结 timeout，正式 acceptance 只由 external supervisor 启动。
5. Real chain：专用发行环境、Docker `29.6.1`、Buildx `v0.35.0`、BuildKit `v0.31.1`、root、Chromium 双 Owner、nft、RED；绑定同一 commit/tree。
6. 独立代码/Python/TypeScript/security review；未关闭 P0–P2 即 NO_GO。

## Phase D — Candidate authorization

1. 冻结 replacement commit/tree、exact path list、patch digest、readiness pair 与 evidence bundle digest。
2. 只向 Owner 请求该精确 product child 的普通快进授权；授权前不提交/推送产品代码。
3. 推送后远端双读并重跑 machine status；不在本 Packet 内发布或部署。
4. exact30 落地后另立 exact2；exact2 完成前不宣称 Packet 14 总体完成。

## Stop conditions

- remote/base/tree、exact30、external expected、config source、absolute deadline 或工具版本漂移；
- 需要第31路径，或试图修改 `backend/pyproject.toml`、`backend/config/**`、protected oracle/authority；
- machine STOP、external supervisor 未固定/未通过、readiness pair 不被接受、installed-wheel 非零失败、真实链路或独立复审未通过；
- fixture 冒充 generation、candidate 自签、配置打包、host/user-site 拼接、cleanup 超时后继续铸造 PASS；
- 缺少对应阶段的精确 Owner 授权。

## Rollback

- G0：放弃隔离 worktree 的三份新增草案。
- G1：未推送 commit 可放弃；已推送治理历史只能 forward successor。
- Product：保留失败 evidence，放弃未推送 child；不 reset、clean、stash 或覆盖用户资产。
- External cleanup：acceptance 超时后只允许人工、独立记录的运维清理，不能回写本轮 PASS。

# Packet 14 Exact30 Candidate Successor V4 — Governed Plan

## Contract

- Task：`PACKET-14-EXACT30-CANDIDATE-SUCCESSOR-V4-20260824`
- Target：`origin/ext-dev`
- Gate A correction base/tree：`94135d0e3c7b24a9359573a27c9bd385484d8bc6` /
  `cab89b02b63c05c9cd252daa3df70362a1a94eaf`
- Proposed approval digest：`sha256:b3519d0123337a0a41dba7651aa0d4303a9ca953da9e3c171a689a51c1d67712`
- Superseded approval digest：`sha256:cdca1cbe4d69fc8eb8286c033935a8036cece0fec13eb8b39f0dfcc5d9cc96d4`（不得复用）
- Execution state：`READY_FOR_OWNER_DIGEST / V4_CORRECTION_SUCCESSOR / NON_AUTHORIZING_UNTIL_MACHINE_GO / PRODUCT_STOP`
- Scope：V3 exact30；exact2、protected Harness/authority/readiness consumers 与配置源文件保持范围外。
- Remediation：installed-wheel layout、external runner pin、cleanup absolute deadline；并 forward-correct native Buildx JSON 与
  runner/SQLite integrity 的三路径联动边界。
- Finality：V4 是 P14 exact30 最终治理版本；除独立终审发现新的 P0 安全问题外，禁止 V5/V6 式 successor。只冻结一个
  精确产品候选，修完三项发布阻断，完成全矩阵后结束 P14。

## Phase G0 — Governance preparation

1. 在干净 detached worktree 重验 remote `94135d0e…8bc6` / tree `cab89b…eaf` / parent `4f189fb…6cbb` 与三份目标路径无冲突。
2. 记录 installed-wheel `4025/105/4`、source `4130/0/4`、runner self-pin 与 cleanup post-hoc timeout 的真实证据。
3. 用项目定义的 `path + NUL + bytes + NUL` 算法重算 readiness pair：
   - baseline：`013bfb…e69 / 709eba…924`；
   - current read-only candidate：`c95630…ba5 / 9d10d2…3c5`；
   - 当前 machine second pair：`c95630…ba5 / 268cab…519`，因此 current candidate 仍 STOP。
4. 只修改现有 V4 approval/task/plan 三份草案；修正旧 V4 已落地的状态、native Buildx JSON 与三路径 delta，运行 diff、Harness、
   Doctor、authority fail-closed 检查与独立代码/安全复审。
5. 输出逐文件 raw SHA-256、sorted manifest SHA-256 与 path-NUL-content-NUL bundle SHA-256，请 Owner 精确确认。未确认不提交。

## Phase G1 — Governance landing（requires new Owner authorization）

1. 旧 V4 Gate A approval/task/plan 已作为 `94135d0e…8bc6` 普通快进推送并远端双读，但因状态、Buildx interface 与 delta
   boundary 三项 P1 矛盾被本 forward correction 取代；旧 digest 不得复用。
2. 当前 correction packet 严格三路径：machine approval、同名 task、同名 plan；base 必须为 `94135d0e…8bc6` / tree
   `cab89b…eaf`。
3. approval 复用 V3 exact30 与既有 15 项 verification，新增排序后的第16项 `candidate-acceptance-blocked`；内层稳定 exit `86`，外层 authority 稳定 `STOP / VERIFICATION_FAILED`，使 Gate A child 永远不能由本 approval 接受。
4. Owner 精确确认 proposed approval digest 与三文件 bundle 后，才可创建本地单亲 commit；另行确认 commit/tree 后才可普通快进。
5. canonical product authority 对 V4 返回 GO 前保持产品 STOP；GO 之后也只允许隔离 worktree 物化，禁止正式 release acceptance、trusted identity、产品提交/推送。

## Phase P0 — Clean replacement child

1. 从获批治理 parent 建立新的干净 detached product worktree；不复制、merge、cherry-pick 旧 dirty candidate。
2. 只物化并冻结一个精确产品候选；除新 P0 安全问题外，后续失败必须在同一 V4/exact30 合同内修正和重跑，不创建新的治理版本。
3. 确认 changed paths 空集，再按已审查语义逐路径实施；新增 delta 只允许 runner、runner test 与
   `backend/app/operations/sqlite_backup.py` 的唯一 runner-integrity fingerprint。其余 27 条 exact30 从 Gate A reviewed baseline
   物化，最终必须有逐路径 raw manifest 证明字节未漂移。
4. Buildx 先复现旧 `inspect --format` unsupported RED 与普通 `buildx ls --format {{json .}}` builder/node 重复 JSON RED；
   GREEN 必须是原生 `buildx ls --format json`，并继续拒绝多个 current builder、非 Docker driver、空/停机/版本漂移节点。
5. 运行现有 V3 回归，证明 artifact、generation、bearer、lifecycle、provenance 与 fairness 没有退化。

## Phase P1 — Installed-wheel layout

1. RED：隔离安装 wheel 后禁止 checkout/user-site，复现 `config/jinyiwei_mcp.yaml` 缺失。
2. 在 runner/test 既有 exact30 内实现 candidate-bound config staging：expected 由 governance parent 固定为
   `jinyiwei_mcp.yaml@71e36188…16f79/6958/100644` 与 `providers.yaml@82614f8a…4a1e/797/100644`；精确文件清单、stable-FD hash、no symlink/hardlink/special file、只读 owner 与复制后重验。
3. RED：missing、extra、mutated、symlink、race、wrong owner/mode、host cwd fallback。
4. GREEN：运行 focused 与完整 installed-wheel；必须 `4130 passed / 4 skipped / 0 failed`，并记录 wheel digest、app origin、dist-info origin 与 config tree digest。
5. runner 字节冻结后，只更新 SQLite `_TRUSTED_RUNNER_SHA256` 为该精确 raw SHA-256；SQLite 其余实现/测试不得漂移。

## Phase P2 — External runner pin

1. V4-A 完成后冻结 candidate，由独立只读工具计算 runner 与全部传递依赖 raw digest；candidate 自报不作为 expected。
2. 当前 repository 没有可证明该语义的 supervisor authority；先另立 protected work package，物化 manifest schema、grant/status 命令、root-owned immutable supervisor、供应证据与机器 GO。
3. Owner 在 distinct Gate B successor governance parent 中冻结 expected，并登记 supervisor grant identity、绝对 path/image digest、toolchain 与参数。
4. supervisor 对每个来源只打开一次 `O_NOFOLLOW` FD，从该 FD 流式 copy-and-hash；前后 `fstat`，临时副本 digest 匹配后 `fsync`、只读封存并原子发布，只从该副本启动 runner。
5. RED：runner+self-report 同改、绕过 runner 内校验、单模块 drift、依赖增删、同 inode/同 size 原地 TOCTOU、invalid expected、actual-as-expected。
6. GREEN：只有 supervisor 对 Gate B expected 精确匹配才铸造 process identity；后续 command/evidence 全程绑定同一 digest。
7. SQLite candidate-side fingerprint 只能作为内部 defense-in-depth；candidate 可同时修改 runner 与该值，因此它永远不能替代
   candidate-external supervisor expected。

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
2. 只有 machine closed set 已精确接受该 pair 才能继续；不得修改测试期望使之自动接受。
3. 若不接受，P14 exact30 进入终态 `STOP / NO_GO`：不得编制 oracle correction amendment、不得重新锚定 approval、不得创建 V5/V6 或同类后继治理版本，产品 exact30 也不得吸收 oracle 路径。

## Phase G2 — Release-execution pin

1. 生成并独立复审 30 行 product raw manifest：27 条 Gate A reviewed-baseline 必须完全相同，只有 runner、runner test 与
   SQLite runner fingerprint 三条 delta；历史 donor object 不可读，不把历史名称冒充字节证明。
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

- remote/base/tree、exact30、external expected、config source、absolute deadline 或工具版本漂移，或试图复用旧 V4 digest；
- 除独立代码或安全终审确认新的 P0 安全问题外，试图创建 V5、V6 或同类治理 successor；新的 P0 必须先 STOP、保存证据并取得 Owner 新授权；
- 需要第31路径，或试图修改 `backend/pyproject.toml`、`backend/config/**`、protected oracle/authority；
- machine STOP、external supervisor 未固定/未通过、readiness pair 不被接受、installed-wheel 非零失败、真实链路或独立复审未通过；
- fixture 冒充 generation、candidate 自签、配置打包、host/user-site 拼接、cleanup 超时后继续铸造 PASS；
- 缺少对应阶段的精确 Owner 授权。

## Rollback

- G0：放弃隔离工作树的三文件 correction packet；远端旧 V4 保留审计但不得继续授权。
- G1：未推送 commit 可放弃；已推送治理历史只能 forward successor。
- Product：保留失败 evidence，放弃未推送 child；不 reset、clean、stash 或覆盖用户资产。
- External cleanup：acceptance 超时后只允许人工、独立记录的运维清理，不能回写本轮 PASS。

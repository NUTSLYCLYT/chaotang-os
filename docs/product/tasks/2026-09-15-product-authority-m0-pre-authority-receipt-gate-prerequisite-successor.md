# Product Authority M0 Pre-Authority Receipt Gate Prerequisite Successor

Task ID: `PRODUCT-AUTHORITY-M0-PRE-AUTHORITY-RECEIPT-GATE-PREREQUISITE-SUCCESSOR-20260915`

## Status

Draft

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

当前唯一 `product-authority.m0.v1` 能机械绑定 approval commit、基线、产品路径和实时 `origin/ext-dev`，但 `--authorize` 在返回 `GO` 前不会验证 Mingshuo confirm/readback exact10 所要求的 sealed-FD、root-FD、18-case path-binding 与 Python dependency/plugin preflight。治理文档中的顺序不能替代机器门；直接调用 `--authorize` 仍可能绕过预检。

本 prerequisite 只设计现有 consumer 的一个向后兼容 receipt-gated approval 合同。receipt-gated approval 使用新的 manifest schema variant；旧 `product-authority.m0.approval.v1` approval 字节、canonical digest、历史结论和既有调用语义保持不变。新 variant 的普通 `product-authority.mjs --authorize` 仍是唯一公开入口与唯一 GO 决策者：它 strict-parse 调用参数、生成 nonce 和不含环境身份的 base challenge request，再启动固定 `/usr/bin/python3 -I -c <authority 内冻结 helper>`。helper 是唯一 FD identity observer 与受限 preflight worker，在自身进程树内 component-wise 打开 root/Git metadata FDs、创建 sealed memfd和 immutable verification view、完成全部 critical Git checks并启动controller/verifier，返回closed receipt与内核observation。外层authority根据base request与envelope机械重建完整challenge，独立strict-parse并逐字段核对 helper observation 与 receipt，只有闭合值一致才可构造GO。helper不能构造或输出authority result。调用方不得提供launcher、receipt路径、remote resolver、nonce、clock、FD或PASS文件。它不创建第二authority、第二Harness、数据库、lease、HSM、私钥、持久授权ledger、外部launcher或外部receipt文件。

当前 v1 authority 会拒绝 `.harness/*`、自身实现与 M0 文档等 protected product paths，也不理解 v2 manifest；因此 exact7 不能伪装成普通 product candidate，也不能由待安装的 v2 自我授权。唯一合法 bootstrap 路径是既有的 Owner 精确授权 protected-path governance repair：治理三文件先独立冻结；Owner 再对 exact7 的精确路径、基线、摘要、验证和普通 fast-forward 单独授权。该路径不运行 v1/v2 product authority、不产生产品 `GO`、不消费 one-child authority。exact7 落地后，后续 v2 产品任务才由增强后的唯一 `product-authority.m0.v1` 执行 receipt gate。

## Acceptance Criteria

- [ ] `origin/ext-dev`、base commit/tree 与 approval lineage 仍由现有 `product-authority.m0.v1` 核验；receipt 不能替代这些检查。
- [ ] 旧 `product-authority.m0.approval.v1` manifest 继续按原闭合合同验证，现有正式 approval bytes、canonical digest 与结果语义不变。
- [ ] 新 receipt-gated schema variant 必须显式包含 closed `preAuthorizationReceipt` policy；缺失、空值、未知字段、重复键、无序或重复 identity/case 均拒绝。policy 精确字段为 `schemaVersion`、`controllerVerificationId`、`verifierVerificationId`、`controllerIdentity`、`verifierIdentity`、`pathBinding`、`ttlMs`、`maxChallengeBytes`、`maxReceiptBytes`，不得多也不得少。
- [ ] 唯一公开入口和唯一 GO 决策实现仍为现有 `scripts/product-authority.mjs`；对 receipt-gated approval，普通 `--authorize` 必须自动运行固定 helper preflight，不存在 internal authority child、递归调用或第二个 result builder。helper 仅能返回 closed preflight envelope，缺少 challenge、receipt、内核 observation 或任一 FD 必须 STOP。
- [ ] authority 必须在同一次 `--authorize` 调用内生成 32-byte CSPRNG nonce；helper 进程树内部固定 FD ABI 为 `3=AF_UNIX/SOCK_SEQPACKET challenge/receipt channel`、`4=sealed controller memfd`、`5=sealed verifier memfd`、`6=repository root directory FD`。FD 4/5 必须精确具有 `F_SEAL_SEAL|F_SEAL_SHRINK|F_SEAL_GROW|F_SEAL_WRITE`；除 helper 明确 `pass_fds` 的 controller/verifier 子进程外全部 `CLOEXEC`，成功或失败均关闭。
- [ ] challenge 与 receipt 均为单个 UTF-8 RFC 8785 canonical JSON datagram，不允许 BOM、NUL、尾随字节或第二帧；challenge 上限 `16384` bytes，receipt 上限 `65536` bytes，helper request 上限 `1048576` bytes。短读、截断、超限、EOF 或额外帧均 STOP。
- [ ] policy 的 `ttlMs` 只接受安全整数 `1000..300000`；challenge 固定 `issuedMonotonicMs` 与 `expiresMonotonicMs=issued+ttlMs`，receipt 必须原样绑定，authority 使用同一 kernel monotonic clock 在消费前后验证未过期且无未来时间漂移。
- [ ] receipt 必须绑定 task、approval commit/tree/canonical digest、首次观察的实时 remote、challenge digest、nonce、单调时钟 TTL、controller/verifier 的实际 sealed-FD raw SHA-256 与 Git blob SHA-1、root-FD identity、18-case record/schema digest、caseCount 与有序 case 结果。
- [ ] 外层 authority 必须从 policy 点名的 controller Node entry `node --input-type=module --eval <source>` 与 verifier Python entry `python3 -I -c <source>` 重算 raw/blob identity；helper 从 FD 4/5 以 `pread` 从 offset 0 读到精确 EOF 并二次重算，并执行 `F_GET_SEALS`、`fstat`、短读/FD 复用检查。verifier 只能由 `/usr/bin/python3 -I -c <FD5 exact bytes>` 启动并获得 FD 3/4/6，由 verifier 从 `/usr/bin/node --input-type=module --eval <FD4 exact bytes>` 启动 controller；禁止按可变路径执行。helper 只接受外层 authority 构造的 bounded stdin 和固定环境/timeout，stderr 不进入结果。任何 entry 工具、参数形状、cwd、timeout、mode、bytes、digest 或 seal 漂移均 STOP。
- [ ] 固定 helper 是唯一 FD identity observer：它以 component-wise `openat`、`O_NOFOLLOW|O_CLOEXEC` 打开 repository root、gitDir、gitCommonDir、objects、HEAD、index 与允许的 config source；不得由调用方传入FD，也不得从后续可变pathname重新发现。helper envelope 的FD/Git observation必须与 canonical receipt逐字段相等；外层authority只对closed canonical values、approval/policy/source identity与base challenge重算，不虚构自己持有相同open file descriptions。receipt-gated v2仅支持detached HEAD；v1不变。
- [ ] helper 必须在任何工作树读取前安装递归 inotify watch（watch 建立/遍历期间有事件或 overflow 即 STOP），再通过 root FD 的 component-wise `openat`、`O_NOFOLLOW` 建立 mode `0700` 的一次性 immutable verification view。index 使用已绑定 FD 的精确 bytes，tracked worktree bytes 只从 root FD 读取；Git metadata 使用已打开描述符或 sealed copy。所有 critical HEAD/clean/remote 检查只在 helper 的 FD-anchored synthetic Git context 中运行，禁止重新解析原工作区 `.git` 或 config pathname；view 成功/失败均删除且不成为持久状态。
- [ ] 对原 root、`.git`、gitDir、gitCommonDir、objects、config、HEAD、index 与所有 tracked path 的 rename、symlink、mount、write、replace-and-restore/ABA 必须由 watch event、FD identity、digest 或 helper-envelope/receipt observation mismatch 至少一项捕获并 STOP；事件清空、watch 缺失/新增目录、队列 overflow、快照前后不一致也必须 STOP。单纯“命令前后 pathname snapshot 相同”不得作为通过依据。
- [ ] 所有 v2 Git 调用必须固定 `/usr/bin/git --no-replace-objects`，只在 helper 的 synthetic context 中执行，work-tree/git-dir/object/index 均来自 FD-bound view，remote 使用 approval 冻结并与 repository identity 等值的 normalized origin URL 作为显式参数。原 repository config 仅作为FD-bound raw bytes/identity输入，不被Git加载；helper从中只提取并验证必要事实，再构造closed synthetic config projection，精确只含受约束的 `core.repositoryformatversion`、`core.filemode`、`core.bare=false`、`extensions.worktreeconfig` 与唯一 `remote.origin.url`。原config中其他键可作为inert bytes存在，但任一未选键被helper/Git加载、复制或影响行为必须STOP，尤其是`core.sshCommand`、`core.gitProxy`、`http.*`、`protocol.*`、`remote.*.uploadpack`、include/includeIf、`url.*.insteadOf/pushInsteadOf`、credential/helper及filter/diff/textconv/external command。
- [ ] v2 remote preflight 只允许无需调用方凭据或ambient proxy即可完成的固定HTTPS read-only `ls-remote`；需要认证、代理或credential acquisition时必须返回 `REMOTE_HEAD_UNVERIFIED`，不得回退加载repository/user/system config，也不得把秘密、helper或proxy路径加入receipt。任何未来非秘密固定transport profile必须另行治理，不在本exact7内猜测。
- [ ] helper Git 子进程使用 env-i allowlist：`PATH=/usr/bin:/bin,HOME=/nonexistent,LANG=C.UTF-8,LC_ALL=C.UTF-8,GIT_CONFIG_NOSYSTEM=1,GIT_CONFIG_GLOBAL=/dev/null,GIT_NO_REPLACE_OBJECTS=1,GIT_TERMINAL_PROMPT=0`。调用方环境中的 `GIT_*`、`SSH_*`、proxy/askpass/config/object/worktree override 先被丢弃；若 approval policy、helper request 或显式配置企图携带这些 override 则拒绝。不得含糊地把“未继承的 ambient 值”与“主动注入尝试”视为同一动作。
- [ ] 18-case path-binding 合同固定为 schema version `chaotang.path-binding-self-test.attestation.v1`、record `4123` bytes / `sha256:7ba1eeb23769551d2be58f136c1038e8897f5141755f5a34ac2cf0c39fa0c572`、schema `8475` bytes / `sha256:9afc472beb987bfe1c233e61f3247a5f509d52aa37d375f124cb451a3ccdf049`；ordered cases 必须逐项等于 Plan 与 Packet 冻结的 18 个完整 descriptor，每项只能是目标 `VERIFICATION_PATH_IDENTITY_DRIFT / PASS / UNCHANGED`。
- [ ] 缺失、过期、重复消费、跨 approval、错 remote、错 digest、错 FD、错误 seal、错误 root、case 缺失/重复/重排、非 PASS、额外字段或 receipt 尾随字节均必须 STOP。
- [ ] nonce 只在当前 `--authorize` 调用内有效且至多消费一次；helper 关闭 channel/identity FDs，authority 不保存允许状态。跨调用 replay 因新 nonce 不匹配而 STOP，无需持久 ledger。
- [ ] receipt 验证前后必须绑定同一 approval HEAD、clean worktree 和实时 remote；预检期间任一移动、写入或网络不可验证均 STOP。
- [ ] receipt 顶层字段必须精确为 `schemaVersion,status,taskId,approvalCommit,approvalTree,approvalCanonicalDigest,remoteHead,challengeDigest,nonce,issuedMonotonicMs,expiresMonotonicMs,controllerIdentity,verifierIdentity,rootFdIdentity,gitMetadataIdentity,pathBinding`；`status` 只能为 `PASS`，所有 identity/pathBinding 子对象 closed，字段及格式由 Packet 冻结。
- [ ] v2 `GO` 仍使用 `product-authority.m0.result.v1` 的同一 closed shape；仅 receipt-gated GO 的既有 `evidenceDigest` 从低敏 canonical evidence record 计算。不得新增结果字段，不输出 receipt 原文、nonce、FD、controller/verifier bytes、环境、helper stdout/stderr 或凭据；v1 结果逐字段不变。
- [ ] downstream Mingshuo exact10 approval 的 focused/backend-full Python 验证必须在进程级设置 `TMPDIR=/tmp TEMP=/tmp TMP=/tmp`，并先机械证明 Python `tempfile.gettempdir()` 与 POSIX 临时文件语义；不得持久修改环境。
- [ ] product-authority、schema、Harness、doctor、hook、V2 与旧 approval 回归全绿；Governance、Architecture、Security 三审均为 `GO / P0=0 / P1=0 / P2=0`。
- [ ] exact7 安装只能走 Owner 精确授权的 protected-path governance repair，且必须是冻结 base 的直接单亲、仅七路径、完整矩阵与三审通过、普通 fast-forward；不得运行当前 v1 authority、不得声称 v2 自授权或生成产品 GO。安装后 future v2 产品 approval 才能调用 receipt-gated authority。

## Delivery Constraints

- 唯一 authority ID 保持 `product-authority.m0.v1`；receipt、controller、verifier、Harness、review 或测试均不能产生第二个 GO。
- M0 威胁边界保持不变：信任 Owner、OS owner、Gitee owner 与整个 runner；本包不宣称抵御这些已被控制的主体。
- 防重放依赖同一进程内 fresh challenge、固定 FD、单调 TTL 和单次状态机，不引入跨进程持久允许记录。
- 旧 approval 不被静默升级为 receipt-gated；只有明确使用新 schema variant 并冻结 `preAuthorizationReceipt` 的 future approval 才启用该门。
- `preAuthorizationReceipt` 只接受 closed data 和 authority 内部固定 FD ABI；不得接受任意 receipt 路径、任意 shell、调用方替换 remote resolver、nonce、clock、helper、环境、FD 或外部 PASS 文件。
- 本门只关闭“未执行 receipt preflight 或顺序错误仍能 GO”的路径；受信任 runner/OS owner 仍在既有威胁边界内，不宣称阻止其主动伪造进程或内核观察。
- 当前 blocked exact10 三文件保持 `NO_GO_EVIDENCE_ONLY / DO_NOT_MATERIALIZE / NO_REANCHOR`；exact10 donor 与产品字节完全不动。
- 当前 v1 对 exact7 返回 `PRODUCT_PATH_PROTECTED` 是已知 bootstrap 边界；不得为绕过它伪造 product approval。protected-path repair 只接受 Owner 对冻结 exact7 identity 的显式、一次性、forward-only 授权，并沿用直接单亲、三审、完整回归与普通 fast-forward 门禁。
- 本任务仅编制治理草案；不实施 exact7、不运行 authority、不提交、不推送、不 force-push、不部署。

## Affected Modules

- 模块：M0 approval schema、唯一 Product Authority consumer、Owner/边界说明与回归测试。
- 允许路径：
  - `.harness/agents/project-owner.md`
  - `.harness/contracts/product-approval.schema.json`
  - `.harness/rules/project-boundaries.md`
  - `docs/product/tasks/2026-08-16-m0-solo-owner-product-authority.md`
  - `docs/superpowers/plans/2026-08-16-m0-solo-owner-product-authority.md`
  - `scripts/product-authority.mjs`
  - `scripts/product-authority.test.mjs`

## Technical Plan

1. 在现有 schema 文件中保留完整 v1 分支，并增加 receipt-gated v2 分支；v2 强制 Packet 冻结的 closed `preAuthorizationReceipt` policy，authority ID 仍为 `product-authority.m0.v1`。不得就地放宽 v1 顶层字段。
2. 在 `product-authority.mjs` 中抽取共用 verification/identity 校验器。receipt-gated `--authorize` 从 policy 点名 entry 获取源字节并核对身份，自行生成 nonce/challenge，然后启动固定 shell-free Python helper。helper 只负责创建/封印 memfd、建立自身进程树内 FD 3–6、启动 verifier/controller、观察内核 identity 并原样回传 receipt；不存在 internal authority child。
3. Python helper 必须以 `-I -c` 固定 inline bytes、固定最小环境、固定 timeout 和 bounded stdin 运行；helper独占root/Git metadata FDs，对FD 4/5使用`F_GET_SEALS`、`fstat`、`pread`，并建立递归watch与immutable synthetic Git view。helper response是不超过`262144`bytes、无尾随字节的单个RFC8785 canonical UTF-8 closed envelope，精确字段为`schemaVersion,receiptBytesBase64,fdObservation,gitMetadataIdentity`；源码不得包含GO/result builder。
4. receipt-gated `--authorize` 的base challenge、approval/source policy解释与final GO决策仍由外层authority完成；全部critical approval-commit/HEAD/clean/remote与Git metadata/config检查由同一个long-lived helper在FD-anchored view内执行。helper把自身observation写入完整challenge并由controller/verifier回显到receipt；外层根据自己生成的base request、nonce和closed envelope重建完整challenge，重算digest，并要求helper observation与receipt逐字段一致、watch无事件/overflow、view digest一致后才继续。`pathBindingPolicyDigest`精确为Packet `contract.pathBinding`对象的RFC8785 canonical UTF-8 bytes SHA-256。
5. 使用进程内状态保证 challenge 仅签发一次、receipt 仅消费一次；所有 FD 在成功或失败路径关闭。无 receipt、重复读取、尾随数据、超时、子进程/通道异常一律 STOP。
6. GO result 继续使用同一 v1 result schema；v2 的 `evidenceDigest` 由 Packet 冻结的低敏 evidence record 计算，旧 v1 GO 逐字段保持不变。
7. 在 `product-authority.test.mjs` 先形成真实 RED，覆盖 schema、内部 preflight 不可绕过、helper/FD/seal/offset/close、helper-receipt identity、outer canonical重算、nonce/TTL/replay、cross-binding、完整18-case topology、root/cwd/`.git`、transient ABA、synthetic config隔离、仓库config/transport注入、HEAD/worktree/remote movement、输出泄漏与94份旧approval回归，再做最小GREEN。
8. 更新 canonical Owner/M0 文档，明确 v2 opt-in gate、真实威胁边界和一次性 protected-path bootstrap。当前 exact7 仅在 Owner 对冻结 identity 明确授权后作为 governance repair 实施；不得运行 v1 product authority，也不得借未来 v2 自授权。若需要第八条路径立即 STOP。

## Implementation Report

只读诊断确认 base 为 `453d7b741fba25bd2dc18270114c24eb984f6a84 / 5c1dfc7e7817f293f17379023343d64b06f54d55`，实时远端一致。主线 94 份正式 approval 均为 `product-authority.m0.approval.v1` 且通过当前严格 validator；`check_harness.mjs` 统一调用 `validateApprovalManifest`，doctor 只绑定既有 consumer/schema 路径，offline release 只消费 candidate verification。`scripts/mingshuo-fact-pack.mjs` 的闭合 approval 检查只读取自身历史 exact23 approval，因此旧 bytes 不变时无需进入本候选。

当前 `authorizeProductWork()` 的确定性顺序是 clean → approval inspect → remote → clean → remote → GO，未执行任何 preflight receipt 核验；其 v1 validator 同时拒绝 exact7 的 protected paths并不理解 v2 schema。最窄依赖闭包因此是上述 exact7，但安装路线必须是既有 Owner-authorized protected-path governance repair，而不是 product candidate 或自举 GO。尚未实施任何候选代码；本治理草案不继承 blocked exact10 的 approval、authority、candidate、验证或审查身份。

## Acceptance Review

治理冻结前必须确认：三文件只描述exact7 protected-path prerequisite；bootstrap是Owner精确授权的governance repair且不产生产品GO；v1/v2兼容策略不放宽旧manifest；challenge/receipt协议在一次authority调用内闭合；replay、TTL、helper-owned FD identity、outer canonical重算、transient ABA、synthetic config隔离、case topology、remote和clean-worktree负向测试完整；没有第二authority或持久允许状态。

任一远端漂移、第八条候选路径、旧 approval 不兼容、任意直接 authorize 绕过、receipt 可跨调用重放、identity 仅信任自报、敏感输出、关键验证失败或独立审查 P0–P2，均立即 STOP。

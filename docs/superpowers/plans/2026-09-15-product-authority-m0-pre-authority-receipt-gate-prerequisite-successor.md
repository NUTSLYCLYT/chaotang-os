# Product Authority M0 Pre-Authority Receipt Gate Prerequisite Successor Plan

Task: `PRODUCT-AUTHORITY-M0-PRE-AUTHORITY-RECEIPT-GATE-PREREQUISITE-SUCCESSOR-20260915`

Base: `453d7b741fba25bd2dc18270114c24eb984f6a84 / 5c1dfc7e7817f293f17379023343d64b06f54d55`

Status: `DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Objective

让唯一 `product-authority.m0.v1` 对显式 receipt-gated approval 在返回 `GO` 前机器执行并核验 preflight challenge/receipt；关闭跳过预检或顺序错误仍可 GO 的路径，同时完整保留 94 份 v1 approval 的字节、canonical identity、历史结论与现有行为。

## Exact Governance Boundary

Approval commit paths 精确三条：

1. `docs/product/tasks/2026-09-15-product-authority-m0-pre-authority-receipt-gate-prerequisite-successor.md`
2. `docs/product/tasks/2026-09-15-product-authority-m0-pre-authority-receipt-gate-prerequisite-successor.packet.json`
3. `docs/superpowers/plans/2026-09-15-product-authority-m0-pre-authority-receipt-gate-prerequisite-successor.md`

Future protected candidate paths 精确七条：

1. `.harness/agents/project-owner.md`
2. `.harness/contracts/product-approval.schema.json`
3. `.harness/rules/project-boundaries.md`
4. `docs/product/tasks/2026-08-16-m0-solo-owner-product-authority.md`
5. `docs/superpowers/plans/2026-08-16-m0-solo-owner-product-authority.md`
6. `scripts/product-authority.mjs`
7. `scripts/product-authority.test.mjs`

不修改 `AGENTS.md`、Harness、doctor、project manifest、credential-separated broker 或 Mingshuo 产品路径。若实现需要第八条路径，立即 STOP 并重新治理。

## Protected-Path Bootstrap

当前 v1 authority 不接受 v2 manifest，并对上述七条 protected paths 返回 `PRODUCT_PATH_PROTECTED`。因此 exact7 不得走普通 M0 product candidate，也不得由尚未落地的 v2 自我授权。它只能沿用仓库既有先例：Owner 在三文件治理包冻结后，对精确 base、exact7 paths、候选摘要、完整验证、三审、直接单亲提交与普通 fast-forward 明确授权一次 forward-only protected-path governance repair。该 repair 不运行 product authority、不产生 `GO / APPROVED_FOR_ONE_CHILD`、不消费或伪造 one-child authority。exact7 落地后，future v2 产品 approval 才由升级后的同一个 `product-authority.m0.v1` receipt gate处理。

## Manifest Compatibility Design

- 保留 `product-authority.m0.approval.v1` 的完整闭合分支，不接受新字段，不改变历史 canonical bytes。
- 同一 schema 文件增加 `product-authority.m0.approval.v2` 闭合分支；authority ID 继续固定为 `product-authority.m0.v1`。
- v2 必须包含 closed `preAuthorizationReceipt` policy；精确字段为 `schemaVersion,controllerVerificationId,verifierVerificationId,controllerIdentity,verifierIdentity,pathBinding,ttlMs,maxChallengeBytes,maxReceiptBytes`。controller ID 必须唯一指向 `tool=node,args=["--input-type=module","--eval",<source>],cwd="."`；verifier ID 必须唯一指向 `tool=python3,args=["-I","-c",<source>],cwd="."`。其 mode/bytes/raw SHA-256/Git blob SHA-1 必须与 policy closed identity 完全一致。
- policy 固定 `ttlMs=1000..300000`、challenge `<=16384` bytes、receipt `<=65536` bytes、helper request `<=1048576` bytes。所有数值必须为安全整数；未知字段、重复键、重复 ID、非精确 entry shape 或越界均拒绝。
- v1 不隐式获得 receipt gate；v2 缺 policy 或 policy 空/额外/重复/无序时 schema 与 JS validator 同时拒绝。
- `check_harness.mjs` 继续复用 `validateApprovalManifest`，无需形成第二份 approval parser。

## Canonical Parent And Fixed FD ABI

不新增第八条launcher路径。普通`scripts/product-authority.mjs --authorize`是唯一公开入口和唯一GO决策者；它解析调用参数、生成nonce/base challenge request并启动固定`/usr/bin/python3 -I -c <内嵌且受product-authority.mjs identity约束的helper>`。helper是唯一FD identity observer与受限preflight worker，只在自身进程树中完成component-wise openat、inotify、Linux`memfd_create/F_ADD_SEALS/F_GET_SEALS`、immutable verification view、controller/verifier与FD 3–6编排，并原样回传closed receipt和内核observation。外层根据base request与closed envelope重建完整challenge并做唯一GO决策。不存在internal authority child、递归入口或第二个result builder。

helper 通过 bounded stdin 接收外层 authority 构造的 closed request；不得接受调用方的 executable、environment、clock、remote resolver、FD、receipt path 或 PASS bytes。helper response 精确为不超过 `262144` bytes、无尾随字节的单个 RFC 8785 canonical UTF-8 closed `schemaVersion,receiptBytesBase64,fdObservation,gitMetadataIdentity` envelope；receipt 采用 RFC 4648 canonical base64且严格回编码一致，fdObservation 精确绑定 channel type、FD 3–6、两份identity、两组seals与root identity。helper 不得包含 GO/result builder。非零退出、超时、额外 stdout、任意 stderr 或平台不支持均 STOP。

内部 ABI 精确为：

| FD | 类型与角色 | 约束 |
| --- | --- | --- |
| 3 | `AF_UNIX/SOCK_SEQPACKET` challenge/receipt | authority→verifier 一条 challenge；verifier→authority 一条 receipt；每向仅一个 canonical UTF-8 JSON datagram |
| 4 | controller memfd | regular memfd；从 offset 0 `pread`；exact bytes/mode/raw/blob；`F_SEAL_SEAL|F_SEAL_SHRINK|F_SEAL_GROW|F_SEAL_WRITE` |
| 5 | verifier memfd | 与 FD 4 相同，身份独立 |
| 6 | canonical repository root dirfd | 由固定helper component-wise `openat`打开并持有；`O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC`；绑定`realpath,st_dev,st_ino,st_mode,st_uid,st_gid` |

固定helper还必须以component-wise`openat`、`O_NOFOLLOW|O_CLOEXEC`打开gitDir、gitCommonDir、objects、HEAD、index与允许的config sources，形成closed metadata descriptor set；不接受caller-supplied FD，也不向Node父进程声称回传open file description。helper内描述符默认`CLOEXEC`，只在固定Git/controller/verifier子进程边界临时继承。所有成功/失败/信号路径关闭全部端点。短读、截断、offset污染、FD close/reuse、非regular memfd、seal少/多或identity漂移均STOP。

## Single-Invocation Challenge/Receipt Protocol

1. Authority生成fresh nonce与closed base challenge request并固定helper输入上限；helper从canonical cwd开始component-wise打开root与Git metadata descriptors，不接受调用方FD或环境override。helper在读取工作树前递归建立inotify watch，建立期间的事件、目录新增或queue overflow即STOP；随后仅以root FD `openat/O_NOFOLLOW`读取tracked bytes和已绑定index，创建权限`0700`的一次性immutable verification view。Git只在该synthetic context运行，原工作区config不被Git加载。
2. 对 v2 approval，authority 从 policy 点名 entry 的 `<source>` UTF-8 bytes 独立计算 raw SHA-256 与 Git blob SHA-1；helper 复制到 FD 4/5、加精确 seals，并以 `pread(0..EOF)` 重新计算。两侧 bytes/mode/length/digest、`F_GET_SEALS` 与 fdinfo 不一致即 STOP。helper 以 `/usr/bin/python3 -I -c <FD5 exact bytes>` 启动 verifier并仅传 FD 3/4/6；verifier拥有18项fixture并以 `/usr/bin/node --input-type=module --eval <FD4 exact bytes>` 启动controller。禁止从可变pathname执行任一来源。
3. Authority使用CSPRNG生成32-byte nonce，记录kernel monotonic`issuedMonotonicMs`，按policy计算`expiresMonotonicMs`，构造不含环境observation的closed base challenge request。helper完成FD/Git/remote观测后只把这些closed值加入完整challenge；完整challenge字段精确为`schemaVersion,taskId,approvalCommit,approvalTree,approvalCanonicalDigest,remoteHead,nonce,issuedMonotonicMs,expiresMonotonicMs,controllerIdentity,verifierIdentity,rootFdIdentity,gitMetadataIdentity,pathBindingPolicyDigest`。外层收到envelope后以自己的base request和helper observation独立重建同一canonical challenge；`pathBindingPolicyDigest`是Packet `contract.pathBinding`对象RFC8785 canonical UTF-8 bytes的SHA-256，`challengeDigest`是完整challenge bytes的SHA-256。
4. Helper将完整challenge只写入FD 3一次并原样回传verifier的唯一receipt datagram；authority只读取helper envelope中一条`<=65536`bytes strict canonical receipt。拒绝BOM、NUL、EOF、空值、重复键、非UTF-8、非canonical bytes、未知字段、尾随bytes、超时和第二datagram。
5. Receipt 顶层精确字段为 `schemaVersion,status,taskId,approvalCommit,approvalTree,approvalCanonicalDigest,remoteHead,challengeDigest,nonce,issuedMonotonicMs,expiresMonotonicMs,controllerIdentity,verifierIdentity,rootFdIdentity,gitMetadataIdentity,pathBinding`；status 只能为 `PASS`，identity 与 pathBinding 子对象均 closed。
6. Receipt必须逐字段绑定challenge、approval、remote、实际controller/verifier/root/Git metadata FD identity、18-case record/schema与有序结果。helper envelope的FD/Git observation与receipt必须逐字段完全相等；外层authority根据自己生成的base request、nonce与envelope重建完整challenge并重算全部digest，不依赖可变pathname observation，也不声称持有helper FDs。使用同一kernel monotonic clock验证TTL，nonce只有`ISSUED → CONSUMED`一次转换。
7. Closed Git metadata identity覆盖root、`.git`kind/gitfile bytes、gitDir/commonDir/objects、detached HEAD、index及按序config source的FD/fstat/raw digest。原config允许存在其他普通键，但仅作为绑定的inert bytes，Git永不加载；helper构造并实际加载的synthetic projection只允许精确值的`core.repositoryformatversion`、`core.filemode`、`core.bare=false`、`extensions.worktreeconfig`与唯一`remote.origin.url`。任一其他键被选择、复制、加载或影响行为即STOP，重点覆盖`core.sshCommand/core.gitProxy/http.*/protocol.*/remote.*.uploadpack/include/includeIf/url.*/credential/helper/filter/diff/textconv/external`。receipt-gated v2仅支持detached HEAD。
8. 所有critical approval-commit/HEAD/clean/remote检查均由同一long-lived helper在FD-anchored synthetic Git context执行：固定`/usr/bin/git --no-replace-objects`，work-tree/git-dir/object/index来自immutable view，remote使用approval冻结且规范化的origin URL显式参数。Git子进程使用env-i allowlist；ambient`GIT_*`/`SSH_*`/proxy/askpass等不继承，policy/helper request中的显式注入则拒绝。只允许无需调用方凭据或ambient proxy的HTTPS read-only remote；若需要认证/代理则`REMOTE_HEAD_UNVERIFIED`，不得回退repo/user/system config。递归watch覆盖snapshot构建、全部Git、receipt与GO前边界；任何write/rename/mount/symlink/replacement或replace-and-restore ABA事件、watch缺失/overflow、新目录、FD/digest漂移均STOP。
9. 全部一致才返回 `GO / APPROVED_FOR_ONE_CHILD`。结果仍为 `product-authority.m0.result.v1` 原 closed shape；仅 v2 的既有 `evidenceDigest` 绑定 `schemaVersion,approvalCommit,approvalTree,approvalCanonicalDigest,remoteHead,challengeDigest,receiptDigest,controllerRawSha256,controllerGitBlobSha1,verifierRawSha256,verifierGitBlobSha1,pathBindingRecordDigest,pathBindingSchemaDigest` 的 RFC 8785 digest，record 本身不输出。
10. 所有成功/失败路径关闭 FD、清空内存态且不写允许记录。receipt 不落盘、不缓存、不成为新的 authority。

## Frozen 18-Case Topology

record contract 精确为 `chaotang.path-binding-self-test.attestation.v1`、`4123` bytes、`sha256:7ba1eeb23769551d2be58f136c1038e8897f5141755f5a34ac2cf0c39fa0c572`；closed schema 精确为 `8475` bytes、`sha256:9afc472beb987bfe1c233e61f3247a5f509d52aa37d375f124cb451a3ccdf049`。以下顺序不可改变，每项完整预期均为 `observedStop=VERIFICATION_PATH_IDENTITY_DRIFT, cleanup=PASS, externalSentinel=UNCHANGED`：

1. `mkdir.home-ancestor.rename-directory-replacement`
2. `mkdir.home-ancestor.symlink-replacement`
3. `mount.home-ancestor.rename-directory-replacement`
4. `mount.home-ancestor.symlink-replacement`
5. `mount.target.rename-directory-replacement`
6. `mount.target.symlink-replacement`
7. `copy.home-ancestor.rename-directory-replacement`
8. `copy.home-ancestor.symlink-replacement`
9. `copy.target.rename-directory-replacement`
10. `copy.target.symlink-replacement`
11. `remount.home-ancestor.rename-directory-replacement`
12. `remount.home-ancestor.symlink-replacement`
13. `remount.target.rename-directory-replacement`
14. `remount.target.symlink-replacement`
15. `cleanup.home-ancestor.rename-directory-replacement`
16. `cleanup.home-ancestor.symlink-replacement`
17. `cleanup.target.rename-directory-replacement`
18. `cleanup.target.symlink-replacement`

Packet 中每项同时冻结 `stage,target,attack`，authority 必须逐对象等值比较，不能只比较 count、ID set 或摘要字符串。

## TDD Matrix

先形成失败测试，再实施最小修复：

- Schema：v1 回归；v2 缺 policy、空 policy、额外字段、错误 controller Node/verifier Python entry shape、错误 enum/digest/TTL、重复或无序 identity 拒绝。
- Parser：receipt 重复键、控制字符、非法 UTF-8、BOM/NUL、非 canonical、尾随 bytes、超限、空 EOF 或第二帧拒绝。
- Bypass：v2 普通 CLI/API 必须自动进入唯一 helper preflight；任何跳过 helper、注入外部 FD/receipt/PASS、替换 remote resolver、nonce source、clock 或 receipt reader的路径必须 STOP。该门不宣称防御已受信任的 runner/OS owner。
- Binding：跨 task/approval commit/tree/canonical digest、旧或错 remote、controller/verifier raw/blob、root FD、record/schema digest 均 STOP。
- FD：固定 helper 的 source→memfd→seal→pread→exact argv execution identity 闭合；路径替换不影响已绑定 FD；非普通 memfd、未 sealed、seal 多/少、错 mode、短读、offset 污染、截断/追加、关闭、复用或退回pathname执行均 STOP。
- Freshness：过期、未来时间、nonce 不匹配、同 receipt 二次消费、前一调用 receipt 在后一调用 replay 均 STOP。
- Cases：18 项缺失、额外、重复、重排、错误 ID/stage/target/attack、错误 STOP code、cleanup 非 PASS 或 sentinel 改变均 STOP。
- Concurrency：preflight 中 root/cwd/`.git`、gitdir/common-dir/objects/config/HEAD/index/tracked path 的 rename、symlink、mount、write、atomic replacement与restore-after-use ABA，或 HEAD、工作树、remote 移动；watch缺失/overflow/新增目录；remote无法验证，全部 STOP，并证明 Git只消费immutable view。
- Git environment/config：ambient`GIT_*`/`SSH_*`/proxy/askpass不继承；policy/helper request主动注入则STOP。原repository config任意非选字段可作为inert bytes存在，synthetic projection必须closed；对`core.sshCommand`、`core.gitProxy`、`http.proxy`、`protocol.*.allow`、`remote.origin.uploadpack`、include、url rewrite、credential/filter/diff/textconv/external command一旦被选择或加载逐项形成真实负向测试。private/auth-required remote必须fail-closed。
- Bootstrap：当前v1对任一exact7 path均不得被伪造成GO；只有Owner精确protected-path governance repair可安装exact7，且该路径不构造product result。落地前后七路径、base/parent/tree、remote、完整矩阵和三审必须逐项复核。
- Output：GO/STOP 只暴露 reason 与 digest，不输出 receipt、nonce、FD、raw bytes、env、helper stdout/stderr 或 credential。
- Compatibility：当前 94 份正式 v1 approval 全部继续通过，旧 authority CLI/API 与 `product-authority.m0.result.v1` 逐字段行为不变。

## Verification

Future exact7 candidate 必须运行：

```text
TMPDIR=/tmp TEMP=/tmp TMP=/tmp node --test scripts/product-authority.test.mjs
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node scripts/harness-doctor.mjs --check
node --test scripts/harness-doctor.test.mjs
node .agents/hooks/check-harness.mjs --self-test
node scripts/ext-full-value-convergence.mjs --check
node --test scripts/ext-full-value-convergence.test.mjs
git diff --check
```

另外机械遍历 `.harness/approvals/*.json`，严格解析并验证 94 份 v1 manifest，记录文件 raw SHA 与 canonical digest 在实施前后完全一致。

Downstream exact10 focused/backend-full 必须分别由单一进程 wrapper 设置 `TMPDIR=/tmp TEMP=/tmp TMP=/tmp`，先确认 `tempfile.gettempdir()==/tmp`、POSIX mode 与 create/write/read/truncate/delete，再启动未改变选择器和 capture 的 pytest。

## Review

- Governance Review：单一 authority、Owner protected-path bootstrap、旧 approval 生命周期、no-reanchor 与 exact7 边界。
- Architecture Review：v1/v2 schema分派、canonical parent、helper独占FD topology、状态机、错误闭合、调用方兼容与无第八路径。
- Security Review：nonce/TTL/replay、closed parser、helper/FD/seal/identity、root/path TOCTOU、remote/HEAD、输出泄漏与 fail-closed。

任一 P0–P2 为 NO-GO。P3 必须记录但不阻断治理冻结，除非会改变 exact paths 或安全语义。

## Rollback And Non-Goals

本轮仅有三份未提交治理草案，删除草案即可回到 base；不触碰产品或 authority。未来 exact7 只有在Owner精确批准protected-path governance repair后才能落地；该提交必须直接单亲、仅exact7、普通fast-forward。若需回滚，只能用新的forward-only corrective successor，不改写历史。

禁止实施 exact7、运行任何产品 authority、物化 blocked exact10、修改 exact10 donor、提交、推送、force-push、生产部署、第二 authority、第二 Harness、数据库、lease、HSM、私钥、持久 ledger、外部 launcher 或外部 receipt 文件。

## Stop Conditions

实时远端离开base；三文件外任何治理修改；future candidate超过exact7；exact7被当作M0 product candidate或v2自授权；v1行为或canonical identity漂移；v2可缺省receipt gate；唯一helper preflight可绕过；helper可构造GO；原config被Git加载或synthetic projection不闭合；认证/代理失败后回退ambient配置；Git读取退回可变pathname；transient ABA不能STOP；FD/seal/root/helper-receipt identity不闭合；outer无法从closed values重建challenge；receipt可跨调用重放；TTL不使用单调时钟；case topology不闭合；敏感内容进入结果；任何验证失败或独立审查P0–P2，均立即STOP。

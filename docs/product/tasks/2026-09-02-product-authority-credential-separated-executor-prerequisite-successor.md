# Product Authority Credential-Separated Executor Prerequisite Successor

任务 ID：`PRODUCT-AUTHORITY-CREDENTIAL-SEPARATED-EXECUTOR-PREREQUISITE-SUCCESSOR-20260902`

冻结基线：`91254aa014c23661959ce3a8515b43742ebf3b7e`

冻结基线 tree：`e3ae0ff085825444ffb7796ac731c7b3591a4e98`

> 治理状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`
>
> 本 successor 只设计唯一 Product Authority 下属的 credential-separated execution transport。它不做
> GO/STOP，不解析 approval，不移动远端，不授权 P14、Release 或生产部署。

## Status

Draft

## Product Definition

当前 `product-authority.m0.v1` 与 controller 使用同一真实宿主 UID 执行 verification gate。即使候选已经
sealed、只读挂载，普通同 UID sibling 仍可经宿主 `/proc/<gate-or-descendant>/root` 写入 gate 的 private
`/tmp`。mount/PID namespace、`NO_NEW_PRIVS` 与现有 seccomp 均不能建立凭据边界。

被拒绝 predecessor 精确为：

- task：`PRODUCT-AUTHORITY-IMMUTABLE-CANDIDATE-SNAPSHOT-PREREQUISITE-SUCCESSOR-20260902`
- 三文件路径：
  - `docs/product/tasks/2026-09-02-product-authority-immutable-candidate-snapshot-prerequisite-successor.md`
  - `docs/product/tasks/2026-09-02-product-authority-immutable-candidate-snapshot-prerequisite-successor.packet.json`
  - `docs/superpowers/plans/2026-09-02-product-authority-immutable-candidate-snapshot-prerequisite-successor.md`
- Task raw：`sha256:860ae3f6861cc0b0e6f9a746f2b2020bfe2d2cadba6da89d1cb2f8bb4526a465`
- Packet raw：`sha256:1de24b714d05443404b325d6fddfb688314e012aadbd8128f9cf9fc3840c668b`
- Plan raw：`sha256:004b265b115c2623dd403c0e48c00fa99de0e5009e74b792c3d236ade55e3408`
- Packet canonical：`sha256:69ccc2f06ceb795efa3b85f756da0bec7300f0cd404d1390c1594205deb92f5d`
- 三文件 bundle：`sha256:b7f31a8187afb8fdfec1a2351f7c0de6253b4bd59acc23d716c80341d2636569`
- disposition：`ABANDONED_UNCONSUMED / NO_RETRY / NO_AUTHORITY_INHERITANCE / BYTE_DONOR_ONLY / NO_REANCHOR`

当前仓库和宿主没有已部署可用的 credential-separated exact-OID executor。冻结基线中的
`scripts/run_rc1_release_acceptance.mjs`（blob `c6307c6686c768bb3977c5340ff58e519b824083`，raw
`sha256:9731695663de08fd4bb65ee2f02d36ed85b3d1355cc54e263a94b2c506946c07`）仅作为 root supervisor、真实
UID drop、PID/mount 隔离与 frozen tree 模式 donor；不得继承其 RC、approval、authority 或通过身份。

目标是 execution-only broker：root-owned、socket-activated、每连接一个 systemd service 实例。它先在 root
supervisor 中验证一个仅含指定 lineage commits 与 tree closure 的 sealed Git snapshot pack，再将 gate 降权到
独立 no-login/no-home 真实宿主 UID/GID，在私有 mount/PID/network namespace 中执行，只返回 typed receipt。
唯一 `product-authority.m0.v1` 仍独自捕获 lineage、校验 receipt 并映射最终 PASS/STOP。

## Acceptance Criteria

- [x] 实时 `origin/ext-dev` 与本地 base 精确为 `91254aa… / e3ae0ff…`。
- [x] 现有仓库、systemd、Docker、CI 与 remote 均没有已部署可用 executor。
- [x] predecessor 身份与拒绝 disposition 精确冻结，禁止重试、继承或 re-anchor。
- [ ] exact4 精确增加 broker、broker tests、socket unit、service unit，结构为 `4 ADD / ALL 100644`。
- [ ] broker 只返回 execution receipt，不返回 PASS/STOP，不读取 approval 或远端。
- [ ] snapshot pack、commit/tree closure、runtime profile、nonce、gate、环境、输出与 infrastructure 状态完整绑定。
- [ ] controller sibling 无法经 `/proc` 写 worker candidate、Git objects、work/tmp 或其后代 namespace。
- [ ] 网络、路径、资源、输出、timeout、crash、并发、后代清理和协议分叉负测全部 fail closed。
- [x] 独立 Governance、Python、Security Review 均为 `GO / P0–P2=0`。
- [ ] 管理员安装 exact committed bytes 并完成 installed acceptance 后，才可新签 forward-only exact2。

## Delivery Constraints

- 当前阶段只允许本三文件治理草案；不创建 exact4 字节，不安装 unit，不修改 `/opt`、`/etc`、`/run`、
  用户、组、sudoers、Docker、CI 或 Gitee 设置。
- future candidatePaths 精确四条 `ADD / 100644`；第五路径或修改现有 authority 立即 STOP。
- controller 不得获得 sudo、root shell、worker impersonation、unit management、transient-unit、Docker socket或
  修改 broker/runtime profile 的能力。
- 安装必须由独立管理员从 exact committed bytes byte-for-byte 复制并冻结 root-owned broker 与 units。runtime
  profile 不是 exact4 committed byte，必须先形成独立、可复算的 profile manifest 与 Owner/Admin freeze checkpoint；
  用户 worktree、用户 cache、用户 `/tmp` 不能成为 service 事实源。
- 不使用通用 `nobody`。worker 必须为无登录、无 home、无附加组的专用真实宿主 UID/GID。
- 每 job 串行、fresh namespace/fresh tmp、独立 cgroup；上一实例未 inactive 不接受下一连接。
- 不访问客户数据、生产凭据或外网；不部署产品。

## Affected Modules

- 模块：Product Authority credential-separated execution transport prerequisite
- 允许路径：`scripts/reference/chaotang-product-verifier-broker.py`；`scripts/reference/test_chaotang_product_verifier_broker.py`；`deploy/systemd/chaotang-product-verifier.socket`；`deploy/systemd/chaotang-product-verifier@.service`

后续 exact2 必须基于届时最新 ext-dev 新签独立 successor，且仍只允许
`scripts/product-authority.mjs` 与 `scripts/product-authority.test.mjs`。旧 exact2 不得恢复。

## Technical Plan

### 1. 固定 wire protocol

- request magic 为 8 bytes `CTPV1\0\0\0`，随后 uint32 big-endian header length、RFC 8785 canonical UTF-8
  strict JSON header、uint64 big-endian snapshot-pack length、exact pack bytes、client `SHUT_WR` 与 EOF。
- response magic 为 8 bytes `CTPR1\0\0\0`，随后 uint32 big-endian JSON length、canonical UTF-8 receipt、EOF。
- header 最大 `1048576` bytes；snapshot pack 最大 `268435456` bytes；response 最大 `25165824` bytes；request
  setup deadline `30s`。多帧、trailing bytes、提前 EOF、未知/重复 key、非法 UTF-8 或长度不符均 fail closed。
- header key/type 精确为：`schemaVersion:string`（固定 `chaotang-product-verifier-request.v1`）、
  `nonce:string`（`^[0-9a-f]{64}$`）、`requestDigest:string`、`candidateCommit:string`、
  `candidateTree:string`、`approvalCommit:string`、`baseCommit:string`（Git SHA-1 均 `^[0-9a-f]{40}$`）、
  `snapshotIdentityDigest:string`、`snapshotPackSha256:string`、`snapshotPackBytes:integer`、
  `runtimeProfileId:string`（`^[a-z0-9][a-z0-9._-]{0,127}$`）、`runtimeProfileDigest:string`、
  `installationManifestDigest:string`、`gateId:string`（同 profile ID grammar）、`tool:string`、`args:string[]`、
  `argsDigest:string`、`cwd:string`、`workspaceMode:string`、`environment:object`、`environmentDigest:string`、
  `timeoutMs:integer`。所有 digest 为 `sha256:<64 lowercase hex>`；字符串禁止 NUL/control。
- `requestDigest = SHA256("chaotang-product-verifier-request-v1\0" || RFC8785(header without requestDigest))`；
  `argsDigest = SHA256("chaotang-product-verifier-args-v1\0" || RFC8785(args))`；`environmentDigest` 使用同样的
  `chaotang-product-verifier-environment-v1\0` domain。跨 Python/Node golden vectors 必须在同一 test 文件冻结。
- header 完整认证后才可返回 full execution receipt。bad magic、非法长度/JSON、提前 EOF 等 pre-auth failure 只可
  返回 `{schemaVersion:"chaotang-product-verifier-protocol-error.v1",kind:"PROTOCOL_ERROR",infrastructureCode}`
  或直接 EOF；disconnect 时必须杀 worker并“尝试”发送，不能声称 receipt 必然送达。future exact2 将 EOF/最小
  error统一映射为 transport STOP。两类响应都必须有 Python/Node golden vectors。

### 2. Sealed snapshot pack 与确定性物化

- controller 未来只发送 candidate、approval、base 三个指定 commit objects 与三者 tree closures 的标准 Git pack；
  不发送完整历史，不发送 host path。root supervisor 将 pack 写入 anonymous memfd，施加并精确验证
  `F_SEAL_GROW|F_SEAL_SHRINK|F_SEAL_WRITE|F_SEAL_SEAL`，随后所有 digest/import 只经同一 sealed FD。
- root supervisor 只做 framing、hard length、memfd sealing 与 digest；禁止 root 对 controller pack 调用 Git。
  所有 `index-pack/fsck/rev/tree/cat-file` 必须在独立 no-login/no-home ingest UID/GID 下执行：清 groups/caps、
  `NO_NEW_PRIVS`、private mount/PID/network namespace、closed seccomp、cgroup/rlimit。ingest 使用 fresh object store，
  absolute Git、空 HOME/config/template、禁 hooks/replace/filter。pack 对象集合必须精确等于三个允许 commit
  objects 与递归 tree/blob closure，不能多一个对象或 duplicate-object ambiguity。
- candidate 必须 `parentCount==1 && parent==approval`；approval 必须
  `parentCount==1 && parent==base`。额外 first/second parent、octopus merge、缺失 parent object均拒绝。
- ingest 退出后，root 通过预持有的 `O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC` dirfd，复算 materialized records 与
  request 中 `snapshotIdentityDigest`，并以最小 bounded commit-object parser复算 commit OID、tree与精确 parents；
  root 不解析 pack。确认无 mount/FD残留后才 chown/freeze snapshot root-owned read-only。
- 物化使用 byte-safe `ls-tree -rz` 与 blob OID `cat-file blob`。路径必须是 NFC UTF-8、无 ASCII control/DEL、
  NUL、反斜线、绝对路径、空/`.`/`..` 或任一 case-folded `.git` component；path ≤4096 bytes，component
  ≤255 bytes。以 root dirfd、`O_NOFOLLOW|O_EXCL` 逐组件创建；只允许 `100644/100755` regular blobs。
- snapshot identity records 为 `{path,mode,bytes,blobOid,rawSha256}`，按 path UTF-8 bytes 排序，使用
  `SHA256("chaotang-product-verifier-snapshot-v1\0" || RFC8785(records))`。

### 3. Runtime profile 与 writable workspace

- worker 与 privileged runtime profile 均采用同一 hermetic rootfs closed schema。安装前必须生成 strict
  canonical manifest，字段精确为 `{schemaVersion,profileId,profileRole,sourceProvenance,records,profileDigest}`，
  `schemaVersion` 固定 `chaotang-product-verifier-runtime-profile.v1`，`profileRole` 只能为
  `PRIVILEGED_SUPERVISOR_INGEST` 或 `UNPRIVILEGED_GATE`，未知/重复字段拒绝；file record 为
  `{path,type:"file",uid:0,gid:0,mode,nlink:1,bytes,rawSha256}`，directory record 为
  `{path,type:"directory",uid:0,gid:0,mode,nlink}`；按 path UTF-8 bytes 排序。只允许 regular file/directory，禁止
  symlink、hardlink、device、socket、FIFO、ACL、xattr、file capability与 group/world writable；record 未知字段
  拒绝，所有 integer 为非负安全整数。`profileDigest =
  SHA256("chaotang-product-verifier-runtime-profile-v1\0"
  || RFC8785(manifest without profileDigest))`。Owner/Admin 必须先确认 profileId、profileDigest、records bundle、
  source provenance、目录 parent-chain身份和独立复算证据。`PRIVILEGED_SUPERVISOR_INGEST` 唯一安装根固定为
  `/var/lib/chaotang-product-verifier/privileged-runtime`；`UNPRIVILEGED_GATE` 安装根固定为
  `/var/lib/chaotang-product-verifier/runtime-profiles/<profileId>`。二者均为 `manifest.json` + `rootfs/` sibling，
  禁止 symlink/hardlink映射。future exact2/P14 必须精确冻结 gate profileId/digest。
- privileged profile rootfs 必须闭包 systemd `ExecStart` 使用的 Python interpreter/stdlib、Git、bwrap、loader/libs
  与全部 root/ingest descendants。service 固定从
  `RootDirectory=/var/lib/chaotang-product-verifier/privileged-runtime/rootfs` 内的
  `/runtime/bin/python3 -I -B` 启动 broker。service 的最小只读投影精确为：
  `/opt/chaotang-product-verifier`→同路径、installation manifest→`/run/chaotang-installation/installation.json`、
  两个 installed unit→`/run/chaotang-installation/{socket.unit,service.unit}`、privileged profile manifest→
  `/run/chaotang-installation/privileged-profile.json`、gate profile parent→`/profiles`。除这些 source:destination
  binds 不得暴露其他宿主 `/etc`、`/var/lib` 或 `/run`。broker 只调用同一 rootfs 内 absolute Git/bwrap；
  installation manifest 精确绑定 privileged profile ID/digest 与每个 host/projected path pair。
- gate profile rootfs 必须闭包 pinned Node、npm CLI、Python、wheelhouse/site packages、npm offline cache/dependency inputs、
  `/bin/sh`、dynamic loader/libs与所有 descendant executables；broker 通过 held root dirfd 前后 lstat整个 parent
  chain并核对 owner/mode/inode/nlink/digest。profile 中的 `rootfs/` 作为 worker `/`，不得投影 host `/usr`。
  不得直接挂载当前用户的 `/home/ubuntu/.npm/_cacache` 或 `/var/tmp/chaotang-m0-wheelhouse`。
- `workspaceMode` 只能为 `READ_ONLY_CANDIDATE` 或 `COPY_TO_WORK`。后者由 root 在降权前从已复核 snapshot
  dirfd复制到 `/work/candidate`，复算并绑定 `workspaceInitialIdentityDigest==snapshotIdentityDigest`，worker 从
  `/work/candidate`执行；前者只从只读 `/candidate`执行。npm install/build 必须使用 `COPY_TO_WORK`。broker
  自身永远以 `shell=False`
  启动 exact tool；npm 后代如需 `/bin/sh`，只能使用 runtime profile 内 pinned shell。
- environment 是固定 canonical map：`CI=1`、`NODE_ENV=test`、`PYTHONDONTWRITEBYTECODE=1`、`NO_COLOR=1`、
  `HOME=/nonexistent`、`TMPDIR=/tmp`、`TEMP=/tmp`、`TMP=/tmp`、`PATH=/runtime/bin`、`LC_ALL=C.UTF-8`、
  `LANG=C.UTF-8`、`GIT_CONFIG_NOSYSTEM=1`、`GIT_CONFIG_GLOBAL=/dev/null`。前四项保持现有 Product Authority gate
  语义，其余为隔离叠加；任何 manifest/user override 均拒绝并由回归测试证明 descriptor 语义未改变。

### 4. Credential、namespace、network 与 systemd

- broker 与同一 exact4 test blob 分别安装为 root:root `0555/0444`；socket parent root:root `0755`，socket
  root:`chaotang-verifier-controller` `0660`。管理员还须冻结 canonical installation manifest，绑定 broker/test/unit
  raw+blob、controller/ingest/worker UID/GID、socket路径、privileged profile与 gate profile identities；
  Owner/Admin确认该 digest后安装。
- installation manifest 固定为 root:root `0444`、nlink=1 的
  `/etc/chaotang-product-verifier/installation.json`，closed shape 精确为
  `{schemaVersion,exact4Commit,exact4Tree,files,identities,socket,privilegedProfile,gateProfiles,digest}`。
  `schemaVersion` 固定 `chaotang-product-verifier-installation.v1`；`files` 精确包含 broker、test、socket unit、
  service unit，每条为 `{role,hostPath,projectedPath,uid:0,gid:0,mode,nlink:1,bytes,rawSha256,gitBlobOid}`；
  `identities` 精确包含
  controller/ingest/worker UID/GID integers；profile binding 为
  `{profileId,profileDigest,hostManifestPath,hostRootPath,projectedManifestPath,projectedRootPath}`；
  未知/重复字段拒绝。digest 排除自身后使用 installation domain + RFC 8785。
- manifest parent chain、manifest、files与 profile roots均以 root dirfd、`O_NOFOLLOW|O_CLOEXEC` 打开并复核
  owner/mode/inode/nlink；任何 symlink、hardlink或可写 parent拒绝。broker 在读取 request或解析 pack前复算本地
  manifest digest，核对 request 的 installation digest，并逐一复算实际 broker/test/unit/profile identities；任一
  漂移立即 fail closed。receipt 绑定该“已复算实际值”，不能只回显 request。
- broker 在接收重型 pack前以 `SO_PEERCRED` 精确匹配 installation manifest 的 controller UID/GID。future exact2
  同一连接内使用 isolated client核验 socket `lstat` 与 server UID=0；receipt 记录 peer UID/GID/PID。
- service root supervisor 只做协议/seal/profile/snapshot复核和 namespace setup。ingest 与 worker 均按
  `setgroups([]) → setresgid → setresuid → NO_NEW_PRIVS`，父进程在释放 exec barrier 前从宿主
  `/proc/<pid>/status` 精确核对 Uid/Gid/Groups/CapInh/CapPrm/CapEff/CapBnd/CapAmb/NoNewPrivs。
- accepted socket、原 memfd、object/profile/root dirfd 全部 `CLOEXEC`。ingest fork后、exec前只把同一 sealed memfd
  `dup3` 到固定 FD 3 并明确清除该副本的 `CLOEXEC`；ingest allowlist 精确为 fd0 `/dev/null`、fd1 stdout pipe、
  fd2 stderr pipe、fd3 sealed pack、fd4 sync barrier，其余 `close_range`。ingest exec 后先对 fd3 重做
  `F_GET_SEALS`、pack length/SHA和request identity复核；root 与 ingest 的 digest 都必须循环 `pread`，不得依赖或
  改变 shared open-file-description offset。交给 absolute Git child stdin 前必须
  `lseek(fd3,0,SEEK_SET)` 再 `dup2`；测试覆盖 root 已停在 EOF、ingest hash后 offset在 EOF 两种状态。禁止
  mutable path fallback。worker allowlist仅 fd0 `/dev/null`、fd1/2 output pipes、fd3 sync barrier，永不继承
  pack/socket/root dirfd。closed seccomp 禁止 `unshare/setns/mount/umount2/pivot_root/
  fsopen/fsconfig/fsmount/move_mount/open_tree/mount_setattr/bpf/perf_event_open/ptrace/keyctl/add_key/request_key`；
  `clone` 仅允许不含任何 `CLONE_NEW*`、`CLONE_PTRACE` 或 `CLONE_UNTRACED` flags，`clone3` 一律拒绝并允许 runtime
  fallback 到受参数过滤的 `clone`。ingest 与 worker 使用同一机械 syscall合同；installed acceptance 必须真实探测
  新旧 mount API、clone/clone3 namespace flags。unit 必须 `PrivateMounts=yes` 与每实例 RuntimeDirectory。
- bwrap 必须包含真实宿主 credential drop、`--unshare-pid --unshare-net`、私有 mount、`/proc`、最小 `/dev` 与
  `--die-with-parent`。`--unshare-net` 必须关闭 abstract AF_UNIX；测试机械证明。
- unit capability allowlist 精确为 `CAP_CHOWN CAP_DAC_OVERRIDE CAP_FOWNER CAP_KILL CAP_SETGID CAP_SETUID CAP_SYS_ADMIN`；
  AmbientCapabilities 为空。固定 `KillMode=control-group`、`MemoryMax=10G`、`MemorySwapMax=0`、`TasksMax=1024`、
  `CPUQuota=800%`、`LimitNOFILE=4096`、`LimitFSIZE=10G`、`RuntimeMaxSec=675`、`TimeoutStopSec=15`、`UMask=0077`、
  `PrivateDevices=yes`、`ProtectHome=yes`、`ProtectSystem=strict`、`ProtectKernelTunables=yes`、
  `ProtectKernelModules=yes`、`ProtectKernelLogs=yes`、`ProtectControlGroups=yes`、`LockPersonality=yes`、
  `RestrictRealtime=yes`、`RestrictSUIDSGID=yes`、`RestrictAddressFamilies=AF_UNIX`、`IPAddressDeny=any`。
- socket 固定 `Backlog=1`、`TriggerLimitIntervalSec=60`、`TriggerLimitBurst=4`；service 固定
  `StartLimitIntervalSec=60`、`StartLimitBurst=4`。因为仅允许一个 controller UID/GID，该全局限制也是单 peer
  冷却；broker 内部超限返回 `BROKER_RATE_LIMITED`，systemd 在接受前拒绝则 future exact2映射 transport STOP。

### 5. Hard limits 与 receipt

- pack ≤256MiB；object count ≤25000；unpacked objects ≤768MiB；tree entries ≤10000；single blob ≤64MiB；
  materialized source ≤512MiB；runtime profile ≤3GiB；private `/work`+`/tmp` tmpfs ≤6GiB；args ≤128，单 arg
  ≤262144 bytes、总 args ≤786432 bytes；gate timeout `1000..600000ms`；stdout/stderr 各 ≤8MiB。
- 任一限额、timeout、disconnect、signal 或输出超限必须杀整个 ingest/worker namespace和service cgroup；完整
  request仍连通时返回 infrastructure receipt，pre-auth/断连只尝试返回并由 exact2 fail closed；不得截断后伪装成功。
- service 总预算精确为 setup `30s` + gate `600s` + receipt/cleanup `30s` + safety margin `15s` = `675s`；
  任一阶段不得借用下一阶段预算。
- receipt 精确绑定 schema、nonce/request digest、commit/tree/lineage、snapshot pack digest、snapshot identity、
  runtime profile、installation manifest、environment、gate/tool/args/cwd/workspaceMode/executionRoot/
  workspaceInitialIdentityDigest/timeout、peer/ingest/worker/service identity、monotonic timestamps、
  `{exitKind,exitCode,signal,timedOut,infrastructureCode}` 与 stdout/stderr `{encoding:"base64",bytes,sha256,data}`。
  broker 不返回 PASS/STOP。replay/cross-gate/cross-commit substitution 由未来 exact2 负测并拒绝。
- broker 在发送 receipt 前证明 worker namespace init 已退出且 cgroup 只剩 supervisor。response→EOF 后 supervisor
  退出；systemd 在 unit `inactive` 前 kill 整个 control group；socket 只能在 inactive 后接受下一实例。

## Verification Matrix

future exact4 在 commit/push 前必须运行 pre-install static matrix：

```bash
python3 -m unittest scripts/reference/test_chaotang_product_verifier_broker.py
systemd-analyze verify deploy/systemd/chaotang-product-verifier.socket deploy/systemd/chaotang-product-verifier@.service
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node scripts/harness-doctor.mjs --check
node --test scripts/harness-doctor.test.mjs
node scripts/ext-full-value-convergence.mjs --check
node --test scripts/ext-full-value-convergence.test.mjs
git diff --check HEAD^ HEAD
```

普通 unittest 冻结协议/golden vectors、pack closure/path/limits/receipt/unit 静态合同。它不声称真实凭据边界通过。
exact4 commit/push 与 runtime profile 独立冻结后，管理员安装阶段必须另行运行 post-install real-host matrix：

```bash
systemd-run --wait --pipe --collect --unit=chaotang-product-verifier-acceptance --property=RootDirectory=/var/lib/chaotang-product-verifier/runtime-profiles/<profileId>/rootfs --property=MountAPIVFS=yes --property=BindReadOnlyPaths=/opt/chaotang-product-verifier --property=BindReadOnlyPaths=/run/chaotang-product-verifier:/run/chaotang-product-verifier --property=BindReadOnlyPaths=/etc/chaotang-product-verifier:/run/chaotang-installation/config --property=BindReadOnlyPaths=/etc/systemd/system/chaotang-product-verifier.socket:/run/chaotang-installation/socket.unit --property=BindReadOnlyPaths=/etc/systemd/system/chaotang-product-verifier@.service:/run/chaotang-installation/service.unit --property=BindReadOnlyPaths=/var/lib/chaotang-product-verifier/privileged-runtime/manifest.json:/run/chaotang-installation/privileged-profile.json /runtime/bin/python3 -I -B /opt/chaotang-product-verifier/test_chaotang_product_verifier_broker.py --installed-acceptance --socket /run/chaotang-product-verifier/verifier.sock
```

该 transient unit 只能由独立管理员创建；`RootDirectory` 保证 pinned loader/libs 生效，bind 仅投影 socket parent
与只读 installation evidence。test byte 必须与 exact4 commit blob/raw 一致且 root-owned read-only；不能从
worktree运行。root test orchestrator 本身不得连接 broker；它必须从 installation manifest读取 numeric
controller UID/GID，按 `setgroups([])→setresgid→setresuid→NO_NEW_PRIVS` 产生 child，由 parent经 `/proc/status`
复核后只有该 child连接；root/ingest/worker/其他 UID 连接必须拒绝。该模式输出 typed JSON，记录
test/broker/unit/profile/installation identities，
覆盖 `/proc` 双向隔离、socket/pack/root-FD泄漏、closed syscalls、abstract AF_UNIX、runtime profile、输出/资源/
timeout、crash/setsid/double-fork、receipt→EOF→inactive→下一连接顺序。
若没有管理员 installed environment，只能报 `ENVIRONMENT_PREREQUISITE_UNAVAILABLE`；这不阻止 exact4 reference
commit/push，但严格阻止管理员验收、exact2 与 P14 后续阶段。

## Owner And Authority Checkpoints

1. 本三文件 strict/schema/Harness/三审与 canonical/raw/bundle 冻结后，Owner 单独确认治理 digest；随后只允许一次
   三文件本地 approval commit，回报 SHA/tree/direct parent，再由 Owner 单独授权普通 fast-forward push。
2. exact4 只在该治理落地后 TDD。未提交四文件必须冻结 raw/prospective blob/mode/bytes/bundle/diff、pre-install
   static matrix与三审；
   Owner 只授权一次本地 candidate commit。提交后复核 direct parent、SHA/tree、提交内身份、重跑适用矩阵与三审，
   Owner 再单独授权普通 fast-forward push。
3. 管理员安装不是仓库 push 的隐含授权。必须先按 canonical runtime profile manifest 独立冻结并确认
   profileId/digest/records/source provenance，再由 Owner/管理员按 exact4 commit、raw SHA 与 profile identity另行批准
   system state 变更，安装后完成 post-install real-host matrix。
4. installed acceptance 通过后，只能基于届时最新 ext-dev 新签 forward-only exact2；exact2 的治理、authority、
   candidate commit/push分别走独立 checkpoint。exact2 落地后 P14 也必须重新签发，旧 P14 字节只作 donor。

## Implementation Report

已完成：实时基线、现有 executor/CI/container/systemd 审计、same-UID `/proc` 根因、P15 donor 精确身份、
predecessor 拒绝身份、exact4 最窄四路径设计、strict JSON/重复键、`productTaskErrors=[]`、完整 Harness 146 PASS，
以及最终 Governance/Python/Security 三审 `GO / P0=0 / P1=0 / P2=0 / P3=0`。

未完成：本治理 approval commit/push、exact4 产品字节、管理员安装/真实验收、全新 exact2、全新 P14。

当前结果：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`。

## Acceptance Review

最终 Governance Review、Python Design Review 与 Security Review 均为 `GO / P0–P3=0`。这只批准治理冻结，
不授权 exact4、安装、exact2、P14、commit、push、Pilot、Release或部署。任何第五路径、第二 authority、
controller 管理 broker、root解析 untrusted pack或执行 candidate、真实 credential/network/proc/cleanup 证明不足，
仍须 fail closed。

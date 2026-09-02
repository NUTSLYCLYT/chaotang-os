# Product Authority Credential-Separated Executor Prerequisite Successor Plan

任务：`PRODUCT-AUTHORITY-CREDENTIAL-SEPARATED-EXECUTOR-PREREQUISITE-SUCCESSOR-20260902`

基线：`91254aa014c23661959ce3a8515b43742ebf3b7e`

基线 tree：`e3ae0ff085825444ffb7796ac731c7b3591a4e98`

状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## 1. Objective

为唯一 `product-authority.m0.v1` 增加管理员独立安装、使用不同真实宿主凭据执行 gate、仅返回 typed
evidence 的 execution broker prerequisite。broker 不成为第二 authority。环境边界闭合后，另行新签 exact2 和
P14 exact30；本包不安装、不提交、不推送、不部署。

## 2. Frozen Facts And Predecessor

- 实时 `origin/ext-dev` 与本地 base 为 `91254aa… / e3ae0ff…`。
- same-UID 设计无法阻断 controller 经宿主 `/proc/<pid>/root` 写 worker private tmp。
- 前一三文件包的 Task/Packet/Plan raw 分别为 `860ae3f…`、`1de24b…`、`004b265…`，Packet canonical
  `69ccc2f…`，bundle `b7f31a…`；disposition 为
  `ABANDONED_UNCONSUMED / NO_RETRY / NO_AUTHORITY_INHERITANCE / BYTE_DONOR_ONLY / NO_REANCHOR`。
- 当前宿主无 verifier user、root broker/socket、VM runner、required check 或 remote executor。
- 唯一当前基线 donor 是 `scripts/run_rc1_release_acceptance.mjs`：blob `c6307c6…`，raw `9731695…`；只复用
  root supervisor、real UID drop、PID/mount isolation 与 frozen tree 模式，不继承 RC/authority 身份。

## 3. Governance Scope

approvalCommitPaths 精确为本轮 Task、Packet、Plan。future candidatePaths 精确为：

1. `scripts/reference/chaotang-product-verifier-broker.py`
2. `scripts/reference/test_chaotang_product-verifier_broker.py`
3. `deploy/systemd/chaotang-product-verifier.socket`
4. `deploy/systemd/chaotang-product-verifier@.service`

结构 `4 ADD / ALL 100644`。不修改现有 Product Authority、P14、Harness、schema 或 system state。

## 4. Phase A — Freeze Governance

1. strict JSON、重复键、Task contract、路径、模式、差异与完整 Harness。
2. 计算 Packet RFC 8785 canonical digest、三文件 raw SHA 与 bundle digest。
3. 独立 Governance、Python Design、Security Review；任一 P0–P2 立即 STOP。
4. Owner 确认精确 digest 后，才允许一次本地三文件 approval commit；回报 SHA/tree/direct parent 后，再由
   Owner 单独授权普通 fast-forward push。

## 5. Phase B — Exact4 TDD And Freeze

RED 覆盖：无 broker；same-UID `/proc` 写；snapshot pack 多/少对象、错误 lineage、路径逃逸；协议分帧与 digest
分叉；mutable runtime/cache；abstract AF_UNIX；资源/输出/timeout；并发与 cgroup/后代生命周期。

GREEN 只能在 exact4 中实现：

- `CTPV1`/`CTPR1` big-endian framed protocol、RFC 8785 request/receipt与 cross-language golden vectors；
- root 只 framing/限长/seal；独立 ingest UID 在 no-network/cgroup/rlimit/seccomp 内解析 snapshot pack。pack只含
  candidate/approval/base 三个单亲 commit 和 tree closures；ingest 退出后 root 通过 held dirfd、snapshot digest 与
  bounded commit parser复核，root 不对 untrusted pack调用 Git；
- 同一 closed schema 的 privileged supervisor-ingest profile 与 unprivileged gate profile、canonical installation
  manifest、read-only candidate/runtime、闭合
  `READ_ONLY_CANDIDATE`/`COPY_TO_WORK` 与 private writable work/tmp；
- exact controller/ingest/worker identities、SO_PEERCRED、drop顺序、FD allowlist、closed seccomp、private
  PID/mount/network namespace与 `--unshare-net`；seccomp封闭新旧 mount API，按参数拒绝 `clone(CLONE_NEW*)`并
  拒绝 `clone3`；
- ingest 仅在固定 FD 3 继承同一 sealed-pack副本，exec后重验 seals/length/SHA/request identity并以该 FD作为
  Git stdin；root/ingest hash循环使用 `pread`，Git前强制 `lseek(0)`，并负测共享 offset 已在 EOF；worker永不
  继承 pack/socket/root FD。两者分别执行 close_range allowlist。
- 精确 capability allowlist、systemd limits、pack/object/tree/blob/profile/work/output/time hard limits；
- typed receipt 与 worker→receipt→EOF→inactive→next-connection lifecycle。

同一 test 文件必须同时提供普通 unittest 和 `--installed-acceptance`。四文件未提交身份、pre-install static matrix
与三审冻结后，
Owner 才授权一次 local candidate commit；post-commit direct parent/SHA/tree/身份、矩阵与三审确认后，Owner 才授权
普通 fast-forward push。需要第五路径立即 STOP。

## 6. Phase C — Administrator Installation

仓库 push 不授权系统变更。独立管理员须按 exact commit/raw SHA 另行获批并执行：

1. root:root `0555/0444` 安装 broker与同一 exact4 test blob；root-owned 安装 socket/service；创建 controller group
   与彼此不同的 no-login/no-home ingest/worker identities。
2. 两种 profile 共用 exact closed manifest
   `{schemaVersion,profileId,profileRole,sourceProvenance,records,profileDigest}`。file record 精确为
   `{path,type:"file",uid:0,gid:0,mode,nlink:1,bytes,rawSha256}`；directory record 精确为
   `{path,type:"directory",uid:0,gid:0,mode,nlink}`；未知/重复字段拒绝，按 path UTF-8 bytes排序，digest 排除
   `profileDigest` 后使用 domain-separated RFC 8785。privileged profile 闭包 broker Python/stdlib、Git、bwrap与
   loader/libs；gate profile闭包 Node/npm/Python/shell/dependencies。Owner/Admin确认两者 ID/digest/records/source
   provenance与独立复算证据，再安装 root-owned read-only profiles；不能直接挂载用户 cache/wheelhouse。
   privileged profile 唯一根为 `/var/lib/chaotang-product-verifier/privileged-runtime`，gate profile根为
   `/var/lib/chaotang-product-verifier/runtime-profiles/<profileId>`，均为 `manifest.json` 与 `rootfs/` sibling。
3. 冻结 canonical installation manifest：exact4 commit、broker/test/unit blob+raw、controller/ingest/worker UID/GID、
   socket identity、privileged profile与gate profile identities；Owner/Admin确认 digest 后方可安装。systemd
   `RootDirectory` 和 root/ingest Git/bwrap只能使用 privileged profile absolute paths。
   manifest 固定为 root:root `0444`、nlink=1 的 `/etc/chaotang-product-verifier/installation.json`，closed shape为
   `{schemaVersion,exact4Commit,exact4Tree,files,identities,socket,privilegedProfile,gateProfiles,digest}`；file record为
   `{role,hostPath,projectedPath,uid:0,gid:0,mode,nlink:1,bytes,rawSha256,gitBlobOid}`，identity/profile/socket 使用
   Task/Packet精确
   variants，未知/重复字段拒绝。broker在接收 request前以 root dirfd/O_NOFOLLOW复算 manifest、parent chain、
   broker/test/unit/profile实际身份并比较 request digest；receipt只绑定复算实际值。
   service RootDirectory内只读投影 exact `/opt`、installation manifest、两 unit、privileged profile manifest与
   gate profile parent到固定 in-root paths；禁止暴露其他宿主 `/etc`、`/var/lib`、`/run`。
4. controller 只获 socket connect，不获 sudo、unit、worker、Docker、`/opt` 或 runtime profile 写权。
5. 核对 effective unit properties、capabilities、FD/syscall边界、Trigger/Start limits、资源上限、socket owner/mode
   与安装 SHA。
6. 由管理员使用 `systemd-run` 的 gate-profile `RootDirectory`、最小只读 socket/evidence binds、root-owned exact
   test blob及 pinned Python运行 `--installed-acceptance`，保证 loader/libs来自 profile且宿主 socket可见。root
   orchestrator只按 installation manifest产生并核验已降到 exact controller UID/GID 的 child，由 child连接；
   root/ingest/worker/other UID连接必须拒绝。覆盖真实 `/proc`、
   socket/pack/root-FD泄漏、closed syscalls、abstract AF_UNIX、反向 secrets/path、pack/protocol、资源、
   timeout/crash/setsid/double-fork 与 receipt→EOF→inactive→next 顺序。

无法得到 typed installed evidence 时状态保持 `ENVIRONMENT_PREREQUISITE_UNAVAILABLE`。

## 7. Phase D — Brand-New Exact2

installed acceptance 通过后，基于届时最新 ext-dev 新签 forward-only successor，只允许：

1. `scripts/product-authority.mjs`
2. `scripts/product-authority.test.mjs`

future exact2 生成三-commit单亲 snapshot pack与 expected snapshot digest、核验 socket inode/root `SO_PEERCRED`、
发送 canonical request、在同一连接
消费 receipt、拒绝 replay/cross-gate/cross-commit/cross-runtime substitution，再由唯一 authority 独立裁决。
旧 exact2 不得恢复、重试或继承。

exact2 必须保留现有 `CI=1`、`NODE_ENV=test`、`PYTHONDONTWRITEBYTECODE=1`、`NO_COLOR=1` gate 环境语义，再叠加
固定 HOME/TMP/PATH/locale/Git隔离键；完整 environment map/digest 与 descriptor 回归证明纯 transport 变更。

## 8. Phase E — Reissue P14 And RC

exact2 落地后，所有旧 P14 exact30 字节仍仅作 donor。基于届时最新 ext-dev 新签 P14，依序执行 machine
authority、byte-for-byte 重物化、完整矩阵、Governance/Python/Security 三审、machine verify-candidate 与普通
fast-forward。完成后只形成可回滚 RC，不部署生产。

## 9. Fixed Limits And Verification

- wire：header 1MiB、pack 256MiB、response 24MiB、setup 30s；pre-auth仅最小 protocol error/EOF，完整认证后才有
  full receipt；stdout/stderr 各 8MiB。
- objects：25000；unpacked 768MiB；tree entries 10000；single blob 64MiB；source 512MiB。
- runtime profile 3GiB；private work/tmp 6GiB；gate timeout 1s–600s。
- systemd：MemoryMax 10G、MemorySwapMax 0、TasksMax 1024、CPUQuota 800%、NOFILE 4096、FSIZE 10G、
  RuntimeMaxSec 675、TimeoutStopSec 15；总预算为 setup 30s + gate 600s + receipt/cleanup 30s + margin 15s；
  capabilities 精确为 CHOWN/DAC_OVERRIDE/FOWNER/KILL/SETGID/SETUID/SYS_ADMIN；Backlog 1，Trigger/Start limit均
  60s/4，PrivateMounts启用。

pre-install static matrix：unittest、`systemd-analyze verify`、Harness、Harness self-test、Doctor、Doctor tests、
V2 check/tests、diff check及三独立审查；它支撑 exact4 commit/push，但不声称真实 credential boundary 通过。
post-install real-host matrix：`--installed-acceptance`；它不能由静态 unit 检查替代，且未通过时严格阻断 exact2/P14。

## 10. Rollback

- governance/exact4 未安装时不消费 successor 即可停止；不删除历史或 donor。
- exact4 landed 未安装时无运行时副作用。
- 管理员回滚须先禁用 socket、终止并证明 unit inactive/cgroup 无 worker，再保存 evidence 后移除 installed bytes；
  不能修改 Git 历史。
- exact2 未落地前 Product Authority 持续 fail closed；禁止回退同 UID 执行。

## 11. Stop Conditions

- remote drift；第五路径；第二 authority；controller 可管理/冒充 broker；root 执行 candidate；
- worker 与 controller/supervisor 同 UID；snapshot closure/path、runtime profile、network、`/proc`、资源或生命周期
  证明不闭合；installed acceptance 不可用；任一验证失败或独立审查 P0–P2。

## 12. Current Authorization Boundary

当前只修订、校验与独立审查三文件治理草案；不创建 exact4、不安装 system state、不 commit/push、不修改
Product Authority/P14，不运行 Pilot、Release或生产部署。

本轮冻结检查：strict JSON 与重复键拒绝通过；新 Task `productTaskErrors=[]`；完整 Harness 为
`PASS / 146 BASELINE FILES`。Governance Review、Python Design Review、Security Review 均为
`GO / P0=0 / P1=0 / P2=0 / P3=0`。仓库不存在适用于 `governance-repair.packet.v1` 的正式 JSON Schema，
因此不伪造 schema 通过结论；当前结论只建立在先例闭合合同、内部一致性、Task contract 与完整 Harness 上。

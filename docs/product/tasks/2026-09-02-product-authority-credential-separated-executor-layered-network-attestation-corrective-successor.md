# Product Authority Credential-Separated Executor Layered Network and Attestation Corrective Successor

任务 ID：`PRODUCT-AUTHORITY-CREDENTIAL-SEPARATED-EXECUTOR-LAYERED-NETWORK-ATTESTATION-CORRECTIVE-SUCCESSOR-20260902`

冻结基线：`58c68a23a66071bc50edd7f567f98f814e71a29f`

冻结基线 tree：`f9895bb1d6bd1c6a929fbeb9d59881b1dc4cc7ad`

> 治理状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`
>
> 本 successor 只纠正 predecessor exact4 暴露出的网络分层、凭据证明、root capability 与全生命周期断连取消合同。
> 它不成为第二 authority，不授权安装、提交、推送、P14、Release 或生产部署。

## Status

Draft

## Product Definition

`PRODUCT-AUTHORITY-CREDENTIAL-SEPARATED-EXECUTOR-PREREQUISITE-SUCCESSOR-20260902` 已以治理提交
`58c68a23a66071bc50edd7f567f98f814e71a29f` 落在 `ext-dev`。基于该提交形成的 exact4 未提交实现完成了协议、
sealed pack、独立 ingest/worker 身份、closed runtime profile、TDD 与大量静态安全边界，但独立三审一致裁定：

- frozen `RestrictAddressFamilies=AF_UNIX` 与 `IPAddressDeny=any` 无法同时支持真实 verification gate 所需的
  private-loopback `127.0.0.1` bind/listen/connect；
- frozen “父进程直接读取宿主 `/proc/<pid>/status`”在 `ProtectProc=invisible` 下不可用，而实际实现采用
  `SCM_CREDENTIALS` 外层身份加 pre-exec child self-status 内层身份证明；
- root broker 在处理攻击者控制的 Git object graph 时仍保留 `CAP_SYS_ADMIN`；
- disconnect watchdog 未覆盖 root object decompress、graph parse 与 materialization 全阶段。

因此原 exact4 产品尝试状态固定为：

`STOP / APPROVAL_SCOPE_CONTRADICTION / NO_GO_BY_INDEPENDENT_REVIEWS / BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE / DO_NOT_COMMIT / DO_NOT_PUSH`

本 successor 采用 forward-only 方式重新签发同一 exact4 产品范围。旧四文件只作 byte donor；后续 candidate 必须从
本 successor approval 的直接子提交重新物化、重新形成 RED/GREEN、重新跑完整矩阵并重新三审。

## Acceptance Criteria

- [x] 基线精确绑定 `58c68a23… / f9895bb1…`，predecessor 三文件治理提交保留为历史证据。
- [x] stopped exact4 donor精确为四条未提交`ADD / 100644`。历史字段插入顺序`JSON.stringify` bundle为
  `sha256:388437c1a37372582189af2368e098580b50a530946d67987bcb9c1d502acd52`；同一records按RFC 8785 canonical array
  复算的canonical bundle为`sha256:d6259df26cca3c706b27671676d0b438a95cbb9203918ef0f20af173a5fa6f8e`。
- [ ] 本三文件 approval commit 必须是 `58c68a23…` 的直接单亲子，只含精确三条 `ADD / 100644`；提交前后复核
  live remote、commit、tree、parent、路径、模式、raw、Packet canonical 与三文件 bundle。
- [ ] corrected exact4 仍只含原四路径，结构保持 `4 ADD / ALL 100644`。
- [ ] supervisor 与 ingest 的 AF_INET/AF_INET6 syscall fail closed；worker 仅在 private network namespace 中使用
  loopback，并无法访问宿主 loopback、宿主 abstract AF_UNIX、外网、metadata、Docker 或生产服务。
- [ ] service-level network contract 仅允许 private-loopback 所需地址，不能把 host-network capability 赋予 broker。
- [ ] host peer identity使用kernel-authenticated socket credentials；namespace/capability identity使用逐消息
  `SCM_CREDENTIALS`与kernel procfs task/status FDs，并在父进程释放exec barrier前闭合校验。
- [ ] root broker在initial/host user namespace的effective/permitted/bounding/ambient集合均不含`CAP_SYS_ADMIN`；
  private userns bootstrap只可短暂持有namespaced capability且在untrusted exec前全部归零。
- [ ] authenticated supervisor event loop覆盖ingest、root parse/decompress、graph verification、materialization、copy、
  worker、receipt与cleanup；任一完整peer断连都清空cgroup/runtime state，合法request half-close不误杀，下一连接可用。
- [ ] exact4 static matrix、installed acceptance 与 Governance/Python/Security 三审均通过且 P0–P2 为零。
- [ ] 只有管理员另行安装并获得 typed installed evidence 后，才允许新签 exact2 与 P14。

## Delivery Constraints

- 当前阶段只允许本 Task、Packet、Plan 三文件；不修改四文件 donor，不安装 unit/runtime profile，不运行 product authority。
- future candidatePaths 精确为原四条 `ADD / 100644`；第五路径、修改现有 authority 或第二 runtime/ledger 立即 STOP。
- `product-authority.m0.v1` 仍是唯一 PASS/STOP 裁决者；broker 只返回 typed execution receipt。
- systemd 层允许 `AF_UNIX AF_INET AF_INET6` 只为 worker private loopback 提供必要 syscall family。root supervisor在读取
  攻击者输入前必须先建立并验证已进入独立private network namespace的最小launcher，再加载不可放宽的IP-deny seccomp；
  ingest作为supervisor后代继承该filter，worker只能作为private launcher后代创建。
- service 使用 `IPAddressDeny=any` 与 `IPAddressAllow=localhost`；worker 同时置于 fresh private network namespace。
  任一层单独通过都不构成网络边界通过，必须组合证明。
- root broker在initial/host user namespace中的 capability bounding set精确排除 `CAP_SYS_ADMIN`。仅允许private launcher
  在新建且精确映射的child user namespace内为namespace bootstrap短暂持有namespaced `CAP_SYS_ADMIN`，并在接触不可信代码前
  证明全部清零；不得用setuid helper、file capability、sudo、Docker、transient unit或writable runtime profile补偿。
- kernel-backed credential/capability attestation只证明身份与capability状态，不允许child自报status、lineage、digest或
  PASS/STOP。
- 安装与 real-host acceptance 必须由 Owner/Admin 另行授权；本包及后续 repository candidate 均不修改系统状态。

## Affected Modules

- 模块：Product Authority credential-separated executor layered network and attestation corrective successor
- 允许路径：`deploy/systemd/chaotang-product-verifier.socket`；`deploy/systemd/chaotang-product-verifier@.service`；`scripts/reference/chaotang-product-verifier-broker.py`；`scripts/reference/test_chaotang_product_verifier_broker.py`

## Technical Plan

### 1. Forward-only donor rematerialization

后续candidate必须基于本三文件approval commit的直接子关系，从stopped donor byte-for-byte起步，再仅在四个既有路径内
完成本包纠偏。donor raw/blob/bytes与两种明确标注算法的bundle只证明来源；后续candidate bundle必须统一使用
RFC 8785 canonical records算法。旧测试、审查、candidate或authority identity不得继承。

### 2. Layered network contract and process topology

- service unit address families 精确为 `AF_UNIX AF_INET AF_INET6`，并同时配置 `IPAddressDeny=any`、
  `IPAddressAllow=localhost`；禁止其他 family。
- broker在读取request header/pack前预打开host netns FD并fork唯一launcher。launcher立即进入fresh user+network
  namespace、初始化且只保留loopback，发送kernel netns FD与`SCM_CREDENTIALS`；supervisor必须证明该netns inode与host
  netns不同、launcher已离开host network且initial namespace capabilities清零，然后才继续。
- launcher的fd0固定`/dev/null`，fd1/2固定为有界supervisor-owned诊断pipe或`/dev/null`；另只持单一
  `SOCK_SEQPACKET` control FD、sync barrier及其private user/net namespace FDs。必须关闭accepted socket及其dup、pack、
  object、profile、candidate与其他FD，并机械复核`/proc/self/fd`。control message使用closed schema，只接受supervisor已经
  验证的profile/snapshot FD与固定execution descriptor；launcher不解析raw request/pack、不形成receipt或PASS/STOP。
- launcher同时传递userns与netns FD。supervisor对二者要求`fstatfs(NSFS_MAGIC)`，分别以`NS_GET_NSTYPE`证明
  `CLONE_NEWUSER`与`CLONE_NEWNET`；通过`NS_GET_USERNS`取得netns owner userns并比较dev/inode等于launcher userns FD，
  且二者分别不同于预打开的host user/net namespace。regular、mount、PID或错误owner namespace FD均fail closed。
- supervisor在launcher attestation完成后、读取任何攻击者输入前加载不可放宽的host-network seccomp。全部transport、
  control与attestation socket必须在filter前创建并按type/dev/inode/peer固定；filter之后拒绝`socket/socketpair`、connect、
  bind、listen、sendto、sendmmsg及其他socket creation/addressed-send API。`sendmsg/recvmsg`只允许不可关闭、不可dup且精确
  编号和身份的AF_UNIX control/attestation FD；accepted transport只使用read/write。加载前证明没有IP FD。ingest使用独立
  更严filter，拒绝全部socket API且只保留pipe/memfd；worker只能由private launcher创建。测试覆盖close+fd-reuse绕过。
- worker在private launcher namespace内再由bwrap建立fresh PID/mount/user边界；worker seccomp可允许AF_INET/AF_INET6，
  但仅与private netns、loopback-only路由和cgroup IP policy组合生效。
- installed acceptance 在启动 gate 前创建宿主 TCP listener和宿主 abstract AF_UNIX listener，证明 worker 均不可达；
  同时在 worker private namespace 内真实完成 loopback bind/listen/connect。还须证明 DNS、外网、metadata、Docker、
  宿主 Unix socket与生产服务均不可达。
- root/ingest 必须真实证明 AF_INET/AF_INET6 `socket`、bind、listen、connect fail closed，不能只静态扫描 unit文本。

### 3. ProtectProc-compatible kernel credential and procfs attestation

- controller transport固定使用`SO_PEERCRED`。ingest/worker/launcher helper attestation固定使用fresh AF_UNIX
  `SOCK_SEQPACKET`：parent先启用`SO_PASSCRED`，child在drop后只发送一次消息，必须同时携带kernel
  `SCM_CREDENTIALS`与`SCM_RIGHTS`，禁止pipe或helper-side `SO_PEERCRED`替代。
- child完成`setgroups([]) → setresgid → setresuid → PR_SET_NO_NEW_PRIVS`后、exec barrier释放前，以`O_PATH|O_DIRECTORY`
  打开自己的procfs task directory，再以dirfd-relative `O_RDONLY|O_NOFOLLOW`打开`status`，将两FD随消息传给parent。
- parent核对expected child relation、single message、closed schema与SCM host PID/UID/GID；对两FD执行`fstatfs`并要求
  `PROC_SUPER_MAGIC`，从收到的task dirfd以`openat2(RESOLVE_BENEATH|RESOLVE_NO_SYMLINKS|RESOLVE_NO_MAGICLINKS)`重开
  `status`并比较dev/inode，再解析kernel-generated Uid/Gid/Groups/CapInh/CapPrm/CapEff/CapBnd/CapAmb/NoNewPrivs与
  Pid/Tgid/NSpid。NSpid outer值必须匹配SCM PID；任何非procfs FD、自报、缺失、重复、漂移、replay或PID替换均fail closed。
- attestation FD在 barrier后关闭且不进入 gate；receipt只记录已验证结果摘要，不信任 child 的产品结论。

### 4. Capability separation

- service `CapabilityBoundingSet`只允许`CAP_CHOWN CAP_DAC_OVERRIDE CAP_FOWNER CAP_KILL CAP_SETGID CAP_SETUID`；
  `CAP_SYS_ADMIN`不得出现在initial/host user namespace的bounding/permitted/effective/inheritable/ambient集合。
- bwrap必须依赖受验证的 unprivileged user namespace路径；若宿主禁用该路径或需要 `CAP_SYS_ADMIN`，状态为
  `ENVIRONMENT_PREREQUISITE_UNAVAILABLE`，不得放宽 capability。
- private launcher/bwrap bootstrap可在fresh、精确映射且无法返回host netns的child user namespace内短暂获得namespaced
  `CAP_SYS_ADMIN`以完成mount setup；在任何不可信candidate/gate代码exec前，kernel procfs attestation必须证明
  CapInh/CapPrm/CapEff/CapBnd/CapAmb全部为零。initial namespace中的`CAP_SYS_ADMIN`始终禁止。
- 攻击者控制的 pack/object parse、decompress、graph walk和materialization不得在拥有 `CAP_SYS_ADMIN` 的进程中执行。
  root保留的 bounded parser只能在上述收窄capability集合下运行，并受对象/深度/字节/时间与取消预算限制。
- 测试必须在真实进程状态中断言 capability sets，并对恢复 `CAP_SYS_ADMIN`、file capability、setuid bit及可写 profile
  注入 fail closed。

### 5. Full-lifecycle disconnect cancellation

- root supervisor本身是唯一lifecycle event loop，不另设未定义的高权限watchdog。所有sealed ingest、root loose-object
  decompress、graph验证、materialization、copy-to-work与worker heavy stage都在supervisor用pidfd/process-group监督的
  stage child中运行；supervisor不进入不可轮询的攻击者数据循环。
- supervisor同时持authenticated socket、launcher/stage pidfd、control pipes和deadline。CTPV1正常request在exact frame后
  `SHUT_WR`产生的read EOF/`POLLRDHUP`是合法half-close，必须记录并忽略；只有完整peer close的`POLLHUP`、
  `POLLERR`、`POLLNVAL`、response write failure、deadline或launcher/stage liveness丢失才触发取消。
- stage child继承supervisor IP-deny filter，使用精确FD/capability/seccomp/rlimit；parser/materializer仍有bounded
  cancellation checkpoints。任一stage异常或control liveness丢失都fail closed。
- 成功顺序固定为：所有stage/worker退出→launcher退出→清理并复核object/work/tmp/runtime state→cgroup只剩supervisor→
  生成并发送typed receipt→response EOF→supervisor退出。清理失败不得先发送成功receipt。
- installed tests须在 parse/decompress/materialize各阶段使用同步屏障断开客户端，证明进程/cgroup/runtime directory均清空、
  无 receipt伪成功、下一连接可正常完成。
- 阶段屏障只能由root-owned installed-acceptance orchestrator通过独立继承FD启用，要求exact installed test/broker identity、
  `--installed-acceptance`模式和非生产service invocation同时成立；普通wire header/environment不能启用或选择屏障。

### 6. Verification matrix

future corrected exact4 先形成真实 RED，再 GREEN，至少覆盖：

1. pre-filter launcher先进入private netns且FD/control/liveness闭合；supervisor/ingest AF_INET/AF_INET6 socket、bind、
   listen、connect denied；worker private loopback成功；宿主 listener失败；
2. abstract AF_UNIX、DNS、external、metadata、Docker和生产 endpoints fail closed；
3. ProtectProc下helper `SCM_CREDENTIALS + SCM_RIGHTS procfs task/status FDs`精确闭合，伪造/replay/PID漂移失败；
4. initial/host namespace `CAP_SYS_ADMIN`始终为零；private userns bootstrap只在setup短暂存在并在untrusted exec前归零；
5. Python/Node线程在 clone3 `ENOSYS` fallback 后真实启动，legacy/new mount API与 namespace clone flags仍拒绝；
6. ingest、parse、decompress、graph、materialize、copy、worker、receipt各阶段断连清理及 next-connection；
7. 原 wire、sealed memfd、exact object closure、path/mode、runtime profile、FD、resource、timeout、receipt、nonce和
   lineage负向矩阵不得回退。

pre-install static matrix：broker unittest、unit parser/static contract、Harness、Harness self-test、Doctor、Doctor tests、
V2 check/tests、diff check及独立 Governance/Python/Security Review。

post-install real-host matrix：同一 frozen test blob 的 `--installed-acceptance`，验证 effective unit properties、真实 UID/GID、
真实 socket/cgroup/network/capability/ProtectProc/断连链路。静态测试不能替代 installed evidence。

## Implementation Report

本轮只冻结治理合同。stopped donor已经证明大部分 execution transport可实现，但因四项边界与 predecessor不一致而被
三审拒绝；没有exact4 candidate commit、push、安装或部署。仓库没有`governance-repair.packet.v1` machine runner，本包
不得冒充product-authority machine GO。新successor未经Owner digest确认、direct-single-parent exact-three approval
commit/push及Owner明确protected-path implementation授权前，不得重物化产品字节。

## Acceptance Review

当前结论：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`。Governance、Python与Security独立审查均为
`GO / P0=0 / P1=0 / P2=0 / P3=0`。验收只承认forward-only successor：predecessor
治理提交保留，旧 exact4 donor保持不动；任何复用必须 byte-for-byte重物化并重新验证。任一第五路径、第二 authority、
  initial/host `CAP_SYS_ADMIN`恢复、host network可达、凭据自报、合法half-close误杀、disconnect阶段缺口、验证失败或
  独立审查 P0–P2 均立即 STOP。

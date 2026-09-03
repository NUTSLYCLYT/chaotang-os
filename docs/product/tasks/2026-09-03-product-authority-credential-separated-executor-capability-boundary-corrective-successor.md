# Product Authority Credential-Separated Executor Capability Boundary Corrective Successor

任务 ID：`PRODUCT-AUTHORITY-CREDENTIAL-SEPARATED-EXECUTOR-CAPABILITY-BOUNDARY-CORRECTIVE-SUCCESSOR-20260903`

冻结基线：`0b323e26584069019662aa723d30fd763424954c`

冻结基线 tree：`68de194ad8e813ad365c0694812fde38e5f6423e`

> 治理状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`
>
> 本 successor 只纠正已落地 installed-acceptance exact3 在真实 systemd/root 验收中暴露的 capability
> boundary 合同矛盾。它不创建第二 Product Authority、不修改业务运行时、不部署生产。

## Status

Draft

## Product Definition

`0b323e26584069019662aa723d30fd763424954c` 已将
`PRODUCT-AUTHORITY-CREDENTIAL-SEPARATED-EXECUTOR-INSTALLED-ACCEPTANCE-CORRECTIVE-SUCCESSOR-20260903`
的 exact3 candidate 普通快进落到 `origin/ext-dev`。随后真实非生产 systemd/root 验收继续暴露一个
protected-boundary 级矛盾：

1. 旧 governance packet 冻结的 `serviceCapabilityBoundingMask=0xeb` 与“不得扩张 CapabilityBoundingSet”
   不能满足当前 Linux/systemd 下的两项真实安全动作：在 broker 内进入 private network namespace，以及在完成
   credential transition 前主动丢弃 bounding capability。
2. 直接把该修复作为 `0b323e…` 的普通 child 会越过旧 packet 的 `0xeb` 合同。因此本次必须 forward-only
   重签 successor，明确把 `CAP_SETPCAP`、`CAP_NET_ADMIN` 与 `CAP_SYS_ADMIN` 限定为 root supervisor 启动期
   临时能力，并要求 broker 在读取任何请求前设置 `NoNewPrivs=1`，完成网络隔离、loopback 启动、capability
   bounding drop、`setresgid/setresuid` 与 `capset(0)` 后证明最终 `Uid/Gid=target`、`Groups=empty`、
   `CapInh/CapPrm/CapEff/CapBnd/CapAmb=0`。
3. 本地 byte donor `fe409ea7add7c70bddab88fbb5a44a32e26f011b` 已在旧基线之上形成三路径诊断证据，
   但它把 `0x2011eb` privileged startup 语义扩到 `snapshot-stage` 与 `cleanup-stage`，不满足本轮
   “只限入口 root supervisor setup” 的最窄安全边界。因此该 donor 只能证明根因和提供可复用片段，不得
   byte-for-byte 继承，不得继承 candidate、通过或可推送身份。未来 candidate 必须在本 successor approval
   commit 落地后重新物化，并把 high-risk capability 精确收窄到 `--serve-stdio`。

本包的目标是让 credential-separated executor 的安装态验收闭环成为可解释、可回滚、可复验的 Release
Candidate 前置能力；不把临时 root 安装验收等同于生产部署。

## Acceptance Criteria

- [ ] approval commit 是 `0b323e26584069019662aa723d30fd763424954c` 的直接单亲子，只包含本 Task、Packet、Plan 三条新增治理路径。
- [ ] future candidate 只修改 exact3：
  `deploy/systemd/chaotang-product-verifier@.service`、
  `scripts/reference/chaotang-product-verifier-broker.py`、
  `scripts/reference/test_chaotang_product_verifier_broker.py`。
- [ ] service unit 的 `CapabilityBoundingSet` 精确变为
  `CAP_CHOWN CAP_DAC_OVERRIDE CAP_FOWNER CAP_KILL CAP_SETGID CAP_SETUID CAP_SETPCAP CAP_NET_ADMIN CAP_SYS_ADMIN`，
  十六进制 mask 为 `0x2011eb`；`AmbientCapabilities` 保持空；`NoNewPrivileges=no` 只表示 systemd 不在
  exec 前设置，broker 必须自行作为首个安全动作设置并验证 NNP。
- [ ] broker 必须在任何 attacker-controlled parse、stdin/socket read、fork/thread、helper launch 或业务
  请求处理前完成 `PR_SET_NO_NEW_PRIVS` 与 `/proc/self/status` 复核。
- [ ] 只有 `--serve-stdio` root supervisor 可短暂使用 `CAP_SYS_ADMIN` 进入 private netns、`CAP_NET_ADMIN` 启动 loopback、
  `CAP_SETPCAP` 丢弃 bounding set、`CAP_SETUID/CAP_SETGID` 切换到专用身份；这些能力不得进入 child gate
  exec，最终五类 capability set 必须全为零。
- [ ] `--snapshot-stage`、`--cleanup-stage`、`--ingest-run`、`--ingest-git-stage` 与 `--worker-launch`
  启动态不得持有 `0x2011eb`，必须按零 capability 启动或在读取 request-derived graph 前失败关闭。
- [ ] `_drop_credentials(uid,gid)` 不再使用 user namespace 模拟 host UID/GID；它必须直接清空 groups、
  setresgid/setresuid、capset(0)，并证明 parent-observed host identity 与 capability-zero 合同成立。
- [ ] `_enter_private_user_network(uid,gid)` 必须先进入 private network namespace 并启动 loopback，再丢弃
  bounding set 与 host credentials，最终同样证明 capability-zero。
- [ ] systemd 检查只在当前 rootfs/chroot 风格验收中使用进程级 `SYSTEMD_IGNORE_CHROOT=1`；不得持久修改系统配置。
- [ ] 完整验证矩阵与 Governance/Python/Security 三审均不得出现 P0–P2；candidate commit 只能在上述证据冻结后形成。
- [ ] candidate 普通快进落地后，非生产 root 安装验收必须只使用已落地主线字节；验收结束后停止全部相关 units 并保持 disabled。

## Delivery Constraints

- 本包不修改 `.harness/approvals/`、`scripts/product-authority.mjs`、socket unit、runtime profile、P14、P01、
  frontend、backend 业务 API、数据库、客户数据或生产部署配置。
- 不允许第四条 candidate path，不允许把 old `0xeb` packet 静默 re-anchor 成本轮 `0x2011eb` 语义。
- 不允许继承 `fe409e…` 的 candidate 身份；它只是 byte donor。
- 不允许 force-push、merge、rebase、fetch/pull 到主线、删除分支/worktree、清理 dirty donor 或生产部署。
- 每批主线写入只能普通 fast-forward；远端漂移、Harness STOP、独立审查 P0–P2、安装验收常驻服务未停用均立即 STOP。

## Affected Modules

- 模块：Product Authority credential-separated executor capability boundary corrective successor
- 允许路径：`deploy/systemd/chaotang-product-verifier@.service`；`scripts/reference/chaotang-product-verifier-broker.py`；`scripts/reference/test_chaotang_product_verifier_broker.py`

## Technical Plan

1. 以 `0b323e… / 68de194a…` 为唯一 base 创建三文件 governance successor；将旧 exact3 approval/candidate
   与 `fe409e…` byte donor 全部标为历史证据，不继承 authority 或 candidate 身份。
2. 在 approval commit 普通快进落地后，从该 approval commit 创建唯一隔离 candidate 工作区，仅重放 `fe409e…`
   中被本 successor 接受的片段；必须额外收窄 `snapshot-stage` 与 `cleanup-stage` 的 startup capability。
3. 重新运行 focused broker tests、systemd contract tests、完整 Harness、Harness self-test、Doctor、Doctor tests、
   hook self-test、`TMPDIR=/tmp` product-authority regression、V2 check/tests 与 `git diff --check`。
4. 使用具备本地 systemd/root 权限的非生产环境运行安装态 acceptance：写入 `/etc`、`/opt`、`/var/lib` 的文件必须
   来自已验证 candidate 字节；启动 socket/service 仅为验收；结束后全部停止并 disabled。
5. 三审只读确认临时 capability 是否被严格限制在 supervisor setup、是否在 gate exec 前归零、是否未扩大网络/文件/凭据/authority 边界。
6. 全部通过后，普通 fast-forward 推送 candidate；随后再进入 V2 前端真实浏览器链与 Release Candidate 收口。

## Implementation Report

当前为治理草案，尚未授权或物化本包 candidate。已知 donor evidence：

- donor commit：`fe409ea7add7c70bddab88fbb5a44a32e26f011b`
- donor tree：`793863094b1fa010dd0845d6702935ef32e349d6`
- donor parent：`0b323e26584069019662aa723d30fd763424954c`
- donor 结构：`3 MODIFY / ALL 100644`
- donor candidate bundle：`sha256:fba7ffa828c7d4c6623e072ec0d954dbdd0114c64313069e57cc54815619f81a`
- donor full-index diff：`sha256:57900cbe4bcdce346260b7da56714bf59f2c5154626f1712e94289124ad5f580`
- donor rejection：`NO_GO_BY_SECURITY_REVIEW / OVERBROAD_PRIVILEGED_HELPER_STARTUP`

## Acceptance Review

待 Owner/机器治理确认后进入 approval commit；本文件不声明 APPROVED、GO、candidate、Pilot 或生产发布。验收标准是：
治理包自身通过 Harness，candidate 在新 approval 下重新形成三路径最窄修复字节并通过完整静态与非生产安装态验证。

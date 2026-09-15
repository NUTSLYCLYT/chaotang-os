# Product Authority M0 Credential-Separated Preauthorization Containment Prerequisite Successor

Task ID: `PRODUCT-AUTHORITY-M0-CREDENTIAL-SEPARATED-PREAUTH-CONTAINMENT-PREREQUISITE-SUCCESSOR-20260915`

## Status

Draft

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

现有 `product-authority.m0.v1` 仍是唯一能够返回 `GO / APPROVED_FOR_ONE_CHILD` 的产品权威。前序 exact7 草案试图在 authority 进程内用同 UID helper、subreaper、process group 与 pidfd 约束 approval-controlled controller/verifier，但独立审查证明该边界不能可靠覆盖 `SIGKILL helper → setsid → double-fork → 持有 FD6`、fork storm 和外层 helper 超时。因此前序 exact7 状态固定为 `STOP / PROCESS_TREE_CONTAINMENT_INCOMPLETE / UNCOMMITTED_BYTE_EVIDENCE_ONLY / NO_CANDIDATE_IDENTITY / NO_REANCHOR`，不得提交、消费、恢复或重锚。

本 prerequisite 设计一个最窄、forward-only 的 exact9 protected-path successor：保留前序 exact7 中已审阅的 closed approval/receipt 合同字节作为 donor，新增并接入仓库现有的 root-owned credential-separated verifier broker。Broker 只负责 OS 边界内的受限执行、对象来源验证、进程树/cgroup 清理和低敏 receipt；它不得解释产品批准语义、不得产生 GO/STOP、不得成为第二 authority。唯一 Product Authority 必须在返回 GO 前调用 broker 的新增 preauthorization request variant，验证 broker 外层 receipt 与 worker 内层 preauthorization receipt 的完整绑定后才继续。

本包只冻结未来 exact9 范围和验收合同，不实施、不安装、不启动 systemd 单元、不运行 product authority、不提交、不推送、不部署。

## Acceptance Criteria

- [ ] future candidate paths 精确为九条，不得出现第十条路径。
- [ ] 前序 exact7 七路径以 byte donor 身份记录；其 stopped authority/candidate/验证/审查身份均不得继承。
- [ ] 现有 `product-authority.m0.v1` 保持唯一 GO/STOP 决策者；broker、controller、verifier、Harness 和 receipt 均不得产生授权结果。
- [ ] 现有 `chaotang-product-verifier-request.v1` 与其 receipt、75 项静态测试及既有安装语义保持兼容；新增 preauthorization variant 必须是 closed additive protocol，不能把 approval source 伪装成 candidate lineage。
- [ ] 新 variant 必须绑定 approval commit、approval tree、direct base commit、approval canonical digest、task ID、实时 remote HEAD、精确 source object set、controller/verifier identity、nonce、TTL、18-case record/schema identity及固定执行 profile。
- [ ] Broker 必须用 root-owned socket-activated per-connection service、独立 controller/ingest/worker 身份、cgroup v2、PID namespace、无网络 worker、只读 source view、固定 executable/cwd/environment/timeout、seccomp/capability 限制执行 preauthorization worker。Broker 在读取任何 request bytes 或创建 worker 前，必须用 `SO_PEERCRED` 验证 peer 的 primary UID/GID 精确等于 installed manifest 冻结的 dedicated controller UID/GID；kernel PID、starttime、user namespace 与 cgroup identity必须从 `/proc` 复核并绑定本次连接/receipt。supplementary-group、代理/转发身份或 user-namespace 混淆不能替代该检查。
- [ ] approval-controlled controller/verifier 只能在 broker worker 隔离域内执行；FD6 只指向只读 approval source view，不得指向宿主仓库或可变工作树。
- [ ] 每个 accepted connection 必须绑定唯一 `SYSTEMD_INVOCATION_ID + per-connection service unit name + service cgroup path/inode`。常驻 socket unit 与该 per-connection service identity 严格分离；receipt 前 service cgroup 的 `cgroup.procs` 必须精确只含 root broker PID，reply 成功关闭后由 authority 对同一 identity 复核 service `inactive`、cgroup empty 且无 FD6 holder。不得把常驻 socket active、只剩 supervisor 或另一个 cgroup 的状态冒充最终清理。
- [ ] controller/verifier/worker 的成功、失败、超时、异常、receipt 拒绝、leader 提前退出、setsid、double-fork、FD3 关闭后保留 FD6 和 fork storm 路径必须由同一 per-connection service cgroup 收口。Broker 必须持续 poll peer `HUP/ERR/RDHUP`；caller `SIGKILL`、socket close、read stall、outer deadline、malformed/extra frame或reply write失败均立即执行幂等 service stop/cgroup kill，并等待只剩broker再退出，最终由authority验证inactive/empty。
- [ ] Broker root supervisor 不得执行 approval-controlled source，不得把 worker 提升为 root；worker 无权向 root broker 或 controller identity 发送信号。
- [ ] Product Authority 必须验证 broker receipt、inner preauthorization receipt、approval/base/remote/source identity、nonce/TTL 与 evidence digest 全部闭合。Outer receipt 必须包含 `peerPrimaryUid,peerPrimaryGid,peerKernelPid,peerProcStarttime,peerUserNamespaceDeviceInode,peerCgroupPath,dedicatedControllerManifestDigest`，authority 按 installed manifest与本次live peer observation逐字段复核并纳入两级 evidence digest；缺失、过期、重放、跨 approval、错 peer、错 remote、错对象、错 profile、错 FD、额外字段或输出截断均 STOP。
- [ ] 新协议不得创建持久授权 ledger、外部 PASS 文件、第二 Harness、第二事实源、HSM/私钥或数据库。
- [ ] 旧 v1 approval、旧 broker request、旧 authority result 的 bytes、canonical digest 与行为保持兼容。
- [ ] 当前主机已安装 broker 绑定旧提交且缺少 Node preauthorization profile；future exact9 即使落地也必须在独立管理员完成精确安装、installed acceptance、stopped/disabled 复核前 fail-closed，不得使用陈旧安装状态。
- [ ] future exact9 完整矩阵及 Governance、Architecture、Security Review 必须全部 `GO / P0=0 / P1=0 / P2=0`。

## Delivery Constraints

- 信任边界只覆盖未受控普通调用进程、approval-controlled controller/verifier 与其后代；不宣称抵御已控制的 Owner、OS root、Gitee owner、systemd manager 或整个 runner。
- exact9 是 protected-path governance repair，不能由待升级的 authority 自我授权。未来只能在 Owner 精确确认冻结 identity 后，以直接单亲、最小路径、完整矩阵、独立三审和普通 fast-forward 落地。
- `scripts/reference/chaotang-product-verifier-broker.py` 只增加 additive preauthorization source protocol；不得改变既有 candidate verification v1 的语义。
- `deploy/systemd/chaotang-product-verifier.socket` 与 `deploy/systemd/chaotang-product-verifier@.service` 不进入 exact9。它们的当前主线 bytes 作为冻结运行环境契约；若实现发现必须修改任一 unit，立即 STOP 并另立最窄安装/runtime-profile prerequisite。
- dedicated controller invocation 是必要环境前提。当前普通 `ubuntu` 身份不得通过复用 credential helper、放宽 socket mode 或直接启动 root service 获得生产等价验收。
- 本包不读取、复制或输出凭据，不修改系统/用户/仓库持久配置，不安装组件，不启动服务。

## Affected Modules

- 模块：Product Authority M0 closed manifest/receipt gate、root-owned credential-separated verifier broker、broker protocol regression tests、Owner/边界文档。
- 允许路径：
  - `.harness/agents/project-owner.md`
  - `.harness/contracts/product-approval.schema.json`
  - `.harness/rules/project-boundaries.md`
  - `docs/product/tasks/2026-08-16-m0-solo-owner-product-authority.md`
  - `docs/superpowers/plans/2026-08-16-m0-solo-owner-product-authority.md`
  - `scripts/product-authority.mjs`
  - `scripts/product-authority.test.mjs`
  - `scripts/reference/chaotang-product-verifier-broker.py`
  - `scripts/reference/test_chaotang_product_verifier_broker.py`

## Technical Plan

1. 保留 exact7 schema、Owner/边界文档与 authority receipt consumer 的 closed contract donor；删除对同 UID inline helper/subreaper 能构成最终 containment 的任何通过结论。
2. 在 broker 中新增 closed `chaotang-product-verifier-preauthorization-request.v1` 与对应 receipt variant。该 variant 接受 approval source graph，而不是 candidate graph；要求 `approval.parent == directBase`，并传输 approval commit object、direct-base commit object、approval root tree、全部递归 subtree 与全部 blob。direct-base object 仅用于读取并验证 parent identity，其 tree/parent closure 不物化。closed source-object manifest 按 `kind,path,mode,oid,type,bytes,rawSha256` 字典序 canonical 化：commit 项无 path/mode，tree/blob 项必须有唯一 path/mode；缺失、额外、重复、未列对象、type/mode/OID/raw/bytes漂移、replace/ref/config注入均拒绝。
3. Broker 将 approval tree 物化为只读 source view，按精确 source-object manifest 与 digest 复核。Worker 在现有 user/mount/PID/network 隔离内执行固定 Node preauthorization profile；执行前后枚举 `/proc/self/fd`，controller/verifier 只获得协议冻结的 FD3/FD4/FD6，FD5不可见。FD6 必须绑定 source-view mount ID、device、inode、mode与sealed manifest，限定继承且不存在 writable duplicate、host root、host repo或credential FD。
4. 复用现有 systemd `KillMode=control-group`、`SendSIGKILL=yes`、`OOMPolicy=kill`、`TasksMax`、memory/CPU/runtime 限额和 cgroup v2。每次连接生成唯一 service instance；receipt绑定该unit/invocation/cgroup identity。签发前 `cgroup.procs` 精确只含root broker；reply后authority复核同一service inactive、cgroup empty。peer disconnect或outer timeout由broker的socket生命周期状态机触发幂等stop/kill，不允许后台继续。
5. 在 Product Authority 中将 preauthorization-gated approval 路由到 broker，而不是本地 helper。Authority 生成 fresh nonce/TTL，验证 broker 外层 receipt与内层 preauth receipt、approval/base/tree/canonical/remote/source/controller/verifier/profile及peer identity，并把二者 digest 纳入现有 evidence digest。Reply/EOF后，authority用固定shell-free `/usr/bin/systemctl show` 最小属性集取得同一per-connection unit的`ActiveState,InvocationID,ControlGroup`，再以component-wise no-follow读取匹配inode的`/sys/fs/cgroup/<ControlGroup>/cgroup.procs`；命令、属性、路径或权限不可用一律`PREAUTH_CLEANUP_UNVERIFIED` STOP。只有全部闭合才可继续唯一 GO builder。
6. 旧 approval 未声明新 gate 时保持原行为；旧 broker candidate verification v1 逐字段保持不变。任何协议歧义、fallback 到本地 helper、调用方可控 executable/cwd/environment/socket/receipt path 或旧安装复用均 STOP。
7. 在两个测试文件先形成 RED：无 controller 身份、stale install、错误 source graph、伪 candidate graph、broker bypass、forged receipt、nonce/TTL replay、FD/profile漂移，以及 controller/verifier 的 setsid、double-fork、FD6 保留、fork storm、leader exit、helper timeout。GREEN 必须用 cgroup/pid namespace 证据证明无残留。
8. exact9 落地后仍不自动可用：另由管理员冻结并安装当前 unit/broker/profile，运行 installed acceptance，验收结束停止并保持 disabled；此环境动作不属于本 candidate。

## Implementation Report

只读基线已确认：实时 `origin/ext-dev`、detached HEAD 均为 `4deb1d937c66957f4d4293ca9106dcec986e38e6`，tree 为 `a52ff85976c4248936615fc90878df5eb06c677c`。前序 exact7 工作区仍只有七条未提交修改，full-index diff 为 `sha256:3493a86bf19db8556b20075481c0be3d24ab27a123ea469fbc1f592b9f37bd0e`，仅作为 donor evidence。

现有 broker 静态回归在进程级 POSIX 临时目录下为 `75 tests / OK / 5 installed-host skips`。当前主线 broker与tests分别为 `sha256:96f820df1360820fa9eba23a6ed47dae25d7fab8e160a47c2fd04e2e13eb11c8` 和 `sha256:303d8d10874690cba418a86b5b409331db679e525da395e61771c249399b79bd`。主机安装 manifest 仍绑定旧 commit `0b323e26584069019662aa723d30fd763424954c`，已安装 bytes 与当前主线不一致，且没有 Node preauthorization profile；相关 socket/service 当前 inactive、disabled，不可用于宣称通过。

仓库不存在适用于 `governance-repair.packet.v1` 的正式 JSON Schema；本包只能声明 strict JSON、重复键拒绝、现有 closed-contract/internal-consistency、Task合同和Harness检查，不伪造 schema PASS。修正后 strict JSON/重复键、`productTaskErrors=[]`、三路径/exact9/mode/internal consistency、`git diff --check` 均通过；Harness为159个基线文件通过，self-test为175项通过，doctor为`PASS / STRUCTURE_VALID_NON_AUTHORIZING`，broker静态回归为`75 tests / OK / 5 installed-host skips`。独立Governance、Architecture、Security最终均为`GO / P0=0 / P1=0 / P2=0 / P3=0`。尚未实施 exact9、未运行 product authority、未安装或启动任何服务。

## Acceptance Review

治理冻结必须证明：exact9 是前序 exact7 的 forward-only containment successor；broker只提供执行隔离和可验证 receipt；Product Authority 仍是唯一决策者；approval-source protocol与candidate-verification protocol不可混淆；stale install始终fail-closed；九路径是完整且最窄的代码/合同闭包。

实时远端漂移、第十条路径、systemd unit修改需求、旧协议回归、same-UID helper fallback、credential/controller权限放宽、进程残留、cgroup不可证明、旧安装误用、receipt可伪造/重放、任一关键验证失败或独立审查出现P0–P2，均立即STOP。

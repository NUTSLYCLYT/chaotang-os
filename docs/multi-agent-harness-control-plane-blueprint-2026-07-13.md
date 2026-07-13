# 朝堂 OS 多 Agent Harness 控制面完整实施方案

> 版本：2026-07-13  
> 状态：待按步实施  
> 目标：在不重构业务运行时、不阻断首发的前提下，建立可强制执行的多 Agent 路径租约、端口/构建锁、独立 worktree、唯一 Release Commander、统一测试会话和可追溯发布证据。

## 1. 结论与成功定义

本方案所说的“100% 实现”，不是承诺软件永不失败，而是指以下控制点全部转为机器可执行的硬约束，不再依赖口头约定：

1. 每个写任务必须有唯一 owner 和路径租约。
2. 控制面同一时刻只授予一个重叠路径 write lease；每个候选提交的 diff 必须有不可变 lease attestation。本方案不声称 Git hook 能提供 OS 级写保护。
3. 3002、3050 和 production build 同一时刻只有一个持有者。
4. 并行 Agent 默认使用独立 worktree、独立构建目录和非冲突端口。
5. 只有 Release Commander 可以执行 production candidate build、切换 active build、启停 3050、运行最终门禁和给出 READY。Worker/Integrator 只能执行不会切换 active 的隔离验证 build。
6. 发布证据必须同时绑定 commit SHA、worktree、build ID、服务 PID 和 gate report。
7. 测试会话不在源码中保留固定凭据，并可撤销、可追溯。
8. 任何冲突、超时、强制接管、跳过或计划变更都留审计记录。
9. “100% 实现”只表示本文声明的控制点全部启用并通过规定的正向、负向和对抗测试，不表示有限次测试能证明系统永不失败。

全部验收通过后，可将工程多 Agent 协作从当前约 6.5/10 提升到 8.5–9/10，同时保留现有产品运行时的 FlowEngine、SwarmOrchestrator、御史门和史馆归档架构。

## 2. 不可破坏的现有边界

| 层级 | 事实源 | 本方案只允许做什么 |
| --- | --- | --- |
| 根项目 harness | `.harness/` | 定义任务、租约、资源锁、发布协议和跨线审计 |
| 前端 harness | `frontend/.harness/` | 执行浏览器、构建、端口和 production release gate |
| 后端 harness | `backend/harness/` | 验证蜂群、真实链、证据、安全、成本和可审计输出 |
| 产品运行时 | `backend/src/` | 继续使用 FlowEngine / SwarmOrchestrator，本阶段不重写 |
| 前端产品 | `frontend/src/` | 不因工程控制面而改造页面或业务逻辑 |

硬约束：

- 不把后端运行记录搬入 `frontend/.harness/`。
- 不用前端 mock 证明蜂群真实运行。
- 不用后端 dry-run 证明浏览器用户体验。
- 不修改已冻结的大殿产品边界。
- 不用一次大重构替换现有 release scripts，只通过包装器与硬门逐步接管。

## 3. 目标架构

```text
任务请求
  -> Harness Task Registry
       -> 产生 task_id / owner / write_paths / dependencies / risk
       -> Lease Manager 授予路径租约
       -> Workspace Manager 分配 worktree / distDir / port
  -> Worker Agent
       -> RED -> GREEN -> 局部验证 -> change record -> candidate commit
  -> Read-only Reviewer
       -> 代码 / 安全 / 测试 / 边界审查
  -> Integrator
       -> 按 DAG 合并 candidate commits
  -> Release Commander
       -> 独占 build + 3050
       -> clean build -> start -> identity proof
       -> doctor -> browser -> true-chain -> jiqun -> security
       -> READY / STOP
  -> Release Evidence Ledger
       -> commit + build ID + PID + gate report + rollback target
```

## 4. 控制面数据契约

### 4.1 Task Record

```json
{
  "schema": "chaotang.harness-task.v1",
  "taskId": "task-20260713-lifu-e2e",
  "title": "闭环礼部 E2E",
  "owner": "agent-id",
  "status": "planned",
  "risk": "medium",
  "writePaths": ["frontend/e2e/lifu-office.spec.ts"],
  "readPaths": ["frontend/src/features/lifu/**"],
  "dependencies": [],
  "worktree": ".worktrees/task-20260713-lifu-e2e",
  "resources": ["port:3102"],
  "createdAt": "ISO-8601",
  "expiresAt": "ISO-8601"
}
```

`status` 只允许：`planned | leased | running | review | integrated | released | blocked | cancelled | expired`。

### 4.2 Lease Record

```json
{
  "schema": "chaotang.harness-lease.v1",
  "leaseId": "lease-uuid",
  "taskId": "task-id",
  "owner": "agent-id",
  "resourceType": "path",
  "resource": "frontend/e2e/lifu-office.spec.ts",
  "mode": "write",
  "acquiredAt": "ISO-8601",
  "heartbeatAt": "ISO-8601",
  "expiresAt": "ISO-8601",
  "state": "active"
}
```

`resourceType` 支持：`path | port | build | release | integration`。

### 4.3 Release Evidence

```json
{
  "schema": "chaotang.release-evidence.v1",
  "releaseId": "release-uuid",
  "commander": "agent-id",
  "gitCommit": "full-sha",
  "worktree": "/absolute/path",
  "dirtyTracked": false,
  "buildId": "next-build-id",
  "frontendPid": 12345,
  "backendPid": 23456,
  "baseUrl": "http://127.0.0.1:3050/chaotang",
  "gateDecision": "GREEN",
  "gateReport": "frontend/dev/artifacts/.../report.json",
  "rollbackCommit": "full-sha",
  "checkedAt": "ISO-8601"
}
```

## 5. 角色和权限矩阵

| 角色 | 可写业务代码 | 可合并 | 可 build | 可启停 3050 | 可 READY |
| --- | ---: | ---: | ---: | ---: | ---: |
| Planner | 否 | 否 | 否 | 否 | 否 |
| Worker Agent | 仅租约路径 | 否 | 仅隔离 build | 否 | 否 |
| Reviewer | 否（只读） | 否 | 否 | 否 | 否 |
| Integrator | 仅冲突收口 | 是 | 可集成 build | 否 | 否 |
| Release Commander | 否（发布期冻结） | 否；修复必须新建 task/lease/review/release ID | 是 | 是 | 是 |
| Emergency Maintainer | 需 break-glass 记录 | 是 | 是 | 是 | 是 |

## 6. 依赖图与并行策略

```text
S0 -> S1 Task Registry + Lease Manager
S0 -> S2 Resource Lock Manager
S1 -> S3 Attestation + Integration Gate
S1 + S2 -> S4 Worktree Manager
S2 -> S5 Build/Start Wrapper
S1 + S2 + S5 -> S6 Release Commander
S1 -> S7 External Test Identity Manager
S5 + S6 -> S8 Release Evidence + Identity Gate
S3 + S4 + S5 + S7 + S8 -> S9 Failure Injection / Recovery Drill
S0..S9 -> S10 Mandatory Rollout
```

可并行：

- S1 与 S2 可并行，文件所有权不重叠。
- S3 在 S1 后执行；S4 必须等待 S1+S2。
- S7 只依赖 S1，可与 S4–S6 并行。

不可并行：

- 任何修改 `frontend/scripts/prod-*.mjs` 与 `final-release-harness.mjs` 的任务。
- 任何持有 `resourceType=release` 的任务与其他 build/start 任务。
- 同一路径的两个写租约。

## 7. 十一个可独立交付步骤

### S0：冻结契约和量化基线

**目标**：先把现状和控制契约写成机器可验证基线，防止实施期改口径。

**主文件**：

- `.harness/contracts/task.schema.json`
- `.harness/contracts/lease.schema.json`
- `.harness/contracts/release-evidence.schema.json`
- `.harness/wiki/multi-agent-control-plane.md`
- `.harness/manifest/project-harness.json`

**任务**：

1. 定义上述三个 JSON Schema。
2. 记录基线：端口冲突次数、构建失败次数、重复修复次数、发布总时长。
3. 更新根 manifest 与 verification matrix。

**验证**：

```bash
node scripts/harness-doctor.mjs
node --test scripts/multi-agent-contracts.nodetest.mjs
```

**退出条件**：三个契约可校验正反样例，根 doctor 0 errors。

**回滚**：禁用新契约入口并将 change 标记为 `REVERTED` 或 `SUPERSEDED`；保留契约和审计证据，不直接删除历史。

### S1：Task Registry 与 Lease Manager

**目标**：建立任务注册、路径冲突判定、租约 TTL、heartbeat、release 和过期回收。

**主文件**：

- `scripts/harness-task.mjs`
- `scripts/harness-lease.mjs`
- `<git-common-dir>/chaotang-harness/control-plane.sqlite3`（所有 worktree 共享的唯一绝对路径）
- `scripts/multi-agent-lease.nodetest.mjs`

**CLI**：

```bash
node scripts/harness-task.mjs create --spec task.json
node scripts/harness-lease.mjs acquire --task task-id --path frontend/e2e/foo.spec.ts
node scripts/harness-lease.mjs heartbeat --lease lease-id
node scripts/harness-lease.mjs release --lease lease-id
node scripts/harness-lease.mjs status --json
```

**事务与线性化规则**：

- 第一版明确只支持单机本地文件系统；使用 SQLite WAL，不声称支持 NFS/多主机。
- runtime root 必须通过 `git rev-parse --git-common-dir` 和 repository identity 解析，不得相对当前 worktree。启动时记录绝对路径、device/inode、git common dir 和 repository identity；发现 worktree 私有库、路径漂移或多库实例立即 fail closed。
- `acquire/heartbeat/expire/release/force-release` 全部在 `BEGIN IMMEDIATE` 事务内执行。
- acquire 在同一事务内完成：路径规范化、realpath/symlink 解析、父子与目录重叠检查、owner 验证、分配单调 fencing epoch 和 commit。
- 每次租约操作的线性化点是 SQLite transaction commit；旧 owner 即使恢复，因 fencing epoch 过期也不能再提交 attestation。
- SQLite 设置 `synchronous=FULL`；启动时运行 integrity check，损坏库隔离后 fail closed，需 break-glass 恢复。
- schema 使用单调 `user_version`，每次 migration 必须有 upgrade/downgrade 测试。

**必测场景**：

- 同路径两个 write lease：第二个必须 STOP。
- 父目录与子文件租约冲突。
- 两个 read lease 可并存。
- TTL 过期后可回收，未过期不可强抢。
- `force-release` 必须携带 reason 并写 audit log。
- 原子写入，两进程竞争时不产生双赢。
- 父目录/子文件同时 acquire、TTL 边界与 heartbeat 竞争、expire/acquire 竞争、force-release/acquire 竞争和 symlink 绕过。

**退出条件**：100 轮并发无双租约；三个真实 worktree 同时争抢 lease/port/release lock 仍只有一个 owner；`PRAGMA integrity_check` 通过；WAL 崩溃恢复通过；upgrade/downgrade 后状态一致；fencing epoch 单调且不复用。

### S2：端口、构建与发布资源锁

**目标**：从机制上禁止多 Agent 同时占用 3002/3050 或修改 `.next`。

**主文件**：

- `scripts/harness-lock.mjs`
- `scripts/lib/resource-lock.mjs`
- `scripts/resource-lock.nodetest.mjs`
- `<git-common-dir>/chaotang-harness/control-plane.sqlite3`（与 lease 使用同一事务库）

**锁键**：

- `port:3002`
- `port:3050`
- `build:frontend-production`
- `release:production`
- `integration:feature-chaotang-ext`

**锁内容**：owner、taskId、PID、PGID、cwd、worktree、commit、command、acquiredAt、heartbeatAt、expiresAt。

**安全要求**：

- 锁检查、分配 fencing epoch 和 owner 写入在同一 SQLite `BEGIN IMMEDIATE` 事务内完成，不使用“先检查再写入”。
- 进程身份绑定 `host-id + boot-id + pid namespace + PID + /proc start ticks + cwd + process nonce + fencing epoch`。
- heartbeat 只由持有 process nonce 的 PGID leader 续期；父进程退出后子进程不得继承 owner 身份。
- 状态机固定为 `active -> suspect -> fenced -> reclaimed`。TTL 到期只会进入 `suspect` 并分配待生效的新 fencing epoch，不立即启动新 owner。
- 从 `suspect` 进入 `fenced` 前必须同时检查 OS 实际 socket owner、PGID、build 子进程和相关文件句柄。端口锁以真实 bind/socket owner 为最终事实，SQLite 锁不能代替 OS 检查。
- 旧 PID 仍占用 socket、仍有 build 子进程或无法精确停止时，fail closed 并转 break-glass，禁止并发启动新 owner。旧 owner 已释放真实资源且身份核验通过后才可 `reclaimed`。
- 新 epoch 生效后，旧 owner 即使恢复也不得继续写入或发布。
- 强制解锁必须有 break-glass 记录。

**退出条件**：200 轮多进程争抢中每个资源始终只有一个 owner；“活 PID + heartbeat 停止 + 仍占 3050”必须 STOP；“活 PID + 已释放 socket”可安全 reclaim；旧进程在新 epoch 后续写必须被拒。

### S3：路径租约证明、集成硬门与本地快速反馈

**目标**：让“候选提交无法证明其 diff 由有效租约覆盖”在权威 integration/CI 门必然失败。Git hook 只是可绕过的本地快速反馈，不是权威安全边界。

**主文件**：

- `scripts/guard-agent-lease.mjs`
- `scripts/install-git-hooks.mjs`（根级所有者）
- `scripts/verify-lease-attestation.mjs`
- `backend/scripts/commit_closeout_check.py`
- `.harness/rules/project-workflow.md`

**规则**：

1. 本地 hook 从 staged diff 取得路径，提前警告无 active lease 或越界，但明确不承担不可绕过保证。
2. candidate commit 生成不可变 lease attestation：task ID、lease ID、fencing epoch、规范化路径、base/tree/commit SHA、开始/结束时间和 attestation digest。候选提交后可释放 active lease，integrator 验证 attestation 而非要求租约仍存活。
3. 权威 integration/CI 门重算 commit diff，确认每个路径都被 attestation 覆盖、epoch 未被废弃、base/tree 匹配。未通过的 commit 不得进入受保护分支。
4. change record、生成报告和已明确允许的忽略目录可用精确 allowlist，不允许整仓绕过。
5. 本机人工直接开发仍要 task ID、lease 和 attestation。`--no-verify` 不影响服务端权威门。

**退出条件**：无 attestation、越界、伪造 base/tree、废弃 epoch、hook bypass 全部在 integration/CI 被拦；本地 hook 不增加超过 500ms。若未来要求“写入发生时”就硬阻断，必须另立项引入受控编辑代理、容器只读挂载或 OS ACL，不得宣称 Git hook 已实现。

### S4：Worktree Manager 与隔离资源分配

**目标**：让并行 Agent 不再共享 working tree、index、`.next` 和端口。

**依赖**：S1 + S2（端口必须由 Resource Lock Manager 分配）。

**主文件**：

- `scripts/harness-worktree.mjs`
- `.harness/runtime/worktrees/registry.json`
- `.harness/rules/worktree-isolation.md`

**命名规则**：

```text
.worktrees/<task-id>/
branch: agent/<task-id>
NEXT_DIST_DIR: .next-agent-<short-id>（`next.config.ts` 必须显式读取并设置 `distDir`）
dev port: 3100–3199 租约分配
artifact dir: dev/artifacts/<task-id>/
```

**CLI**：

```bash
node scripts/harness-worktree.mjs create --task task-id
node scripts/harness-worktree.mjs env --task task-id
node scripts/harness-worktree.mjs status
node scripts/harness-worktree.mjs retire --task task-id
```

**隔离细节**：worktree 各有自己的 node_modules 链接/安装元数据和 distDir；可共享内容寻址的 pnpm store，但不共享 `.next*`、Playwright output、test-results 和运行日志。

**退出条件**：三个并行样例可同时修改、测试和真实 Next build，互不改变 `git status`、index、端口、distDir 和测试产物。

### S5：安全 Build / Start / Stop 包装器

**目标**：根治“运行中 3050 与 production build 共享 `.next`”、chunk/manifest 被覆盖和 orphan child 进程。

**主文件**：

- `frontend/scripts/safe-prod-build.mjs`
- `frontend/scripts/safe-prod-start.mjs`
- `frontend/scripts/safe-prod-stop.mjs`
- `frontend/scripts/lib/process-identity.mjs`
- `frontend/scripts/safe-prod-lifecycle.nodetest.ts`

**构建流程**：

```text
获取 release/build 锁
-> 确认 3050 未监听
-> 确认无 next build 子进程
-> 构建到 builds/<release-id>/next 不可变版本目录
-> 校验 BUILD_ID / manifests / static / standalone / public 映射和内容摘要
-> digest 后将版本目录改为只读；优先使用只读 bind mount/container layer，单机降级方案使用无写权限的专用运行用户
-> 使用原子 symlink/pointer 将 active 指向新版本，不覆盖 rename 非空目录
-> 记录 build manifest
-> 释放 build 锁
```

**启动流程**：

```text
获取 port:3050
-> 校验 active pointer 指向的不可变 build 对应当前 commit
-> start 前重算 digest 并检查构建后无 mtime/内容改写
-> spawn 独立进程组
-> 等待 readiness
-> 写 PID/start-time/cwd/build-id
-> 持续 heartbeat；运行进程始终引用具体版本目录，不跟随 active pointer 漂移
```

**停止流程**：只使用记录的 PID/PGID，TERM -> 等待 -> 精确 KILL；禁止 broad `pkill`。旧 PID 退出前不删除其不可变 build 目录。

READY 前再次重算实际运行目录 digest。运行期修改 chunk/manifest/public 任一文件必须在下一次 health/identity 轮询中 STOP，不得等到下次手工发布。

**退出条件**：故障注入 50 轮不出现半个 active build、丢 chunk、双 3050 或留存 orphan。

### S6：Release Commander 状态机

**目标**：实现唯一发布指挥权和可恢复的发布状态机。

**主文件**：

- `scripts/release-commander.mjs`
- `.harness/contracts/release-run.schema.json`
- `.harness/runtime/releases/`
- `frontend/scripts/prod-release-gate.mjs`（仅作被调用 gate，不重写）

**状态机**：

```text
planned
-> locked
-> frozen
-> built
-> started
-> identity_verified
-> gates_running
-> green | red
-> released | rolled_back
```

**硬门**：

- tracked worktree 必须 clean；允许的 untracked 需精确 allowlist。
- build commit 必须等于当前 HEAD。
- release 锁期间禁止新 write lease 进入发布路径。
- 最终命令必须包含 root/frontend/backend doctor、build、browser、true-chain、jiqun、security。
- 任一 SKIP 默认 STOP，只有明确记录的 non-production profile 可放行。

**退出条件**：两个 Commander 争抢时只有一个进入 `locked`；任一中断可从最后安全状态续跑或回滚。

### S7：外置 Ephemeral Test Identity Manager

**目标**：取代假 token、固定测试密码和重复注册逻辑，且不在 production API 内增加任何造用户/造 token 路由。

**主文件**：

- `scripts/test-identity.mjs`（根级 CLI，调用现有注册/登录契约或独立 CI identity sidecar）
- `frontend/e2e/test-session.ts`
- `scripts/test-identity.nodetest.mjs`
- `backend/tests/test_production_has_no_test_identity_routes.py`

**契约**：

- 优先使用外部注入的短期测试 token；无 token 时，CLI 使用随机账号/密码调用现有非特权注册/登录契约。
- TTL 默认 30 分钟。
- token 只返回一次，日志中脱敏。
- 运行结束后通过现有管理契约 revoke/禁用；无安全 revoke 能力前，只允许隔离测试数据库或已设置严格 TTL/audience/scope 的 CI sidecar。
- production 构建的路由枚举测试必须证明不存在 test-session/test-identity 路由；启动时发现此类路由必须 fail closed。
- CI sidecar token 使用独立 issuer/audience/scope，production issuer 明确拒绝；sidecar 只绑定 loopback/CI 隔离网络，有并发配额与重放保护。

**退出条件**：并行创建 50 会话无租户串扰，全部可撤销/过期，日志/产物/git diff 无 token 和密码；production 路由枚举、错误环境组合、sidecar secret 泄露、重放、跨环境 token 全部负向测试通过。S7 属安全敏感跨线变更，需根级+后端 change 和独立安全审查。

### S8：Release Evidence Ledger 与运行身份门

**目标**：让“这个页面跑的是哪个 commit”变成可机器证明的事实。

**主文件**：

- `frontend/scripts/prod-runtime-identity.mjs`
- `frontend/scripts/prod-doctor.mjs`
- `scripts/release-evidence.mjs`
- `<git-common-dir>/chaotang-harness/control-plane.sqlite3`（事务追加 + hash chain）
- 独立信任锚：CI artifact attestation / 受限签名密钥 / 外部 append-only audit sink 三者至少启用一种

**不可伪造的 provenance**：

- build 从 Git object database 读取 commit/tree，记录 dirty tracked 状态、构建命令和环境 allowlist，对不可变 build 目录生成 artifact digest。
- runtime identity 从实际加载的具体 build 目录读取 build ID/digest，不接受启动命令任意注入 SHA。
- gate 独立重算 artifact digest，并通过 socket inode -> PID -> process identity -> build directory 验证真正监听 3050 的进程。
- ledger 在 SQLite transaction 中 append，每条包含 previous hash 形成 hash chain。每次 release 的链头/末 checkpoint 必须写入 Release Commander 无权改写的独立信任锚；READY 必须校验本地链与外部锚一致。仅有 hash chain 而没有外部锚时只能标记为“可检测非协同损坏”，不得输出 READY。

**必须对齐**：

```text
git HEAD
= build manifest commit
= runtime identity commit
= release evidence commit
= gate report commit
```

任一不等：`STOP/runtime_identity_mismatch`。

**退出条件**：伪造旧 build、其他 worktree、dirty build、空 SHA、仅改字段不改产物、修改运行中 chunk/manifest/public、删除 ledger 尾记录、整链重写并重算 hash、复制旧数据库回滚、伪造环境变量、非监听 PID 全部被外部锚或身份门拦截。

### S9：故障注入、恢复和 break-glass 演练

**目标**：证明控制面在 Agent 崩溃、机器重启、锁过期和发布失败后不会死锁或双发。

**故障矩阵**：

| 故障 | 期望结果 |
| --- | --- |
| Agent 持租约后被 kill | TTL 到期后回收，回收前不可抢占 |
| PID 被复用 | start time/cwd 不匹配，不误判为原 owner |
| build 中断 | active build 不受影响，candidate 可清理 |
| start 后 health 失败 | 精确停止新 PID，保留旧 build 可回滚 |
| gate 中断 | release 状态保留，可 resume，不输出 READY |
| 双 Commander | 后者 STOP，不能绕过 release lock |
| SQLite 控制面库或外部信任锚损坏 | fail closed，需 break-glass，不自动删除 |
| 强制解锁 | 要求 actor/reason/evidence，写 append-only audit |
| 机器/容器重启与 PID namespace 变化 | boot-id/namespace/nonce 失配，旧 owner 不得恢复 |
| 磁盘满、只读文件系统、SQLite 损坏 | fail closed，保留快照并走 break-glass |

**退出条件**：全部故障演练通过，不存在双写、双 3050、误杀无关进程或假 READY。

### S10：分阶段强制推广

**目标**：先观测，后警告，最后硬拦，不影响当前首发。

| 阶段 | 时长 | 行为 | 升级条件 |
| --- | ---: | --- | --- |
| Observe | 2–3 天 | 只记录冲突，不拦截 | 无格式损坏，数据完整率 100% |
| Warn | 2–3 天 | 越界操作返回警告，仍允许人工继续 | 误报率 < 2% |
| Enforce paths | 3 天 | 硬拦无租约代码写入/提交 | 无 P0/P1 阻塞 |
| Enforce resources | 3 天 | 硬拦端口/build/release 冲突 | 故障演练通过 |
| Mandatory | 长期 | 所有 Agent 和发布必须走控制面 | 连续 20 次发布无控制面事故 |

**控制面自身回退**：

| 阶段 | 自动回退阈值 | 回退动作 | 回退后事实源 |
| --- | --- | --- | --- |
| Observe | 无 | 关闭观测器，保留数据 | 原有 scripts |
| Warn | 误报 > 5% 或增加 > 5 分钟/任务 | 退回 Observe | 原有 scripts |
| Enforce paths | 任一 P0 修复被误拦或误报 > 2% | 禁用 integration hard gate，退回 Warn | 服务端门配置版本 |
| Enforce resources | 发布被控制面阻断 > 15 分钟 | 回滚 wrapper pointer，恢复上一稳定 wrapper | 签名配置+上一版状态快照 |
| Mandatory | 控制面不可用且存在已批准紧急发布 | break-glass 紧急通道，仍必须通过原 production gate | 双人批准+有时限的签名票据 |

回退必须定义 schema downgrade/forward compatibility；活跃 lease/lock 先冻结为快照，不直接删除。break-glass 票据最长 30 分钟，限定 commit/release ID，使用后 24 小时内必须复盘。任何回退都不得跳过现有 `pnpm gate:prod-release`。

**退出条件**：连续 20 次发布无路径冲突、端口冲突、构建污染、身份不一致和假 READY。

## 8. 每个执行 Agent 的冷启动指令模板

```markdown
# Task

Task ID: <task-id>
Objective: <one PR-sized objective>
Owner: <agent-id>
Dependencies: <completed task ids>

## Read first

- AGENTS.md
- .harness/agents/project-owner.md
- .harness/rules/project-boundaries.md
- <frontend/AGENTS.md or backend/AGENTS.md>
- docs/multi-agent-harness-control-plane-blueprint-2026-07-13.md

## Lease

Write paths:
- <exact paths>

Forbidden paths:
- all paths not covered by the active lease

## Required behavior

1. Create/update the correct change record.
2. RED test before behavioral code.
3. Preserve user-owned unrelated changes.
4. Do not start 3002/3050 or production build unless the task owns that resource lock.
5. Do not broaden scope without a plan mutation record.

## Verification

- <exact commands>

## Exit criteria

- Tests green.
- Relevant doctor green.
- git diff --check green.
- Candidate commit created.
- Lease released.
```

## 9. 计划变更协议

不允许 Agent 静默扩大范围。变更只能是：

- `split`：任务过大，拆成多个 task，原 task 变 `blocked`。
- `insert`：发现新前置条件，插入新 task 并更新 DAG。
- `reorder`：只在依赖仍无环时允许。
- `skip`：必须记录原因、风险和替代证据；production 硬门不允许 skip。
- `abandon`：释放租约和资源，保留产物索引，不冒充完成。

变更记录必须包含：actor、timestamp、from、to、reason、affected tasks、new verification。

## 10. 反模式清单

以下任一项发生即 STOP：

1. 两个 Agent 共享同一 working tree 并同时写入。
2. 用 `pkill next` 或模糊进程名停服务。
3. production build 时 3050 仍在从同一 distDir 读文件。
4. 为解决凭据误报而排除整个 E2E 目录。
5. 在源码、MD、截图文本或 gate report 中保留 token/密码。
6. 未完成 runtime identity 对齐就声明 READY。
7. 发布期仍接受新功能提交。
8. 用超长锁 TTL 代替 heartbeat。
9. 锁过期后不校验 PID start time 就自动误杀进程。
10. 计划中只写“测试通过”，不写精确命令和可观测退出条件。

## 11. 全局验收矩阵

| ID | 验收项 | 硬标准 |
| --- | --- | --- |
| A1 | 租约互斥 | 100 轮并发无双 write lease，父子/symlink/TTL 竞争全覆盖 |
| A2 | 端口互斥 | 200 轮争抢无双 owner |
| A3 | 构建完整 | 50 轮故障注入无半 build 成为 active |
| A4 | 进程安全 | 静态门拦截 broad kill；故障测试无误杀无关 PID |
| A5 | Worktree 隔离 | 3 个并行任务无 index/distDir/port 串扰 |
| A6 | Release 唯一性 | 2 个 Commander 同时启动，只有 1 个进入 locked |
| A7 | 运行身份 | HEAD/build/runtime/gate SHA 必须全等 |
| A8 | 测试身份 | 50 个会话无串租户、无凭据泄露、可撤销 |
| A9 | 发布门 | root/frontend/backend doctor + build + browser + true-chain + jiqun + security 全绿 |
| A10 | 恢复 | 锁损坏、Agent kill、build kill、gate kill 全部可恢复 |
| A11 | 稳定性 | 连续 20 次发布无控制面事故 |
| A12 | 效率 | 基线窗口=启用前 20 个任务，观测窗口=启用后 20 个同类任务；“重复工作”=因路径覆盖、index 漂移、端口冲突、构建污染而重跑的步骤数/任务总步骤数；目标下降 80%，端口/构建冲突为 0 |

只有 A1–A12 全部达标，方案状态才能从 `IMPLEMENTING` 改为 `ENFORCED`。

### 11.1 控制覆盖表

| Control ID | 执行位置 | 权威门 | 负向测试 | 证据 |
| --- | --- | --- | --- | --- |
| C-LEASE | git-common-dir 共享 SQLite lease transaction | integration/CI attestation gate | 父子路径、symlink、TTL、hook bypass、多 worktree 争抢 | attestation + DB audit |
| C-RESOURCE | SQLite resource lock + fencing | build/release wrapper | 手工占端口、PID 复用、旧 owner 恢复 | lock audit + process identity |
| C-WORKTREE | worktree registry | integrator | 共享 index/distDir/artifact dir | isolation report |
| C-BUILD | read-only immutable build directory | Release Commander | 中断 build、旧 chunk、active pointer 篡改、运行期改产物 | artifact digest |
| C-IDENTITY | runtime provenance + external trust anchor | prod-doctor/release gate | 伪 SHA、伪 PID、整链重写、旧 DB 回滚 | build/runtime/gate digest + external checkpoint |
| C-TEST-ID | external identity manager | production route/security gate | test route 误注册、重放、跨环境 token | security report |
| C-RELEASE | release lock/state machine | Release Commander | 双 Commander、SKIP、dirty build | release evidence record |
| C-RECOVERY | break-glass + rollback state | dual approval + original production gate | 控制面不可用、schema downgrade | drill report + postmortem |

权威门未启用、负向测试缺失或证据无法定位的 control 一律视为未实现。

## 12. 预计工期和 PR 分组

| PR | 步骤 | 预计 | 风险 |
| --- | --- | ---: | --- |
| PR-1 | S0 | 0.5–1 天 | 低 |
| PR-2 | S1 | 1–2 天 | 中 |
| PR-3 | S2 | 1–2 天 | 高 |
| PR-4 | S3 | 1 天 | 中 |
| PR-5 | S4 | 1–2 天 | 中 |
| PR-6 | S5 | 2–3 天 | 高 |
| PR-7 | S6 | 2 天 | 高 |
| PR-8 | S7 | 1–2 天 | 高（鉴权） |
| PR-9 | S8 | 1 天 | 中 |
| PR-10 | S9 | 1–2 天 | 高 |
| PR-11 | S10 | 10–15 天观测推广 | 中 |

工程实施约 12–18 个有效开发日；强制推广与 20 次发布证据需按真实节奏累积，不得伪造。

## 13. 立即开始的第一批任务

1. 先执行 S0，只写契约、基线和测试，零运行时风险。
2. S0 通过后并行开始 S1 和 S2。
3. 在 S5/S6 完成前，继续使用现有 `pnpm gate:prod-release`，不替换首发门禁。
4. 在 Mandatory 阶段前，新控制面不得阻断紧急修复；但紧急通道必须写 break-glass 记录。

## 14. 最终 READY 声明模板

```text
Decision: READY
Release Commander: <actor>
Commit: <full sha>
Build ID: <id>
Runtime PID: <pid>
Runtime commit match: PASS
Tracked worktree clean: PASS
Path lease conflicts: 0
Resource lock conflicts: 0
Root doctor: PASS
Frontend doctor: PASS
Backend doctor: PASS
Production build: PASS
Browser release harness: PASS
True-chain: PASS
Jiqun contracts: PASS
Security gates: PASS
Rollback target: <sha>
Evidence ledger record: <path/id>
```

缺任意一项，必须输出 `STOP` 而不是 READY。

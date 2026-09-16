# Product Authority M0 Credential-Separated Preauthorization Installed Acceptance Successor Plan

Task: `PRODUCT-AUTHORITY-M0-CREDENTIAL-SEPARATED-PREAUTH-INSTALLED-ACCEPTANCE-SUCCESSOR-20260916`

Base: `4b5115f233c84dbb69f4864b278b96fdf05a3027 / 31ecdb147d3367634399f91635700debef4b13c6`

Status: `DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Objective

在不修改 landed exact9 产品代码或 systemd unit 的前提下，补齐真实主机 installed preauthorization 验收入口，
然后用单独冻结的root-owned profiles、installation manifest和orchestrator完成一次非生产安装验收。通过标准不是
“服务能启动”，而是唯一Product Authority真实CLI、dedicated controller、broker双层receipt、sealed source、FD ABI、
systemd/cgroup收口和验收后完全停止/disabled共同闭合。

## Exact Boundaries

治理提交只允许本轮Task、Packet、Plan三条新增路径。未来exact2只允许：

1. `scripts/product-authority.test.mjs`
2. `scripts/reference/test_chaotang_product_verifier_broker.py`

两条均为`MODIFY / 100644`。`scripts/product-authority.mjs`、broker、socket unit和service unit按
`4b5115f2…` blob锁定。若真实验收需要修改第三条仓库路径或任一unit，立即STOP并重新治理。

## Evidence Layers

1. **Repository source**：landed exact9 commit/tree、逐路径blob和bundle。
2. **Test candidate**：exact2仅新增installed-preauthorization验收入口；不能产生GO。落地后必须冻结 exact2
   commit/tree及两份test的blob/mode/bytes/raw SHA。Node test只从对应只读Git物化树执行；Python test另以
   `INSTALLED_ACCEPTANCE_TEST`记录绑定安装字节。
3. **Installation preimage**：exact9仅供应不可变authority/broker/unit运行时字节；exact2仅供应冻结的
   `INSTALLED_ACCEPTANCE_TEST` 字节。两个runtime profile、含该唯一角色记录的installation manifest、root
   orchestrator与备份清单均须冻结完整身份。
4. **Administrator action**：root-owned备份、安装、daemon-reload、短暂socket activation、验收、stop/disable、回滚。
5. **Acceptance receipt**：closed inner/outer evidence、旧receipt不可跨nonce/request复用、TTL过期拒绝、真实
   service/cgroup身份与最终无残留证明；不新增nonce消费目录、lease或持久replay ledger。

任一层缺失都不得用后续层替代；静态测试不能冒充安装验收，服务启动也不能冒充authority GO。

## Exact2 TDD

1. RED：当前五项Python installed acceptance未覆盖preauthorization；Node测试没有真实installed broker入口。
2. Python GREEN：真实socket下执行preauthorization source request，证明controller/verifier真实运行、FD3/4/6、
   FD5与ambient credential不可见、18-case顺序和inner/outer receipt闭合。
3. Node GREEN：以临时本地bare remote、合成v2 approval和进程级Git rewrite运行真实
   `product-authority.m0.v1 --authorize`；rewrite只存在于临时测试仓，不修改用户/主仓配置。
4. 负向：旧manifest、错UID/GID、supplementary group、profile/digest、旧receipt跨nonce/request复用、
   TTL过期、approval/remote/source/FD漂移、
   forged receipt、setsid/double-fork/fork storm、caller终止与错误service/cgroup全部STOP并无残留。
5. 重跑focused、完整exact9回归、Harness、doctor、hook、V2、diff check及四审；只在全部GO后冻结exact2证据。

## Installation Preimage Freeze

Exact2落地后、任何系统写入前，先冻结 candidate commit/tree，以及
`scripts/product-authority.test.mjs` 与 `scripts/reference/test_chaotang_product_verifier_broker.py` 各自的Git blob、
`100644` mode、bytes和raw SHA-256。Node test必须只从与该commit/tree精确一致且clean的只读Git物化目录执行；
Python test才允许作为下述安装角色进入系统路径。
独立管理员随后在隔离临时目录构建并复算：

- `privileged-supervisor-ingest-v1` rootfs/manifest；
- `node-preauthorization-v1` rootfs/manifest，闭包固定Node与Python runner所需loader/libs，禁止用户cache与宿主`/usr`投影；
- installation manifest v1；兼容字段`exact4Commit/exact4Tree`必须绑定本轮landed exact9 commit/tree；并包含
  唯一`INSTALLED_ACCEPTANCE_TEST`记录，以现有closed字段精确绑定测试blob/mode/bytes/raw SHA；manifest v1不编码
  exact2 commit/tree，也不得声称manifest层能执行该绑定；
- 独立冻结的exact2 provenance record，精确绑定candidate commit/tree、测试path和`tree:path → blob`解析结果；
- root acceptance orchestrator；该orchestrator不得增加nonce消费目录、lease或持久replay ledger；
- 现有安装逐文件root-owned备份manifest。

所有manifest使用strict JSON、重复键拒绝、RFC8785和既有domain digest；所有rootfs只允许root-owned regular
file/directory，禁止symlink/hardlink/device/socket/FIFO、ACL/xattr/file capability及group/world writable。
Owner/Admin必须精确确认profile、installation manifest和orchestrator digest后，才可进入安装阶段。
每次验收前还必须先复核外部冻结的`exact2 commit/tree:path → blob`映射，再从该 landed exact2 Git blob
物化测试，并复核manifest文件身份记录及实际打开文件均精确匹配；旧exact9、
旧安装、donor或脏工作树测试字节一律fail-closed。

## Non-Production Acceptance

管理员步骤必须严格有序：

1. 复核实时remote仍等于exact2落地commit；Node test从该exact2 commit/tree的clean只读物化目录执行并核对
   blob/mode/bytes/raw SHA；从exact9 Git blobs物化authority/broker/unit，且只从exact2冻结blob物化
   `INSTALLED_ACCEPTANCE_TEST`，逐项复核installation manifest绑定。
2. 验证旧socket及全部template instance inactive/disabled；记录旧安装manifest和文件摘要，创建不可变备份。
3. 安装root-owned exact bytes、profiles和manifest；运行`systemd-analyze verify`，然后daemon-reload。
4. 只启动socket进行短暂验收；不enable。先证明普通用户、ingest、worker、root及错误controller均不能认证。
5. 跑legacy五项installed acceptance，再跑新preauthorization Python链和真实Node authority CLI链。
6. 注入setsid/double-fork/FD6/fork storm、disconnect、read stall、timeout、reply failure；逐条核对唯一unit、InvocationID、
   cgroup path/inode、inactive/empty与无FD6 holder。
7. 无论成功失败都stop/disable/reset-failed全部相关unit，复核socket删除、runtime/cgroup/proc清空。
8. 若失败，恢复备份、daemon-reload并再次证明inactive/disabled；保留证据，另立forward-only corrective successor。

## Verification Matrix

Future exact2：

```text
TMPDIR=/tmp TEMP=/tmp TMP=/tmp node --test scripts/product-authority.test.mjs
PYTHONDONTWRITEBYTECODE=1 TMPDIR=/tmp TEMP=/tmp TMP=/tmp python3 -m unittest scripts/reference/test_chaotang_product_verifier_broker.py
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node scripts/harness-doctor.mjs --check
node --test scripts/harness-doctor.test.mjs
node .agents/hooks/check-harness.mjs --self-test
node scripts/ext-full-value-convergence.mjs --check
node --test scripts/ext-full-value-convergence.test.mjs
git diff --check
```

Installed acceptance必须额外输出closed evidence，至少包含：repository/install/profile/orchestrator identities、pre/post
unit状态、每次connection的unit/InvocationID/cgroup、legacy与preauth测试计数、旧receipt跨nonce/request拒绝、
TTL过期拒绝、回滚结果、
`productionDeployment:false`。日志不得包含request source、receipt原文、nonce、PID、环境或凭据。

## Review And Stop

Governance检查权限分层和Owner checkpoints；Architecture检查exact2闭包、profile/install数据流及回滚；Code检查
测试入口不可进入production seam；Security检查credential、SO_PEERCRED、namespace/cgroup/FD、replay和日志泄漏。
任一P0–P2即NO-GO。

远端漂移、第三候选路径、产品/broker/unit修改需求、旧v1行为变化、stale/placeholder安装、非专用controller、
exact2 commit/tree/test blob身份或profile/manifest/orchestrator未冻结、`INSTALLED_ACCEPTANCE_TEST`记录或打开文件不匹配、
真实验收失败或任何残留立即STOP。不force-push、不生产部署、不删除旧备份。

## Current Round

本轮只编制三文件治理草案、执行strict JSON/Task/Harness/内部一致性检查并进行独立审查。不实施exact2，
不运行authority，不安装、不启动服务、不提交、不推送、不部署。

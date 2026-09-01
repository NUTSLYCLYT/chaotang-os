# Packet 14 — Exact30 Gate A Verification-Environment Corrective Successor

## Status

Draft

Governance state: `DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`.

Task ID: `PACKET-14-EXACT30-TRUSTED-ARTIFACT-DELIVERY-GATE-A-VERIFICATION-ENVIRONMENT-CORRECTIVE-SUCCESSOR-20260901`

## Product Definition

在 canonical `ext-dev@07bf7268ad8384bf55a147fcab7d6cfd483d457d` 上重新签发 P14 exact30 Gate A，仅纠正前序 approval 的确定性验证环境合同矛盾，不改变任何产品路径或候选字节。前序 machine authority 虽返回 `GO / APPROVED_FOR_ONE_CHILD`，但未形成本地产品 child；其 manifest 第 11 项在 `PYTHONNOUSERSITE=1` 下调用 `/usr/bin/python3 -m pytest`，而当前机器 pytest 只存在于用户 site，确定性在测试收集前报 `No module named pytest`。第 13 项又遗漏当前 `runtime_lock.py verify-candidate` 强制要求的 `--shard-count`、`--shard-index` 与 `--deadline-seconds`，确定性在参数解析阶段退出。

前序 authority 因此冻结为 `ABANDONED_AFTER_VERIFICATION_ENVIRONMENT_CONTRACT_STOP / NO_RETRY / NO_AUTHORITY_INHERITANCE`。前序 exact30 未提交工作区只作为 `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE` 保留。本 successor 使用既有 canonical runtime-lock 与 root-owned offline wheelhouse，按当前已落地契约执行 3 个 shard；不注入未声明 `PYTHONPATH`，不使用用户 site，不安装系统包，不联网，也不创建第二套 Python runtime authority。

Gate A 仍只允许形成、验证并冻结本地 exact30 产品字节，创建一次不可推送的直接单亲 `BYTE_DONOR_ONLY` child。不得运行本 task 的 machine `--verify-candidate`；固定终门仍返回 exit 86。Gate B、candidate-external supervisor、真实 release、Pilot 与部署仍是独立后继。

## Acceptance Criteria

- [ ] approval commit 是 `07bf7268…` 的直接单亲子，只包含本轮正式 approval、Task、Plan 三文件。
- [ ] 新 machine authority 只授权一个 direct child；旧 `07bf7268…` authority 不得重试、恢复、继承或 re-anchor。
- [ ] product child 精确修改前序 manifest 冻结的 30 条产品路径，结构 `30 MODIFY / 0 ADD`，模式全部 `100644`，无第 31 路径；machine gate 必须从 committed child 重算完整 bundle 与 parent-to-child full-index diff，分别精确等于冻结值。
- [ ] exact30 donor bundle 精确为 `sha256:27c544f37e9549d3a99f66ace498bccd8c3a8d5e2d94ce028773fe48b4be4882`；相对 `07bf7268…` 的 full-index diff 精确为 `sha256:6af72651a1da268e32f3c29af6642afcd496f6792eae4bb8817e787fb9da2e18`。
- [ ] 17 条 replay-safe 路径保持 donor raw/blob/mode/bytes；13 条 semantic 路径 byte-for-byte 等于本轮冻结 donor，不重新解释或顺手重构。
- [ ] runtime-lock 使用 `/var/tmp/chaotang-m0-wheelhouse`、`PYTHONNOUSERSITE=1`、`PIP_NO_INDEX=1`、`PIP_CONFIG_FILE=/dev/null`，固定 3 shards、每 shard `240s` 内部 deadline 与 `300000ms` 外部门限。
- [ ] gate 07/10 仅用隔离标准库机械证明九个 required nodes 与八个 focused 文件进入三 shard 闭合 inventory、Ruff 由 candidate venv 对 snapshot `app/tests` 执行；不得调用宿主 pytest/Ruff。三个 shard 索引必须精确为 `0/1/2`，共同实际执行完整 backend、required/focused 文件、collect-only、Ruff、安装 wheel/config 与插件/来源证明；任一 shard 失败即 STOP。
- [ ] 不允许未声明 `PYTHONPATH`、用户 site、系统包安装、在线 pip、选择器缩减、skip/xfail/todo 或测试门放宽。
- [ ] 前端依赖树前后仍为 22457 条、摘要 `sha256:5622646be4a6238728aa4a45553a46b41f63ca4bebc71cc05ada902aa4386fd8`；frontend tests/lint/typecheck/build 全绿。
- [ ] release、Harness、Doctor、authority regression、V2、diff check 与 manifest 00–98 全绿；99 固定 exit 86，不作为正向门。
- [ ] Governance、Python、TypeScript 与 Security 独立复审均无 P0–P2。

## Delivery Constraints

- Canonical base commit/tree：`07bf7268ad8384bf55a147fcab7d6cfd483d457d / b97e72ce033c930b7a1aade7703229274dad2909`。
- exact30 donor：`/home/ubuntu/Projects/chaotang-os/.worktrees/p14-exact30-trusted-artifact-delivery-gate-a-candidate-20260901`；必须保持不动、不暂存、不提交、不清理。
- historical donor：`/home/ubuntu/Projects/chaotang-os/.worktrees/p14-exact30-authority-current-20260824`；继续保持不动。
- proposed approval 只位于 `docs/migrations/2026-09-01-packet-14-exact30-gate-a-verification-environment-corrective-successor.approval.proposed.json`，不得作为 machine authority 输入或进入 approval commit。
- 不修改 runtime-lock、requirements lock、wheelhouse、Harness、authority、readiness validators、CI、系统 Python、用户 Python、Git/npm/pip 配置或真实数据。
- 不 merge、cherry-pick、rebase、force-push、Pilot、Release、发布或部署。
- 远端、base、donor、30 路径、模式、bundle、diff、wheelhouse 或 CLI 契约漂移立即 STOP，不得 re-anchor。

## Affected Modules

- 模块：P14 trusted-artifact exact30 Gate A 的验证环境合同与原产品范围。
- 允许路径：proposed approval 中 `request.productPaths` 的精确 30 条路径；不得修改治理之外的第 31 路径。
- 治理提交路径：正式 approval、本文 Task、对应 Plan 三文件。

## Technical Plan

1. 机械冻结前序 STOP：原命令 `PYTHONNOUSERSITE=1` 下 pytest 不可导入；原 runtime-lock 命令缺少三个强制参数。
2. 冻结前序 authority 为未消费、不可重试；冻结 exact30 当前字节为唯一 donor，记录 30 文件 raw/blob/mode/bytes、bundle 与 full-index diff。
3. 以当前 canonical runtime-lock 已落地的三 shard 契约替换全部失效的宿主 Python 执行命令；required-node 与 focused/Ruff gate 改为不导入宿主包的标准库覆盖合同证明，真实 required/focused 文件与 Ruff 仍由三 shard 的隔离 candidate venv 执行。machine 同时从 committed child 重算完整 exact30 bundle 与 full-index diff。其余 00–98 门、产品范围、前端离线依赖树、终止器 99 均保持语义不变。
4. 完成 strict JSON、duplicate-key rejection、Draft 2020-12 schema、`validateApprovalManifest`、`productTaskErrors=[]`、Harness/Doctor、canonical/raw/bundle 与独立复审。
5. Owner 精确确认 canonical digest 后，原字节物化正式 approval，创建并普通快进三文件 approval commit。运行 machine authority 前后都必须使用与 gate 00/98 相同的固定 transport：拒绝 local `include/includeIf`、`core.sshCommand`、`url.*.insteadOf`，屏蔽 global/system config，从 `/tmp` 对固定 `git@gitee.com:msxn/chaotang-os.git` 调用 `/usr/bin/ssh -F /dev/null`；任一步失败即永久 STOP，不得消耗后重试。
6. 从新 approval 创建唯一 candidate，byte-for-byte 重物化冻结 exact30；先做 working-tree 预检和四审，再创建一次本地 direct child。
7. 在本地 child 上执行 manifest 00–98；99 仅证明 Gate A acceptance 被固定阻止。不得运行 machine `--verify-candidate`，不得 push Gate A child。
8. Gate A 成功后另立 supervisor 与 Gate B successor，继续真实浏览器、Pilot 和可回滚 RC；仍不生产部署。

## Implementation Report

前序 exact30 已形成精确 30 条未提交修改，无第 31 路径；后端 focused `270 passed`，SQLite/readiness `98 passed`，release Node 回归与 required runner nodes 全绿，Ruff、py_compile、`git diff --check` 全绿。前端隔离 offline `npm ci` 后依赖树身份通过，frontend `726/726`、lint、typecheck、production build 全绿。

两项原始验证合同失败均发生在产品断言之前：后端全量命令因 `PYTHONNOUSERSITE=1` 后 pytest 不可导入退出；runtime-lock 命令因缺少 `--shard-count / --shard-index / --deadline-seconds` 以 exit 2 退出。独立审查进一步确认 required-node 与 focused/Ruff 子进程都会从 `/home/ubuntu/.local` 用户 site 导入，且旧草案没有把 13 条 semantic 最终输出机械绑定到冻结 donor。故本 successor 不再直接调用宿主 pytest/Ruff，并在 committed child 上强制复算完整 bundle/diff。当前机器已有 canonical 三 shard先例，runtime-lock 自身负责离线构建、安装、来源与 pytest 插件闭合。

## Acceptance Review

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`。本文件不宣称新 approval 已批准、exact30 已成为 candidate、P14 已完成或具备发布资格。任何范围扩大、旧 authority 继承、未声明依赖注入、完整矩阵失败或独立 P0–P2 都必须 STOP。

## Rollback

治理草案阶段只放弃未提交三文件。approval push 前只删除新的隔离治理/候选工作区（如另获明确清理授权）；不删除 donor。Gate A 本地 child 不推送。所有远端后续只能通过新的 forward-only 普通 fast-forward lineage 回滚，不改写历史。

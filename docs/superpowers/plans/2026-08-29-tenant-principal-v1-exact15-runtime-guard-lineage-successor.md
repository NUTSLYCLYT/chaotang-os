# Tenant Principal V1 Exact15 Runtime Guard Lineage Successor Plan

任务：`TENANT-PRINCIPAL-V1-EXACT15-RUNTIME-GUARD-LINEAGE-SUCCESSOR-20260829`

基线：`98428a17bf782f24c12b80a8c04568c85ea18f2f` / tree `baeb703c499a80fbae201549f07232eac7e8e988`

Approval RFC 8785 canonical digest：`sha256:b14bc90be745d3c1b9bde4489f0cc8404567f558f49011bf84a8822d6f9a4411`

状态：`PLAN_ONLY / NON_AUTHORIZING / EXACT15_FORWARD_ONLY_REISSUE`

## Goal

在已落地的 runtime-lock exact2 上，逐字节保留 Tenant Principal V1 exact15 完整产品价值，并用最新主线的唯一 one-child authority、第一方 candidate wheel、完整 backend 和独立审查重新建立可提交、可复算、不可冒认的候选身份。

## Frozen DAG

`b6ac2555 old exact15 approval (STOP, no child)` → `11151f16 runtime-lock prerequisite approval` → `e5fc5595 runtime-lock corrective approval` → `98428a17 runtime-lock exact2 product` → `new exact15 approval` → `new exact15 candidate`。

`1e7a5efe` exact14 authority 与 `b6ac2555` exact15 authority 均未被产品 child 消费，现已 abandoned/reissue-only；任何旧 nonce、测试、review、candidate 或通过身份不得跨 DAG 边继承。

## Exact Scope

产品范围精确为 Task 的十五个既有 `100644` 文件，最终结构 `15 MODIFY`。donor bundle 固定为 `sha256:cd217691fed12076033fd2d17153c9fc7f5280d7051666aae383dfd9e9ce01f5`；manifest 的机器结构门钉住每个最终 Git blob。

从 `b6ac2555` 到 `98428a17` 的八条 changed paths 只属于 runtime-lock exact2 治理与实现，与 exact15 范围零重叠。因此 donor 可作为字节来源，但不能作为 candidate、验证或 authority 来源。

## RED/GREEN Contract

1. 新 candidate 工作区基于新 approval commit。
2. 先重物化前十四 donor，保留 `backend/tests/test_daily_memorial_storage.py` 的新基线字节，运行冻结目标节点；只有业务 UPDATE 故障注入缺失导致的断言失败才是有效 RED。
3. 重物化第十五 donor blob 后，目标节点和 strict schema-drift 负例必须 GREEN。
4. import、依赖、metadata、临时目录、网络或 wheelhouse 错误均归类环境失败，不得冒充产品 RED/GREEN。

## Verification Matrix

1. exact15 focused 测试与 exact15 路径 Ruff。
2. machine verifier 三路 shard：每路从 committed/clean candidate snapshot 构建唯一第一方 wheel，离线安装，验证分发元数据、导入来源、完整 pytest 分片与 Ruff。
3. candidate exact15 path/status/mode/blob 结构门与 `git diff --check`。
4. root Harness、Harness self-test、Doctor、hook self-test、`TMPDIR=/tmp` authority regression、V2 check/tests。
5. Python Review：事务、租户身份、API 边界与错误语义。
6. Security Review：客户端 tenant 注入、fail-closed drift、secret/生产数据与身份边界。
7. Database Review：同一事务 rollback、schema-v6、backup/史馆迁移和并发语义。

## Frozen Sequence

1. 严格校验三文件治理包并完成三路只读审查。
2. 远端仍为 `98428a17…` 时创建/推送唯一三文件 approval commit。
3. 运行本任务 machine authorize；非 GO 即 STOP。
4. 新建唯一 candidate 工作区，按 RED→GREEN 顺序重物化 donor。
5. 完成 focused、Ruff、根级矩阵与三路独立审查，冻结 raw/blob/mode/bytes/bundle/diff/evidence。
6. 创建唯一 exact15 candidate commit。
7. 运行 machine verify-candidate；三路 shard 或任何结构/根级门失败即 STOP。
8. 远端仍为 approval commit 时普通 fast-forward push candidate。
9. 回报最终 remote SHA/tree 与证据；不部署。

## Safety Negatives

- 客户端 request body、cookie 或 session 不能伪造 tenant principal。
- 旧数据库缺字段、额外字段、错误类型或 drift 必须 fail-closed，不得静默修复。
- daily memorial INSERT 后 UPDATE 失败必须在同一真实事务整体回滚。
- backup、史馆、readiness 与 scheduler 不得跨租户泄漏或接受默认全局身份。
- old exact14/exact15 nonce、authority、candidate、测试和审查不可恢复或复用。
- 验证不得联网、读取生产数据、持久修改系统/Git/Python/Node 配置或绕过 hooks。

## Non-Goals

不做多租户切换、邀请/团队 UI、SSO、奖励或 Qualified Use、公开分享、前端改造、发布、Pilot、部署，也不修改 runtime-lock、Harness、authority、CI、ADR 或 exact15 外产品路径。

## Stop Conditions

远端漂移、机器 STOP、donor 漂移、第十六路径、mode 变化、schema 或安全门需放宽、wheel 验证失败、任何测试失败或独立审查 P0–P2，立即停止。exact15 完成并由 Owner 确认前，不进入《朝堂能力协议 V1》产品实施；其后也只允许先做独立只读规划。

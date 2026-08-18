# 任务：RC1 上线阻断验证环境纠正 V1

> Task ID：`RC1-RELEASE-BLOCKER-VERIFICATION-CORRECTIVE-V1-20260817`

## Status

Draft

## Problem and frozen evidence

已落地 approval `639e8186790877898d2883be58fd41894ea45ea3` 产生了干净、精确23路径的本地候选
`dd28a1c133f0c0327086ded8006998d22163f1bd`（tree
`a274c2356b66928cdb73ce9002a07918a75036f5`，binary patch SHA-256
`f292ad2480236fc1bca9de58f760acb15f07a2a0075edbd6b8a50cb8b92ec4cb`）。该候选的精准后端
55项、Ruff、deployment 38项、release tools 59项、product-authority 12项与根 Harness 146项通过；但 M0
最终验证返回 `STOP / VERIFICATION_FAILED`。

精确复跑 `/usr/bin/python3 -m pytest -q` 得到 `4089 passed / 4 skipped / 5 failed`。五个失败全部来自
源码 checkout 没有 `chaotang-os-backend` installed distribution metadata，而候选按 RC1 安全合同让
`/health` 对 metadata 缺失失败关闭。原 M0 命令既不安装 wheel，又要求全量测试成功，和同一 approval 的
installed-metadata-only 合同矛盾；不得以恢复 `0.0.0`、读取 `pyproject.toml` 作为运行时回退、测试条件分支或
修改范围外既有 health 测试来伪造通过。

## Product Definition

本纠正只替换 RC1 的机器验证入口，不改变 RC1 产品范围或用户行为。未来单亲候选仍严格修改原23条
`productPaths`，以旧本地候选作为逐文件重包来源；其中 `backend/tests/test_runtime_lock.py` 增加一个受控 CLI：

1. 在全新、权限0700、仓库外临时目录中，从当前 checkout 的 `app/` 与 `pyproject.toml` 构建一个最小、合法、
   确定性的本地 wheel；不得调用 build isolation、registry、网络或浮动依赖解析。
2. 使用固定 `/usr/bin/python3 -m pip install --isolated --no-index --no-deps --no-cache-dir --target <temp>`
   安装该 wheel；wheel 参数只能是已复核的本地绝对路径。
3. 证明 wheel metadata 的 distribution name/version 精确等于冻结项目 identity，并证明 `/health` 从 installed
   metadata 取值；源码 `pyproject.toml` 只在构建 wheel 时作为构建输入，运行时仍不是第二版本事实源。
4. 父 runner 与 child pytest 都使用 `/usr/bin/python3 -I -B`；runner 在加入第三方 roots 前必须只依赖
   Python 标准库，现有 `packaging` 等 import 延迟到 pytest 路径。child cwd 是仓库外的新临时目录，清除
   `PYTHONPATH`、proxy/index/PIP 配置。只可在拒绝 worktree、`.pth`、
   `app/` 与 `chaotang_os_backend*.dist-info` 后，将现有第三方 dependency roots 作为尾部 import roots；安装目标
   必须是唯一候选 package root。
5. 在 pytest collection 前断言 `app.__file__`、`find_spec("app")`、distribution metadata path 与 version 全部
   落在临时安装根，且 `sys.path` 不含 worktree；任一源码 checkout 或其他 metadata 遮蔽立即失败。
6. 两个 manifest 命令必须对所有 tracked `backend/tests/**/test_*.py` 建立排序固定、无重复、无遗漏的 1/2 与
   2/2 分区；新增、删除、重复、无法收集、空 shard 或集合漂移均失败关闭。
7. runner 前后同时冻结 Git tracked/untracked/ignored 状态，并递归记录 `backend/app`、`backend/tests`、
   `pyproject.toml` 与 lock 输入树的所有目录、regular file、mode、size 和 SHA-256；ignored `__pycache__` 或既有
   ignored 目录内字节变化也必须被发现。任一构建、安装、metadata、pytest、快照或清理失败均非零退出。
   临时 wheel、安装树、缓存与 subprocess 必须在退出前清理，不得写工作树、用户 site-packages 或生产目录。

选择复用已批准的 `backend/tests/test_runtime_lock.py`，不增加第24路径。它已经拥有 runtime lock、build metadata
与离线安装验证职责；另建 runner 会制造第二验证事实源和不必要的范围扩张。

## Preserved RC1 contract

- 原任务 `RC1-RELEASE-BLOCKER-REMEDIATION-V1-20260817` 的完整 toolchain policy、digest
  `sha256:75054d6dc6737ff20eab02ad0a6b67ff7b64250676e9ad5087187548d50fe268`、23路径、发布/备份/
  loopback-only/离线 bundle/扫描与外部验证要求全部保持。
- `/health` 只信 installed distribution metadata；缺失或不匹配继续失败关闭。
- M0 仍不使用 Docker、真实 registry/scanner、业务/provider 网络、生产路径、secret、push 或 deploy。
- RC1 的 disposable-host 真实构建、扫描、1+10轮和独立审查仍是候选接受前置条件；本纠正不生成或伪造这些证据。
- P0 合同分诊、readiness 过渡、六部、庄园与双编排继续暂停。

## Acceptance Criteria

- [ ] 新 approval commit 是 `639e818…` 的精确单亲子，且只含本 manifest 的三份治理文件。
- [ ] `productPaths` 与原 RC1 manifest 字节级相同、排序固定、恰23条；第24路径立即 STOP。
- [ ] 先有 RED：未安装 metadata 的原全量命令稳定复现五个失败；再有 GREEN：两个 installed-wheel shard
  合计覆盖全部 tracked 后端测试且全部通过。
- [ ] runner 拒绝网络参数、代理继承、build isolation、依赖解析、非空/软链临时根、错误 wheel metadata、
  源码/worktree import、候选 metadata 遮蔽、shard 重复/遗漏、bytecode/工作树写入、用户 site 写入和残留
  进程/目录。
- [ ] health 精准负例继续证明 metadata 缺失失败，不允许 runtime fallback。
- [ ] 原 RC1 的其余精准、Ruff、deployment、release tools、authority、Harness 与全量矩阵重新通过。
- [ ] 最终 M0 `--verify-candidate` 在精确候选上返回 `PASS / canAcceptProductCandidate=true`；历史
  `dd28a1c…` 的结果不得继承。
- [ ] Code、Python、Security 与 Release/Operations 独立审查无 High/Critical；修复后重新验证。

## Delivery Constraints

- Base：`639e8186790877898d2883be58fd41894ea45ea3`
- Base tree：`e3c2449dd8b28b09a6694230802df934e6241167`
- Corrective manifest RFC8785 digest：
  `sha256:fd9a97e71e3a91af6ecde93efec09483b4f8f5cdd78524ff713a76b39102571a`。
- 本阶段只允许 manifest 的三条 `approvalCommitPaths`。
- 历史本地候选 `dd28a1c…` 仅作重包来源，不得 amend、push、merge 或宣称已接受。
- 新 approval landed 后，从该 SHA 建立干净产品席位，按23路径重新形成唯一单亲候选；不 merge/cherry-pick
  旧候选提交，只做逐文件摘要受控重包。
- 未经 Owner 对精确 approval/candidate SHA、tree、parent、paths、digest 分别授权，不得 commit 或 push。
- 本任务不授权 disposable host、build-time egress、真实容器/扫描、部署、生产写入或 P0 恢复。

## Affected Modules

- 模块：RC1 runtime-lock、installed-wheel 后端验证入口与 M0 验证矩阵。
- 允许路径：manifest 冻结的原 RC1 精确23条 `productPaths`；不得出现第24路径。
- 治理事实源：本任务、配套计划与 M0 approval manifest。
- 未来产品实现：纠正行为只落在已批准的 `backend/tests/test_runtime_lock.py`。
- 只读依赖：`backend/pyproject.toml`、`scripts/product-authority.mjs`、原 RC1 task/plan/approval 与历史候选
  `dd28a1c…`。

## Technical Plan

按配套计划执行：先以失败全量建立 RED，再在现有 runtime-lock 测试路径内实现临时 wheel 构建、离线安装、
metadata 校验与两个确定性 shard；随后受控重包原23路径，完成完整 RC1 矩阵、外部验证与独立审查。

## Implementation Report

- 当前治理文件：三份 staged 草案。
- 产品实现：未开始。
- 历史候选：`dd28a1c…` 保持只读、未推送。
- 外部动作：未 commit、未 push、未部署、未运行真实容器或网络验证。

## Acceptance Review

当前结论：`APPROVAL_PACKET_DRAFT / PRODUCT_IMPLEMENTATION_NOT_STARTED / OWNER_CONFIRMATION_REQUIRED`。
Harness、manifest schema/digest 与独立治理复审全部通过前，不得请求 approval commit 授权。

## Current handoff

当前仅准备三份未提交治理文件。产品候选、远端、运行环境和生产均未修改。

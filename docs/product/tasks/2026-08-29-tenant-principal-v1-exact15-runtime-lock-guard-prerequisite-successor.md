# Tenant Principal V1 Exact15 Runtime-Lock Guard Prerequisite Successor

任务 ID：`TENANT-PRINCIPAL-V1-EXACT15-RUNTIME-LOCK-GUARD-PREREQUISITE-SUCCESSOR-20260829`

冻结基线：`origin/ext-dev@b6ac2555cb8bd0a279d91eef06c2c26ff3b57ecc`

冻结 tree：`49f7e16a9842435978aba6a5dc1311916a3e1524`

Approval RFC 8785 canonical digest：`sha256:6a5375457cb83e9ba3178944e2bb819b563eb782b7bd800e04536b6b52a5b27a`

## Status

Draft

细分状态：`DRAFT_NON_AUTHORIZING / PROTECTED_VERIFIER_PREREQUISITE / READY_FOR_OWNER_CONFIRMATION`

前序 exact15 产品 authority 虽曾返回 `GO / APPROVED_FOR_ONE_CHILD`，但未产生产品 child、未运行最终 `--verify-candidate`、未推送产品候选。独立安全审查确认验证器存在确定性缺口后，该 authority 进入：

`ABANDONED_AFTER_INDEPENDENT_REVIEW / UNCONSUMED / REISSUE_REQUIRED / NO_VERIFY / NO_PUSH`

现有 exact15 十五路径工作区仅为 `UNCOMMITTED_BYTE_EVIDENCE_ONLY`，必须保持不动；本任务不消费、恢复、继承或 re-anchor 前序 authority、candidate、测试或审查身份。

## Product Definition

本任务是 exact15 之前的最窄受保护验证器前置修复。它只纠正现有 `runtime_lock.py verify-candidate` 的两个 fail-open 证明缺口：

1. 私有验证目录的父级 `/tmp` 未机械要求为真实、canonical、sticky `01777` 的可信 POSIX 临时根；
2. 候选身份 guard 被写入 pytest 测试树的 sibling `conftest.py`，在当前 `--confcutdir` 下不会被加载，却可能产生伪绿。

修复必须继续复用唯一 runtime-lock、唯一 product authority、同一离线 wheelhouse 和同一候选事实源；不得创建第二套 verifier、Harness、authority、依赖锁或持久化系统。

## Affected Modules

- 模块：Python candidate wheel 验证器与其闭合回归测试。
- 允许路径：`backend/app/operations/runtime_lock.py`, `backend/tests/test_runtime_lock.py`。
- `runtime_lock.py`：只允许闭合可信 `/tmp`、显式 pytest guard 加载、guard attestation、分发及插件枚举。
- `test_runtime_lock.py`：只允许加入对应真实 RED、负向和 self-hosted 回归。
- exact15 产品路径、锁文件、wheelhouse、pyproject、Harness、authority、API、数据库与发布模块均不受影响。

## Security Contract

### Trusted temporary root

`secure_work_root()` 必须在创建任何子目录前对父 `/tmp` 执行 `lstat`，机械要求：

- `resolve(strict=True) == Path('/tmp')`；
- real directory，非 symlink；
- mode 精确为 `01777`；
- owner 只能是 root UID `0` 或当前 namespace 的 kernel overflow UID；
- verifier 执行者必须同时拒绝 root UID 和 kernel overflow UID；
- 任一条件不满足立即 fail-closed。

私有子目录仍必须由当前非 root 执行者以 `0700`、单一目录身份创建并在使用期间绑定 inode/device；不得持久修改系统临时目录。

### Candidate guard

候选 guard 必须作为 test venv `site-packages` 中的显式模块，以 `-p chaotang_candidate_guard` 加载，并设置 `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1`。不得依赖 sibling `conftest.py` 自动发现。

guard 必须在 `pytest_sessionstart` 重新验证：

- 源工作树未进入 pytest `sys.path`；
- `app` 实际从 staged candidate wheel 导入；
- `chaotang-os-backend` metadata 版本精确为 `0.1.0`；
- wheel digest、candidate commit/tree 和工作树 clean 身份未漂移。

guard 必须以 `O_CREAT|O_EXCL` 创建 UTF-8 canonical JSON attestation；字段至少冻结 `schemaVersion`、candidate commit/tree、wheel digest、实际 app path、distribution/plugin 摘要和 `status`。可信外层在 pytest 自然退出后验证 attestation 的普通文件、owner、mode、单链接、精确 canonical bytes 和预期身份。缺失、重复、被替换或字节漂移均 STOP；只写静态 `PASS` 不得通过。

### Distribution and plugin closure

test venv installed distributions 必须精确等于 lock 的 `RUNTIME|TEST` 闭包加唯一 candidate distribution；不得存在 lock 外分发。pytest 第三方 entry point 必须机械枚举并记录，autoload 保持关闭；只显式加载冻结 guard。任何额外显式插件、路径泄漏或候选 metadata 漂移均 STOP。

## Technical Plan

1. 创建并独立审查本三文件治理包；approval 未落地且 machine authority 未 GO 前不得修改 exact2。
2. 在 `test_runtime_lock.py` 先形成真实 RED，证明不可信 `/tmp`、未加载 sibling guard、缺失 attestation、额外 distribution/plugin 和身份漂移会被旧实现错误接受。
3. 仅在 exact2 内最小修复 `secure_work_root()` 与 `verify_candidate()`；不改锁、wheelhouse、pyproject、产品测试选择器或业务代码。
4. 由 self-hosted verifier 在它创建的同一 hash-locked test venv 中先运行 targeted runtime-lock，再运行完整 backend/Ruff；随后运行 Harness、Authority regression、V2 convergence 和 `git diff --check`。不得依赖宿主 Python 的 pytest。
5. 进行独立 Python 与 Security Review；任一 P0–P2、第三路径或机器 STOP 均终止。
6. 只有 machine `--verify-candidate` PASS 后才允许普通 fast-forward 推送 exact2 candidate；禁止 force-push、部署、发布和 Pilot。
7. exact2 落地主线后，基于最新 ext-dev 全新签发 exact15 successor；其产品字节必须采用 c471 的严格十四 blob 加已冻结 daily 单文件，不继承当前失效 exact15 身份。

## Acceptance Criteria

- [ ] approval commit 是 `b6ac2555…` 的直接单亲子，只含本任务三份治理文件。
- [ ] exact2 candidate 只修改 `runtime_lock.py` 与 `test_runtime_lock.py`，均为 `M / 100644`。
- [ ] 不可信、非 sticky、非 canonical 或 owner 非闭合的 `/tmp` 均 fail-closed。
- [ ] pytest guard 通过显式 `-p` 加载，autoload 关闭，且外层可证明 attestation 确实生成并未漂移。
- [ ] source-root leakage、错误 app origin、metadata、wheel digest、commit/tree/clean 漂移均 fail-closed。
- [ ] installed distribution 集合与 lock 加 candidate 精确闭合，未授权显式 plugin 被拒绝。
- [ ] runtime-lock targeted 与完整 backend/Ruff 均在同一自托管 hash-locked candidate wheel 环境通过；Harness、Authority regression、V2 与 diff check 全绿。
- [ ] Python 与 Security Review 均为 `GO / P0=0 / P1=0 / P2=0`。
- [ ] machine verify-candidate PASS 后才可普通快进推送；不得部署、发布或 Pilot。

## Delivery Constraints

- 只有一个产品字节写入者；reviewer 全程只读。
- approval 与 exact2 product 必须是两个连续、单亲、范围精确的提交。
- 远端离开冻结基线、需要第三条产品路径、需要修改 Harness/authority/lock/wheelhouse/pyproject 或任一验证失败时立即 STOP。
- 仅允许进程级 `TMPDIR=/tmp TEMP=/tmp TMP=/tmp`；不得持久修改系统、用户、Git、Python、pytest 或 Node 配置。
- 所有构建和测试离线；不得访问 provider、secret 或生产数据。
- 禁止 merge、rebase、fetch、pull、force-push、Pilot、Release 或部署。

## Implementation Report

只读复核已确认：现有 verifier 将 guard 写入 `work/pytest-root/conftest.py`，而测试位于 sibling `test-venv/candidate/repository/backend/tests`，并指定 `--confcutdir staged_backend/tests`；该 guard 不在 pytest 的 conftest 发现链上。现有 `secure_work_root()` 只校验私有子目录，没有闭合父 `/tmp` 的 sticky/owner 合同。该事实使前序 exact15 的完整矩阵不能成为可信候选证据。

前序 exact15 另有 donor 身份矛盾：当前工作区四条非 c471 字节不具有闭合来源。后续 exact15 reissue 只保留 c471 的严格十四 blob，以及从冻结工作区读取的 daily 单文件 `4cf9c04e…`；不得混入四条漂移字节。

## Acceptance Review

当前为非授权治理草案。待 approval、machine authority、exact2 RED→GREEN、完整矩阵、独立双审与 machine verify-candidate 全部完成后，记录最终 candidate SHA/tree/evidence。任何旧 exact15、exact14 或 c471 的 authority、candidate、验证与审查身份不得继承。

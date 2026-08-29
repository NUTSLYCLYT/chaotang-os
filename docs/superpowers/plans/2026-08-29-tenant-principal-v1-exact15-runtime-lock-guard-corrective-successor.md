# exact15 Runtime-Lock Guard Corrective Successor Plan

## Goal

在不修改 authority/schema/Harness 的前提下，将 runtime-lock 候选验证修成真正 pre-conftest fail-closed、可回收完整进程树，并把完整 backend 分成三个机器可验证、全集闭合、每项远低于 300 秒的串行 shard，为 exact15 新 successor 提供可信前置门。

## Frozen Base

- commit: `11151f1618aa2a7a216fccaa59b1764916a55ae5`
- tree: `77b723ce7161171e30590a6e705e0fc4e9859c66`
- predecessor authority disposition: `ABANDONED_BY_OWNER_UNCONSUMED / REISSUE_REQUIRED`
- predecessor candidate: `UNCOMMITTED_BYTE_EVIDENCE_ONLY / NO_IDENTITY_INHERITANCE`

## Scope

- `backend/app/operations/runtime_lock.py`
- `backend/tests/test_runtime_lock.py`

结构固定 `0 ADD + 2 MODIFY`，模式固定 `100644`。

## Red Matrix

1. candidate conftest 在 trusted hook-wrapper pre-yield 后注销 guard、伪造 pre/post attestation或抢发第二次 ready。
2. candidate conftest 或显式 `pytest_plugins` 注册外部 module 与 plugin object。
3. source-root 或其任意子路径进入 pytest import path。
4. same-UID 在 ACK 前后替换 attestation inode/bytes。
5. pytest child 生成 grandchild 后分别在 no-ready 与 post-ACK 阶段超时，验证整组后代全部退出。
6. Popen 构造失败后验证所有 pipe FD 已关闭。
7. shard count/index 越界、test-file 或 collected/executed nodeid inventory 缺失、重复、unexpected、非法重排或第三 shard 未运行。
8. 内部 240 秒 deadline 必须先于外层 300 秒触发，并在退出前完成整组清理。

## Green Design

1. guard 的同一个 try-first `pytest_load_initial_conftests` hook-wrapper 在 pre-yield 与 post-yield 分别产生独立 O_EXCL attestation、ready/ACK和parent-held FD；post-yield 核对 guard仍注册、唯一冻结 conftest和完整 active plugin，不依赖可被注销的 sessionstart。
2. parent 对两份 attestation 分别在 ACK 前校验并持有 inode/FD，直至测试结束后复核 bytes与identity；任一 phase/path/FD/ready 次数不精确即 STOP。
3. 所有子进程以独立 session/process group 启动。全流程 deadline固定240秒；任何启动失败、deadline、信号、握手、测试或清理异常均关闭pipe FD，TERM→有界wait→KILL→有界wait并确认无存活后代。
4. inventory来源固定为 candidate commit tree 中 `100644 backend/tests/test_*.py` 顶层文件，预计139条；`paths=sorted(paths)`、`shard_i=paths[i::3]`。file preimage是 `{path,mode,blob}` canonical array；nodeid preimage是pytest收集顺序string canonical array；全部RFC8785+SHA-256。
5. 每个 invocation 重算全部三片与全集闭合，先全量 collect-only，再执行自己的file shard；冻结 collected与terminal nodeid count/digest/outcomes并证明一一闭合。terminal outcome固定键为`passed/skipped/xfailed/xpassed/failed/error`，在`pytest_runtest_logfinish`后按collection顺序、每nodeid一次归并，优先级`error > failed > xpassed > xfailed > skipped > passed`。三片机器命令依次0/1/2；Owner批准三个machine entry（每个含targeted、collect-only、shard三个pytest子进程及Ruff）的新拓扑。冻结 conftest raw `sha256:958ba53433b0c8994f3dc8254bc3953c8c3fd0b130d372f4f40f6246cbaebd15` 且不得含session fixture/collection mutator。
6. 每个 shard 重跑 targeted runtime-lock 与 exact2 Ruff；targeted重复不计入shard duplicate。三个 shard各自外层上限300秒、内部全流程deadline240秒，不修改authority/schema。

## Verification Matrix

1. exact2 targeted RED/GREEN 与 Ruff。
2. `/tmp` 隔离 direct-child diagnostic commit 先运行一次单进程 backend-full parity gate，再执行两轮冷启动 shard 0、1、2；每片最大 wall time `<=240s`。
3. 三 shard test-file与actual nodeid集合差均为：`missing=0 / duplicate=0 / unexpected=0`；冻结full/shard file与nodeid count/digest/outcomes。
4. `node scripts/check_harness.mjs`
5. `node scripts/check_harness.mjs --self-test`
6. `node scripts/harness-doctor.mjs --check`
7. `node .agents/hooks/check-harness.mjs --self-test`
8. `TMPDIR=/tmp TEMP=/tmp TMP=/tmp node --test scripts/product-authority.test.mjs`
9. `node scripts/ext-full-value-convergence.mjs --check`
10. `node --test scripts/ext-full-value-convergence.test.mjs`
11. `git diff --check`
12. 独立 Code Review、Python Review、Security Review，任一 P0–P2 为 NO-GO。
13. committed/clean candidate 上运行 machine `--verify-candidate`；PASS 后再次核验远端仍为 approval commit，普通快进推送。

## Stop Conditions

- remote 不再等于冻结 approval 基线；
- 需要第三条 candidate path、修改 authority/schema/Harness/lock/wheelhouse；
- shard 缺失、重复、动态选择不闭合或单项耗时无安全余量；
- pre-conftest 攻击、plugin 注入、source leakage、attestation replacement 或 descendant cleanup 任一负向未形成真实 RED→GREEN；
- 任一验证失败或独立审查 P0–P2；
- machine authority/verify STOP。

本计划不授权 Pilot、Release、发布或部署。

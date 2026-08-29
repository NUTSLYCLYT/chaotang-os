# Tenant Principal V1 Exact15 Authority Lineage Successor Plan

任务：`TENANT-PRINCIPAL-V1-EXACT15-AUTHORITY-LINEAGE-SUCCESSOR-20260829`

基线：`1e7a5efed79c17b51010eac36d104c6229bb3de5` / tree `e310d950c57e87c43e7af777b960cc66cd05dbb6`

Approval RFC 8785 canonical digest：`sha256:d606a96dca6c1d0db344509987dd82ff3bcadf7717b416719cd1adb58e0b7df2`

状态：`PLAN_ONLY / PRODUCT_STOP / AUTHORITY_LINEAGE_SUCCESSOR`

## Goal

保留 Tenant Principal V1 exact14 的逐字节实现，只纠正一个与严格 schema drift 合同冲突的旧测试故障注入，并在精确临时 POSIX 环境中重新建立 exact15 的机器证据。

## Lineage Migration

本计划只接受 `63195b81 → ecda2215 → f6b56719 → 80add8db → 1e7a5efe` 的精确单亲 lineage。前三次增量只触及 Tenant readiness prerequisite 三份治理文件、其 Task 修正以及两条 validator 路径；最后一次只新增 exact14 successor 三份治理文件，全部与 exact15 产品路径零重叠。旧 corrective 草案和未提交 exact14 工作树仅为 byte donor，禁止 re-anchor 或继承 approval、authority、candidate、测试与审查结论。`1e7a5efe` 的 exact14 one-child 已由 Owner 明确标记为 `ABANDONED_BY_OWNER_UNCONSUMED / REISSUE_REQUIRED / EXACT15_PRIORITY`。

任何后续远端移动都使本计划立即 STOP；不得再次静默迁移基线。

## Frozen Sequence

1. 从实时未漂移 `origin/ext-dev@1e7a5efed79c17b51010eac36d104c6229bb3de5` 创建只含本 successor 三份新治理文件、且为其直接单亲子的 approval candidate。
2. 独立审查治理范围、供体 blob、临时环境和验证矩阵；P0–P2 即 STOP。
3. 生成 canonical digest，验证三文件/单亲结构，创建本地 approval commit；远端再次等于基线后普通 fast-forward push。
4. 运行 machine `--authorize`；非 GO 即 STOP。该步骤不得消费已放弃的 exact14 authority，只能授权本 exact15 successor。
5. 从 c471 逐 blob 物化 exact14，保持第十五测试原样，运行目标测试并记录预期 RED：严格 drift 检查先于含 trigger 的业务路径。
6. 只在 `backend/tests/test_daily_memorial_storage.py` 中将 trigger 注入替换为连接/执行层定点失败；不触碰生产路径。治理阶段不预造 target blob；真实 GREEN 后再冻结该文件 blob、patch与证据。
7. 运行目标 GREEN、严格 schema drift 负例与 focused exact15。
8. machine 首项由 `/usr/bin/python3 -I` 在全新 nonce root `/tmp/chaotang-t0-exact15-49d671a2eb064f80b5c3a27891de604f` 内建立环境；root 预先存在即 STOP，不得删除重建。机器验证 root-owned wheelhouse、lock self digest、pyproject digest、TEST projection、60 项精确 installed set、pytest entry points、RECORD 文件和四个临时环境变量。
9. 运行 manifest 的 full pytest、ruff、candidate structure、diff、Authority、Harness、Doctor 与 convergence 完整矩阵。
10. 分别进行 Python、安全、数据库独立审查；任一 P0–P2 重开 RED/GREEN 并使旧证据失效。
11. 创建恰好一个 exact15 product candidate commit，运行 machine `--verify-candidate`；PASS 后确认远端仍等于 approval commit，再普通 fast-forward push。
12. 回报最终 remote SHA/tree、approval digest、evidence digest、测试数字和未验证范围。禁止部署、发布与 Pilot。

## RED/GREEN Contract

RED 必须由 unchanged 第十五测试与 c471 exact14 的真实冲突产生；import、TestClient、依赖或临时目录错误都属于环境错误，不得充当 RED。

GREEN 的故障注入必须在已通过严格 schema 校验之后，仅令目标连接的业务 UPDATE 执行失败，并使用同一真实 SQLite 事务证明前序 INSERT 和 run 状态更新均回滚。测试不能创建 trigger、table、index、view 或其他 schema 对象，也不能 monkeypatch/关闭 schema validator。

## Environment Build Contract

构建只发生在 `/tmp`：

1. 旧 `/tmp/chaotang-t0-exact15-20260829` 与误触的 `/tmp/chaotang-t0-exact15-d4a91c2f7e6b4380a5c9e1f274b68d30` 仅为被拒绝诊断证据，不删除、不复用；本地预验另用 diagnostic nonce，绝不触碰 machine nonce root。
2. machine 首项先证明 `/tmp` 是 root-owned `01777` POSIX real directory；machine nonce root 必须不存在，再以单次原子 mkdir 创建 `0700`，禁止 bootstrap 删除任何既有 root。
3. 由 `/usr/bin/python3 -I` 调用现有非 root wheelhouse permissions verifier，复算 lock self digest、pyproject digest、TEST projection和 wheel bytes，再以冻结四参数 `prepare-install --lock --wheelhouse --pyproject --output-dir` 生成 requirements。
4. 验证 `test.txt` SHA-256 为 `15a890d4fcac9a1eb4f9654e0b795728d462b3801c40bb7c64f908c0894d6b69`。
5. 用 `venv --without-pip` 创建环境，由受控 system pip `--python <venv>` 离线、hash-locked、no-deps 安装 TEST closure。
6. 在任何测试前验证 interpreter/venv identity、realpath/uid/mode/no-symlink、精确 60 distributions、冻结 pytest entry points、逐 RECORD 内容和临时目录读写截断删除；pytest 禁止 plugin autoload。
7. 每个 pytest/ruff 与 Authority regression 进程只接收冻结 `PATH/TMPDIR/TEMP/TMP`；任一 mismatch 即 STOP。

## Review Questions

- Python：包装连接是否保持同一事务和真实 rollback，且只在目标 UPDATE 失败？
- Security：测试是否保留 fail-closed drift 边界，是否意外读取 secret、真实库或宿主配置？
- Database：是否没有 schema mutation，回滚断言是否覆盖 insert 与 run，两者是否由同一连接/事务证明？

## Evidence Boundary

通过本任务只证明 Tenant Principal V1 exact14 在纠正后的验证合同与精确 POSIX 环境中通过。它不授予旧 c471 候选身份，不证明分享/奖励链，不授权部署、发布、Pilot 或任何生产数据动作。

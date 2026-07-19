# 任务：fix-p6-residual-test-closure-20260718

## 任务 1：恢复最小回归护栏

- 目标：让 roster、钦天监端点隔离和 legacy telemetry 行为有确定性回归证据。
- 前置条件：基点锁定 `bf7d4cc`；Claude P0 拆包审查 GO。
- 输入：经审查允许保留的 3 个测试 diff。
- 输出：3 个目标测试文件，定向 4 passed。
- 涉及文件：`backend/tests/test_{persona_registry,tianjian_verdict,legacy_router_telemetry}.py`。
- 状态 / 数据变化：仅测试；无生产状态变化。
- 验证命令与证据：见 `ci_result/ci_summary.md`。
- 回滚边界：撤销这 3 个测试文件差异。
- 完成定义：基线 RED 留证，候选 GREEN 4 passed。

## 任务 2：核销已知红灯台账

- 目标：让顶部计数、逐行状态、当前全量结果和保守边界一致。
- 前置条件：候选测试完成，全量 pytest 已实跑。
- 输入：`2723 passed / 37 skipped / 4 warnings / 0 failed`。
- 输出：重写后的 `known-red-baseline-ledger.md`。
- 涉及文件：`.harness/changes/docs-full-court-v1-strategy-20260714/known-red-baseline-ledger.md`。
- 状态 / 数据变化：文档状态 OPEN 6 + FIXED_PENDING_REVIEW 1 → 后端 OPEN 0。
- 验证命令与证据：全量 pytest、P7/P12 独立 review 文件。
- 回滚边界：撤销本台账 diff，不回滚历史生产修复。
- 完成定义：没有顶部/表格/核销段自相矛盾，不宣称 campaign DONE。

## 任务 3：候选收口

- 目标：形成可供 Claude 精确 SHA 复审的最小实现提交。
- 前置条件：任务 1–2 完成。
- 输入：唯一 Packet P13 文件范围。
- 输出：doctor/diff 验证与实现提交 H。
- 涉及文件：本 change 目录及任务 1–2 文件。
- 状态 / 数据变化：Git 候选提交；不推送。
- 验证命令与证据：后端 doctor、根 doctor、`git diff --check`、精确 name-status。
- 回滚边界：提交前按路径撤销；提交后使用 `git revert`，禁止破坏共享历史。
- 完成定义：只含一个 root change，无旧 packet、运行产物或其他本地提交。

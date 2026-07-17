# 任务：chore-agent-harness-baseline-20260717

## 任务 1

- 目标：冻结 M1 前可重复的能力、黄金任务和 known-red 基线。
- 前置条件：world-class harness execution plan 已批准进入 M0。
- 输入：canonical taxonomy、真实引擎注册表、现有黄金样例和 known-red ledger。
- 输出：`capability-baseline.json`、`golden-cases.md`、验证命令和重冻结规则。
- 涉及文件：本 change 目录；不改业务运行时。
- 状态 / 数据变化：新增不可变基线证据，不写生产数据库。
- 验证命令与证据：doctor、`pytest -q backend/tests -p no:randomly`、`git diff --check`。
- 回滚边界：删除本 change 证据，不影响运行时代码。
- 完成定义：commit/分支/事实源/7 项 known-red/50 样本维度和重冻结触发条件均已登记。

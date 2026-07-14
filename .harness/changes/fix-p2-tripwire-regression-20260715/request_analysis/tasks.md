# 任务：fix-p2-tripwire-regression-20260715

## 任务 1：唯一创建入口

- 状态：COMPLETE

- 目标：治理兼容 bill 的首次创建通过 canonical kernel。
- 前置条件：单写入口测试已 RED。
- 输入：兼容 bill 与 actor。
- 输出：参数映射后的 canonical `DecisionTask`。
- 涉及文件：`backend/src/governance_compat_store.py`。
- 状态 / 数据变化：只改变新建路径的构造所有权，不做数据迁移。
- 验证命令与证据：`test_decision_task_single_writer.py`、`test_governance_compat_persistence.py`。
- 回滚边界：单文件回滚。
- 完成定义：结构门禁通过，兼容持久化与碰撞保护保持通过。

## 任务 2：遥测增量断言

- 状态：COMPLETE

- 目标：测试不再依赖进程级计数器初始状态。
- 前置条件：顺序运行 `test_chaotang_store.py` 后目标测试已 RED。
- 输入：目标 label series 调用前后导出值。
- 输出：精确 `+1` 的增量断言。
- 涉及文件：`backend/tests/test_flow_store_legacy_tripwire.py`。
- 状态 / 数据变化：无生产状态变化。
- 验证命令与证据：目标测试单跑及带前序测试顺序运行。
- 回滚边界：单测试文件回滚。
- 完成定义：两种执行顺序均通过。

## 任务 3：分层验证与提交

- 状态：COMPLETE（全量 7 个非目标失败已隔离记录）

- 目标：证明修复没有扩大影响并保留完整证据。
- 前置条件：任务 1、2 GREEN。
- 输入：P2 测试组、尚书房组合、后端全量与三层 doctor。
- 输出：CI 摘要、最终 diff 和独立修复提交。
- 涉及文件：本变更记录。
- 状态 / 数据变化：Git 提交；不合并发布分支。
- 验证命令与证据：见 `ci_result/ci_summary.md`。
- 回滚边界：独立提交可整体回滚。
- 完成定义：目标回归关闭，非目标失败明确隔离记录。

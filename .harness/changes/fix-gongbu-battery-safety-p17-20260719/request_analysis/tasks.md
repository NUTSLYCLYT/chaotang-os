# 任务：fix-gongbu-battery-safety-p17-20260719

## 任务 1：冻结范围并复现 RED

- 目标：在 P16 远端基线上证明工部物理安全假阴性和缓存旁路。
- 前置条件：B17=`9956a5a9a0a8ad5d8465c637dd8c7b81d08f50f8`。
- 输入：Opus HIGH、最终本地安全补丁的测试设计。
- 输出：只改测试时 8 failed / 3 passed。
- 涉及文件：`backend/tests/test_real_department_engines.py`。
- 状态 / 数据变化：无生产数据变化；测试可能生成未跟踪知识目录，必须排除。
- 验证命令与证据：工部 `-k gongbu` 聚焦测试。
- 回滚边界：仅新增测试。
- 完成定义：至少原始“爆炸并起火”与 cache-bypass 用例可靠 RED。

## 任务 2：实现两档 fail-safe

- 目标：明确危险为 P0，其他储能事故为 P1，二者都强制人签；工部跳过旧缓存。
- 前置条件：任务 1 RED。
- 输入：现有 `adapt_gongbu` 与 `signoff_gate` 契约。
- 输出：一个生产文件的确定性修复。
- 涉及文件：`backend/src/real_department_engines.py`。
- 状态 / 数据变化：无数据库迁移、无外部副作用。
- 验证命令与证据：11 工部测试 GREEN；跨门 70 passed。
- 回滚边界：不得恢复默认 P2/yellow 或工部缓存命中。
- 完成定义：所有新增行为回归通过。

## 任务 3：全量验证与审查发布

- 目标：证明无跨部门回归，并按 Claude→D6 顺序发布。
- 前置条件：任务 2 GREEN。
- 输入：实现、测试、根级 Harness 证据。
- 输出：固定 H17；review-only R17；no-ff M17。
- 涉及文件：本 change 目录及任务 1/2 两文件。
- 状态 / 数据变化：仅 GO 后普通 push 更新 `feature-chaotang-ext`。
- 验证命令与证据：后端全量、三层 doctor、diff check、Claude、D6。
- 回滚边界：Claude NO_GO 时停止 D6，另起修复版本。
- 完成定义：远端指向通过 D6 的 M17，且主工作树不被触碰。

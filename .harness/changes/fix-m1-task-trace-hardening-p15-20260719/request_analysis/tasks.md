# 任务：fix-m1-task-trace-hardening-p15-20260719

## 任务 1：唯一未分配 trace ID

- 目标：消除不同任务共享固定 `trace-unassigned` 的追踪碰撞。
- 前置条件：B15 行为断言已独立 RED。
- 输入：未显式提供 trace 的 `TaskEnvelope`。
- 输出：每次构造生成 `trace-unassigned-<uuid>`。
- 涉及文件：`backend/src/contracts/task_trace.py`、对应测试。
- 状态 / 数据变化：仅内存契约默认值；无持久化迁移。
- 验证命令与证据：聚焦唯一性测试与全量 backend。
- 回滚边界：恢复旧 default factory；不涉及数据回滚。
- 完成定义：两个 envelope 的默认 trace ID 不同且前缀稳定。

## 任务 2：legacy 输入 fail closed

- 目标：拒绝冲突或非法 trace 输入，不再静默选择一个值。
- 前置条件：冲突输入已在 B15 RED 复现。
- 输入：nested trace、flat trace ID、TraceContext 实例及非法类型。
- 输出：匹配/补全时通过，冲突 `ValueError`，非法形状 `TypeError`。
- 涉及文件：同任务 1。
- 状态 / 数据变化：契约验证行为收紧；当前无生产调用方。
- 验证命令与证据：18 项契约测试，覆盖 dict/实例/非法类型/未知字段。
- 回滚边界：原子还原两个文件。
- 完成定义：声明的所有边界条件都有正反回归。

## 任务 3：P15 候选收口

- 目标：形成从 P14 远端基点出发、只含一个 root change 的固定实现候选 H。
- 前置条件：任务 1–2 GREEN。
- 输入：2 个代码/测试文件与 4 个 change 证据文件。
- 输出：机器验证全绿、等待独立复审的本地提交。
- 涉及文件：本 change 精确 6 路径。
- 状态 / 数据变化：本地 Git candidate；不推送。
- 验证命令与证据：聚焦 18 passed；全量 2738/37/4/0；两级 doctor；diff check。
- 回滚边界：提交后 `git revert`；禁止重写共享历史。
- 完成定义：无其他业务线、旧 change、主工作树未跟踪文件或运行产物。

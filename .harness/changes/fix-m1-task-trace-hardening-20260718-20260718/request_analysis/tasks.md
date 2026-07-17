# 任务：fix-m1-task-trace-hardening-20260718-20260718

## 任务 1

- 目标：`trace-unassigned` 默认值改为每实例唯一，避免不同任务共享同一 trace_id。
- 前置条件：`origin/feature-chaotang-ext@bf7d4cc` 已含与本地 `b87113e` 一致的 `task_trace.py`。
- 输入：`backend/src/contracts/task_trace.py`
- 输出：新增 `_unassigned_trace_id()`，default_factory 改用它。
- 涉及文件：`backend/src/contracts/task_trace.py`
- 状态 / 数据变化：纯函数改动，无状态、无数据库。
- 验证命令与证据：`pytest tests/test_task_trace_contracts.py::test_unassigned_trace_id_is_unique_per_envelope`
- 回滚边界：还原到 `bf7d4cc` 版本即可。
- 完成定义：两个不传 trace 的 envelope 得到不同 trace_id。

## 任务 2

- 目标：`from_legacy()` 冲突的 `trace`/`trace_id` 输入从静默丢弃改为显式拒绝；
  非冲突时补全缺失字段。
- 前置条件：任务 1 完成。
- 输入：`backend/src/contracts/task_trace.py`
- 输出：`from_legacy` 内加冲突检测与补全逻辑。
- 涉及文件：`backend/src/contracts/task_trace.py`、`backend/tests/test_task_trace_contracts.py`
- 状态 / 数据变化：无。
- 验证命令与证据：`pytest tests/test_task_trace_contracts.py`（10 passed，任务 2 首版）
- 回滚边界：还原到 `bf7d4cc` 版本即可。
- 完成定义：冲突输入拒绝、相同值放行、缺失字段补全，三类各有单测锁定。

## 任务 3

- 目标：修补任务 2 首版遗漏——`trace` 为 `TraceContext` 实例时冲突检测被跳过
  （`isinstance(trace, Mapping)` 判假）；再修补第二版遗漏——`isinstance(trace,
  BaseModel)` 归一化过宽（接受无关 BaseModel 子类）且顶层 `value` 非 Mapping
  时暴露内置异常。三轮均由 Codex stop-time review 在同一会话内当场指出。
- 前置条件：任务 1、2 完成。
- 输入：`backend/src/contracts/task_trace.py`
- 输出：`trace` 归一化收窄为 `Mapping | TraceContext` 两种确切形状；顶层
  `value` 增加 `isinstance(value, Mapping)` 前置检查。
- 涉及文件：`backend/src/contracts/task_trace.py`、`backend/tests/test_task_trace_contracts.py`
- 状态 / 数据变化：无。
- 验证命令与证据：`pytest tests/test_task_trace_contracts.py`（18 passed）；
  另行手工对抗性排查 int 型 trace_id、构造器直传错误类型、空 dict 顶层输入，
  均为干净 `ValidationError`，未发现新的未覆盖形状。
- 回滚边界：还原到 `bf7d4cc` 版本即可。
- 完成定义：`TraceContext` 实例路径、无关 BaseModel、顶层非 Mapping 三类各有
  单测锁定；对抗性排查记录在 ci_summary.md，不隐瞒"未穷尽证明"这个限制。

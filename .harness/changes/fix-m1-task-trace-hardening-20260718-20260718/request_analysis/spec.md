# 规格说明：fix-m1-task-trace-hardening-20260718-20260718

## 背景

独立复审 `feat-agent-harness-task-trace-20260718-20260718`（M1 TaskEnvelope/TraceContext）
判定 GO_WITH_ACTIONS，列出两条 M1-B 前置阻塞项：

1. `trace: TraceContext = Field(default_factory=lambda: TraceContext(trace_id="trace-unassigned"))`
   用字面量常量做默认值，不同 `TaskEnvelope` 实例不传 `trace` 时会得到完全相同的
   `trace_id`，一旦接入真实链路追踪会把无关任务误关联。
2. `from_legacy()` 在 `trace` 与顶层 `trace_id` 同时存在时，无条件让 `trace` 胜出，
   顶层 `trace_id` 被静默丢弃，调用方以为自己指定的 `trace_id` 生效了，实际没有。
   Codex stop-time review 在本轮会话内三次复核纠正：
   - 第一轮修复只加了注释说明这个行为，没有真正改变"冲突时静默丢弃"这个事实。
   - 第二轮加了 `isinstance(trace, Mapping)` 冲突检测，但 `trace` 传
     `TraceContext` 实例时该判断为假，冲突检测被整段跳过，同一个缺陷换了个
     输入形状又漏了一次。
   - 第三轮把 `Mapping` 补成 `Mapping` 或 `BaseModel`，但用
     `isinstance(trace, BaseModel)` 归一化范围过宽——接受任意无关 BaseModel
     子类；且顶层 `value` 本身不是 Mapping（None/字符串等）时，`dict(value)`
     会抛出 Python 内置的、含义不明的异常，不是本模块设计的显式错误。
   当前版本：`trace` 归一化只认 `Mapping` 或 `TraceContext` 自身两种确切形状；
   顶层 `value` 先做 `isinstance(value, Mapping)` 检查。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 默认 trace_id 改为 `trace-unassigned-{uuid4().hex}`，每次调用唯一 | `task_trace.py:11-13` | `test_unassigned_trace_id_is_unique_per_envelope` | 否 |
| 已确认事实 | `from_legacy` 冲突值（`trace.trace_id` 与顶层 `trace_id` 不同）改为 `raise ValueError`，不再静默择一 | `task_trace.py:52-64` | `test_from_legacy_rejects_conflicting_trace_and_trace_id` | 否 |
| 已确认事实 | 值相同不算冲突，正常放行；`trace` 缺 `trace_id` 而顶层有值时自动补全 | 同上 | `test_from_legacy_allows_matching_trace_and_trace_id`、`test_from_legacy_fills_missing_trace_id_from_flat_field` | 否 |
| 未知问题 | 本 change 未接入任何真实路由/调用方，是否有现存调用方依赖"trace 静默胜出"这个旧行为未知 | 不适用 | M1-B 接入时逐调用方核查 | 是（M1-B 前置） |

## 数据流与调用链

不变，仍是纯契约模块，未接入 `backend/web/routers/*`。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `TaskEnvelope.from_legacy()` 新增行为：冲突 trace_id 拒绝（dict 与 `TraceContext` 实例两种输入形式）、缺失字段补全、`trace` 非法类型拒绝、无关 BaseModel 拒绝、顶层 value 非 Mapping 拒绝 | `task_trace.py` | 未来 M1-B 路由适配层 | 18 条单测覆盖以上全部路径 |

## 范围

只改 `backend/src/contracts/task_trace.py` 与其单测；不改运行时路由、不改数据库、
不改 `feat-agent-harness-task-trace-20260718-20260718` 原 change 目录下的既有证据文件
（那份证据对应的是原始 `b87113e`/`bf7d4cc` 内容，本 change 是后续补丁，独立记录）。

## 非目标

不接入真实路由（M1-B 范围）；不处理主工作区当前未完成的
`origin/pr/p8-from-origin` merge（超出本 change 授权范围）。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 不传 trace，构造两个 envelope | trace_id 各不相同 | `test_unassigned_trace_id_is_unique_per_envelope` |
| `trace`（dict）的 `trace_id` 与顶层 `trace_id` 不同 | 拒绝（ValueError） | `test_from_legacy_rejects_conflicting_trace_and_trace_id` |
| `trace`（`TraceContext` 实例）的 `trace_id` 与顶层 `trace_id` 不同 | 拒绝（ValueError） | `test_from_legacy_rejects_conflicting_trace_context_instance_and_trace_id` |
| `trace.trace_id` 与顶层 `trace_id` 相同（dict 或实例） | 正常放行，取该值 | `test_from_legacy_allows_matching_trace_and_trace_id`、`test_from_legacy_allows_matching_trace_context_instance_and_trace_id` |
| `trace` 无 `trace_id`，顶层有 | 补全进 trace | `test_from_legacy_fills_missing_trace_id_from_flat_field` |
| `trace` 既不是 Mapping 也不是 `TraceContext` 实例（如字符串） | 拒绝（TypeError） | `test_from_legacy_rejects_unsupported_trace_value_type` |
| `trace` 是无关的 `BaseModel` 子类实例 | 拒绝（TypeError） | `test_from_legacy_rejects_unrelated_basemodel_as_trace` |
| 顶层 `value` 不是 Mapping（None/字符串/int/list） | 拒绝（TypeError，非内置异常措辞） | `test_from_legacy_rejects_non_mapping_top_level_value` |

## 风险与回滚边界

纯函数级修复，无状态、无数据库、无路由依赖；回滚只需还原
`backend/src/contracts/task_trace.py` 与其测试到 `bf7d4cc` 版本。

## 计划确认记录

- 批准人：用户（本会话内要求"继续任务2"修复独立审查阻塞项，并经 Codex stop-time
  review 二次纠正）
- 批准日期：2026-07-18
- 批准范围：仅 M1 契约本身的两处硬化修复
- 明确未批准：M1-B 路由接入、主工作区 merge 冲突处理、提交/推送

## 验收标准

1. 两个不传 trace 的 envelope 得到不同 trace_id。
2. `from_legacy` 冲突输入被拒绝，不静默丢弃任一方。
3. 全部单测通过，doctor 与 diff --check 干净。

## 验证计划

`pytest tests/test_task_trace_contracts.py`、`python3 scripts/harness_doctor.py`、
`git diff --check`，均在隔离 worktree 内执行。

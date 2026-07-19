# CI 摘要：fix-m1-task-trace-hardening-20260718-20260718

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest -q tests/test_task_trace_contracts.py` | 0 | 18 passed | 唯一性、冲突拒绝（dict/`TraceContext` 实例两种形式）、相同值放行、缺失字段补全、`trace` 非法类型拒绝、无关 `BaseModel` 子类拒绝、顶层 `value` 非 Mapping 四种形状拒绝（parametrize） | worktree `m1-trace-fix`，2026-07-18 03:41 CST |
| `python3 scripts/harness_doctor.py` | 0 | 0 errors, 0 warnings | 后端护栏 | 同上 |
| `git diff --check` | 0 | 干净 | 空白/冲突标记检查 | 同上 |

## 结果

三轮修复，每轮都是 Codex stop-time review 在会话内当场指出上一轮没堵严：

1. 第一轮：`trace-unassigned` 常量改 uuid 唯一化；`from_legacy` 对 dict 形式的
   `trace`/`trace_id` 冲突加检测——**但只判 `isinstance(trace, Mapping)`**。
2. 第二轮：补上 `trace` 是已构造好的 `TraceContext` 实例这条路径（v1 遗漏，
   `TraceContext` 不是 `Mapping` 子类，冲突检测被整段跳过）——**但用
   `isinstance(trace, BaseModel)` 归一化，范围过宽，接受任意无关的 BaseModel
   子类；且顶层 `value` 本身不是 Mapping（None/字符串/int/list）时，仍然是
   `dict(value)` 抛出 Python 内置的、含义不明的 TypeError/ValueError，不是本
   模块设计的显式错误**。
3. 第三轮（本次）：`isinstance(trace, BaseModel)` 收窄为
   `isinstance(trace, TraceContext)`，不相关的 BaseModel 子类直接
   `TypeError`；顶层 `value` 先做 `isinstance(value, Mapping)` 检查，非法
   类型统一走同一套显式 `TypeError`，不再依赖内置 `dict()` 的报错措辞。

新增 5 条测试（含 1 条 4 组参数化）覆盖以上两处。18/18 通过，无回归。经
本轮自行对抗性排查（int 型 trace_id、direct constructor 传错类型 trace、空
dict 顶层输入等），均为干净的 `pydantic.ValidationError`，未发现第四类未覆盖
输入形状——但这是当前已知范围内的排查，不构成"穷尽证明"。

## 未验证项

- 未跑 backend 全量 pytest（本 change 只改一个文件，聚焦套件已覆盖全部改动
  路径；全量回归留给合入 integration 分支前）。
- 未验证真实调用方是否依赖旧的静默丢弃/宽松归一化行为——本 change 尚未接入
  任何路由，无调用方可查；M1-B 阶段需要逐调用方核实。
- 未提交、未推送；只在隔离 worktree `.fullcourt-worktrees/m1-trace-fix`
  （分支 `fix/m1-task-trace-hardening`）内完成，主工作区未改动。

## Diff 与回滚复核

- changed files：`backend/src/contracts/task_trace.py`、
  `backend/tests/test_task_trace_contracts.py`。
- diff review：纯新增/修改函数体，无删除既有公开接口签名。
- 回滚是否演练：未执行；还原两个文件到 `bf7d4cc` 版本即可整体回滚。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| trace_id 跨实例不再共享 | `test_unassigned_trace_id_is_unique_per_envelope` | PASS |
| 冲突 trace/trace_id 显式拒绝（dict 形式） | `test_from_legacy_rejects_conflicting_trace_and_trace_id` | PASS |
| 冲突 trace/trace_id 显式拒绝（`TraceContext` 实例形式） | `test_from_legacy_rejects_conflicting_trace_context_instance_and_trace_id` | PASS |
| 相同值放行、缺失字段补全（dict 与实例两种形式） | `test_from_legacy_allows_matching_trace_and_trace_id`、`test_from_legacy_fills_missing_trace_id_from_flat_field`、`test_from_legacy_allows_matching_trace_context_instance_and_trace_id` | PASS |
| `trace` 非法类型显式报错 | `test_from_legacy_rejects_unsupported_trace_value_type` | PASS |
| 无关 `BaseModel` 子类不被当成 trace 数据源 | `test_from_legacy_rejects_unrelated_basemodel_as_trace` | PASS |
| 顶层 `value` 非 Mapping 时显式 `TypeError`，不暴露内置异常措辞 | `test_from_legacy_rejects_non_mapping_top_level_value`（4 组参数化） | PASS |
| doctor / diff --check 干净 | 见上表 | PASS |

## 声明状态

- `VERIFIED_PARTIAL`：契约本身修复并通过聚焦测试与护栏；全量回归、真实调用方
  核查、提交/推送均未执行，不宣称已合入或已获合并授权。

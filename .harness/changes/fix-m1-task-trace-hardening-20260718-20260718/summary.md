# 变更摘要：fix-m1-task-trace-hardening-20260718-20260718

| 字段 | 值 |
| --- | --- |
| Change ID | fix-m1-task-trace-hardening-20260718-20260718 |
| 类型 | fix |
| 状态 | VERIFIED_PARTIAL |
| Owner | Project Agent |
| 创建日期 | 20260718 |

## 范围

- 主线：修复独立审查（`.harness/changes/feat-agent-harness-task-trace-20260718-20260718` 的
  NO_GO 复审）发现的两个 M1 契约缺陷：`trace-unassigned` 默认值跨实例碰撞、
  `from_legacy()` 静默丢弃冲突的 `trace`/`trace_id` 输入。第二项经 Codex
  stop-time review 三轮当场纠正才收敛：dict 形式冲突拒绝 → 补
  `TraceContext` 实例形式 → 收窄归一化范围（不认无关 BaseModel）+ 顶层
  `value` 非 Mapping 时也显式拒绝，不暴露内置异常措辞。
- 文件：`backend/src/contracts/task_trace.py`、`backend/tests/test_task_trace_contracts.py`。
- 验证：契约单测 3 条扩到 18 条；`pytest`/`harness_doctor`/`git diff --check` 均通过。
- 基点：`origin/feature-chaotang-ext@bf7d4cc`（该提交已含与本地 `b87113e` 逐字节相同的
  `task_trace.py`，本 change 在此基础上打补丁，不是重新实现）。
- 隔离：全程在 `.fullcourt-worktrees/m1-trace-fix` 独立 worktree 完成，未触碰主工作区
  （主工作区当时存在未完成的 `origin/pr/p8-from-origin` merge，冲突未解决）。

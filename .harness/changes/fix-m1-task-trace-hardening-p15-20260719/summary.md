# 变更摘要：fix-m1-task-trace-hardening-p15-20260719

Packet ID: P15

| 字段 | 值 |
| --- | --- |
| Change ID | fix-m1-task-trace-hardening-p15-20260719 |
| 类型 | fix |
| 状态 | IMPLEMENTED_CANDIDATE / EXTERNAL_REVIEW_PENDING |
| Owner | Project Agent |
| 创建日期 | 20260719 |

## 范围

- 主线：M1 `TaskEnvelope` / `TraceContext` 契约加固，消除未分配 trace ID
  跨任务碰撞，并拒绝相互矛盾或形状非法的 legacy trace 输入。
- 文件：2 个后端契约/测试文件和本 root change 的 4 个证据文件，恰好 6 路径。
- 验证：基线 RED 两项、聚焦 18 passed、backend 全量 2738 passed / 37 skipped /
  4 warnings / 0 failed、后端/根 doctor、diff check。

## 边界

- 精确基点：`origin/feature-chaotang-ext` =
  `5d273c3fbe5e02e52b6ab3e8630f6d54a0c78a43`（P14 已发布）。
- 本包从最新远端重新实施，不 cherry-pick 或合并本地 `269b2ec` / `d8ade24` DAG。
- `rg` 证明当前生产代码没有 `TaskEnvelope` / `from_legacy()` 调用方；本包只加固契约，
  不宣称 M1 已完成生产接线。
- 不夹带门下省、工部、国力、census、P6/P8/P9 旧证据或主工作树未跟踪文件。

## 候选结果

- 默认 trace ID 改为每次构造生成唯一 UUID 后缀。
- legacy 输入中嵌套 `trace.trace_id` 与平铺 `trace_id` 冲突时 fail closed。
- 只接受 `Mapping` 或精确 `TraceContext` 形状；非法顶层/trace 类型显式拒绝。
- 等待独立 Claude Code 对固定候选 SHA 复审；GO 前不得合入或推送 ext。

# 规格说明：fix-m1-task-trace-hardening-p15-20260719

## 背景

M1 引入了统一 `TaskEnvelope` / `TraceContext`，但最新远端仍有两类已复现缺陷：

1. 未提供 trace 时，每个任务都得到固定值 `trace-unassigned`，不同任务无法区分；
2. legacy 输入同时携带嵌套 `trace.trace_id` 和平铺 `trace_id` 且取值不同时，平铺值
   被静默丢弃，调用方无法知道实际使用了哪个追踪标识。

旧本地分支 `269b2ec` 曾处理该问题，但该分支处于 78 个提交的混杂 DAG，不能整体合并。
本包以已发布 P14 远端为新事实源，先独立复现 RED，再只重建契约净切片。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 两个默认 envelope 的 trace ID 完全相同 | RED Python 行为断言 exit 1 | Codex / B15 隔离 worktree | 是，已修复 |
| 已确认事实 | 冲突的 nested/flat trace ID 被静默接受 | RED Python 行为断言 exit 1 | Codex / B15 隔离 worktree | 是，已修复 |
| 已确认事实 | 生产源码无 `TaskEnvelope` / `from_legacy()` 调用方 | `rg -n "TaskEnvelope|from_legacy\\(" backend/src backend/tests` | Codex 源码扫描 | 否 |
| 未知问题 | 后续 M1-B 生产路由如何接入该契约 | 本包不实施生产接线 | 后续独立 Packet | 是，阻断 M1 总体完成，不阻断 P15 |

## 数据流与调用链

当前仅有契约定义与测试：调用方数据 → `TaskEnvelope.from_legacy()` → 形状归一化与
冲突检测 → Pydantic `TaskEnvelopeV1` 验证。生产路由尚未消费该契约，因此本包不改变
现有运行链路，只把未来接线的输入边界变成 fail closed。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `TraceContext` | `backend/src/contracts/task_trace.py` | 后续路由/部门/执行器 | Pydantic extra-forbid + 18 项单测 |
| `TaskEnvelopeV1` | 同上 | 当前仅测试，生产待 M1-B | schema version、必填字段、legacy 适配与类型边界 |

## 范围

- 修改 `backend/src/contracts/task_trace.py`。
- 扩充 `backend/tests/test_task_trace_contracts.py`。
- 新增唯一根级 change `fix-m1-task-trace-hardening-p15-20260719`。

## 非目标

- 不接入生产路由、SSE、队列、agent 或 provider。
- 不修改 TaskEnvelope 公共字段名或 schema version。
- 不处理门下省 veto、工部安全、国力/census 或旧 P6/P8/P9 证据。
- 不声称 M1 总体完成或生产 trace 已闭环。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 未提供 trace | 每次生成不同的 `trace-unassigned-<uuid>` | 唯一性回归 |
| nested/flat ID 相同 | 保留并通过 | matching dict/TraceContext 测试 |
| nested 缺 ID、flat 有值 | 补入 flat ID | fill 测试 |
| nested/flat ID 冲突 | 显式 `ValueError` | 两种 trace 形状负例 |
| 顶层或 trace 形状非法 | 显式 `TypeError` | 字符串、None、int、list、无关 BaseModel 负例 |
| 未知字段/schema version | Pydantic fail closed | extra/version 负例 |

## 风险与回滚边界

主要风险是收紧 legacy 适配后暴露依赖旧静默行为的调用方。当前全仓扫描没有生产调用方，
且全量 backend 2738 项通过，因此现实兼容风险低；未来接线必须显式处理新错误。回滚只需
还原两个后端文件，无数据库、API、队列或运行态迁移。

## 计划确认记录

- 批准人：项目业主
- 批准日期：2026-07-19
- 批准范围：完成 78 提交建账后，从最新远端继续下一安全 Packet；M1 被识别为唯一立即可重打包净切片。
- 明确未批准：整体合并本地 78 提交、夹带其他修复线、绕过独立复审或直接推送。

## 验收标准

1. 两个默认 envelope 获得不同且格式明确的未分配 trace ID。
2. dict 与 `TraceContext` 两种 legacy 形状都执行冲突检测。
3. 非 Mapping 顶层、非法 trace 类型和无关 BaseModel 显式拒绝。
4. 聚焦 18 项与 backend 全量测试通过。
5. 后端/根 doctor 与 `git diff --check` 通过。
6. 固定 SHA 独立复审 GO 前不合 ext。

## 验证计划

B15 行为 RED → 最小契约/测试 GREEN → 调用面扫描 → 聚焦套件 → backend 全量 →
后端/根 doctor → 精确 diff 与固定 SHA 独立复审。

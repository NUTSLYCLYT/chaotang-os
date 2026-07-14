# 规格说明：fix-p2-tripwire-regression-20260715

## 背景

P2 将 legacy writer 纳入 tripwire，并规定 `DecisionTask` 只能由 `src.decision_task_kernel.create_decision_task` 创建。合入后全量测试暴露两个回归，需要在不扩大 P2 范围的前提下修正。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 治理兼容存储直接调用 `DecisionTask(...)` | `backend/src/governance_compat_store.py:62`；2026-07-15 聚焦测试失败 | `test_decision_task_single_writer.py` / Backend | 是 |
| 已确认事实 | 遥测计数正确累加，但测试硬编码累计值必须为 `1.0` | 先运行 `test_chaotang_store.py` 再运行目标测试可稳定复现；2026-07-15 | pytest / Backend | 是 |
| 已确认事实 | 后端全量仍有 7 个非目标失败，两个 P2 回归不再失败 | `python3 -m pytest -q`：2603 passed、26 skipped、7 failed；2026-07-15 | pytest / Backend | 否 |

## 数据流与调用链

`governance_compat` 路由 → `governance_compat_store.save_bill` → `decision_task_kernel.create_decision_task` → `DecisionTask`。

`chaotang_store.write_review_files` → `migration_telemetry.record_legacy_endpoint_call` → 进程级 `metrics_exporter`；测试必须验证一次调用带来的增量，而不是假定此前没有调用。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `DecisionTask` 创建入口 | `backend/src/decision_task_kernel.py` | 治理兼容存储及正式路由 | 单写入口结构测试与兼容持久化测试 |
| `legacy_endpoint_calls_total` | `backend/src/migration_telemetry.py` / `metrics_exporter` | Prometheus 端点与回归测试 | 比较目标 label series 的调用前后增量 |

## 范围

- 新建治理兼容 bill 时调用唯一创建内核，更新既有兼容 bill 的行为保持不变。
- 将目标遥测测试改为验证计数增量 `+1`。
- 更新根级变更证据并运行分层验证。

## 非目标

- 不重构 migration telemetry 或 metrics exporter。
- 不修复本次全量测试中发现的其他失败。
- 不修改主工作区未提交的 `backend/src/db/flow_store.py`。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 新建兼容 bill | 只通过唯一内核构造并由调用方提交事务 | 单写入口测试、兼容持久化测试 |
| 同一 pytest 进程已有相同 label 的计数 | 本次写入仍使该 series 精确增加 1 | 顺序复现测试 |
| bill id 与非兼容任务冲突 | 拒绝覆盖并保持原任务不变 | `test_governance_adapter_refuses_to_overwrite_non_compat_task` |

## 风险与回滚边界

风险集中在兼容 bill 首次创建参数映射。回滚只需撤销本变更涉及的两个后端文件；不迁移数据、不改变接口形状。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-15
- 批准范围：按既定顺序提交 Step 0、隔离修复两个 P2 回归并完成验证。
- 明确未批准：混入其他失败修复、修改前端或合并到发布分支。

## 验收标准

1. `test_decision_task_single_writer.py` 通过，运行时代码无第二个 `DecisionTask` 构造入口。
2. 遥测测试在已有同 label 计数的情况下仍通过，并证明调用增量为 1。
3. P2 相关测试与尚书房 38 项组合通过。
4. 完成后端全量测试和三层 doctor，任何非本范围失败单独记录。

## 验证计划

- RED：运行两个目标测试；再以 `test_chaotang_store.py` 作为前序复现累计计数失败。
- GREEN：目标测试、P2 相关测试组。
- 回归：尚书房组合、后端全量 pytest。
- 护栏：根、后端、前端 doctor 与最终 diff review。

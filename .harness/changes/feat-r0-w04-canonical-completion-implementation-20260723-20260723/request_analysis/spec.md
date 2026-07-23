# 规格说明：feat-r0-w04-canonical-completion-implementation-20260723-20260723

## 背景

R0-W04 已获 execution-authority v2 授权（GO，绑定 exact HEAD `eefd4133`）。W04 交付
6 个 REQ（008/013/014/018/020/022），核心是"canonical 完成与恢复"：任务什么时候才算真的
完成、门下省什么时候才能真的放行、异常路径怎么收口。Plan Mode 阶段用 2 轮 Explore 子代理 +
1 轮 Plan 子代理逐条对照实际代码核实后发现：这不是绿地——现有代码已经把大半个骨架搭好
（`execution_state.py` 早就正确区分 receipt_only/completed/inconsistent；`archive_outcomes.py`/
`record_timeline_event` 已有成熟的哈希比对幂等范式；`FinalMemorial` 已有唯一约束和质量门）。
真正的 bug 集中在人类可见层（`decree_status.py` 的字符串映射表）和门下省的一处死代码分支，
整包实现是外科手术式改已有映射表和状态转移，不是造新引擎。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 6 个 REQ 各自 RED case 均有独立测试且全部通过；全量 2964 passed + 38 skipped，backend/root doctor 0 errors | `ci_result/ci_summary.md` 命令表 | 已验证 | 否 |
| 已确认事实 | 实现过程中发现并顺手修复 2 处同一 REQ-022 bug 的姊妹漏洞（`shangshufang.py` 的 `memorial.direct_completed` 时间线事件、`canonical_court_dispatch.py` 兼容入口的 `dispatch.queued` 事件，均把零质量门的 direct 路径写成 `stage="completed"`）——不是范围外顺手改，是同一条 REQ 在 `_STAGE_MAP` 之外的另外两个字面量写入点 | `git show` 对应 diff | 已验证 | 否 |
| 已确认事实 | REQ-020 的 `model_version` 未能贯穿——`run_swarm_execution_loop` 的返回契约本身不保留"实际服务这次调用的模型是谁"，把它接回来是蜂群执行循环返回契约的改动，不是可以顺手做的小事，本次不做 | `tests/test_identity_fields_thread_through_chain.py` docstring | 已验证（如实记录，未伪造假值） | 否，明确记为已知缺口 |
| 推测 | 无 | 不适用 | 不适用 | 不适用 |
| 未知问题 | alembic 包本身未在此沙盒环境安装，迁移测试 skip；已确认与既有 014/017 迁移测试同款缺口，非本次引入 | `pip show alembic` → not found | 不适用（后续独立会话有装 alembic 的真实环境时应绿） | 否 |

## 数据流与调用链

```
REQ-013: chancellor.review_route → 有 veto_reasons 就一律封驳，不再有轮次概念
REQ-014: apply_task_decision(reject) → FinalMemorial.status="rejected" → 后续 adopt 复用既有质量门拒绝
REQ-022: decree_status._STAGE_MAP(direct_completed→receipt_only, archived→delivered)
  → DecreeExecutionStatusV1.current_stage 与 execution_state.py 的 receipt_only 用词一致
REQ-018: outbox_worker.apply_failure_state(dead_letter) → DecisionTask.status="execution_failed"
  → decree_status 三张映射表新增 execution_failed 自映射；cancel action → 终态幂等围栏
REQ-020: decision_task_kernel.create_decision_task 生成 request_id
  → record_timeline_event 的 _REQUEST_ID_FROM_TASK 哨兵自动带出 + release_id 部署常量
  → DecreeExecutionStatusV1.request_id / TimelineEvent.release_id
REQ-008: migration 018 只加列不加表 + 源码哨兵扫描 db/models.py 无第二 Mission 类
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `DecreeExecutionStatusV1.request_id`/`TimelineEvent.release_id`/`model_version` | `src/chancellor/contracts.py`（新增可选字段，有默认值） | `/tasks/{id}/status` 响应 | 纯新增，向后兼容，无既有断言改动 |
| `DecisionTask.request_id`/`DecreeExecutionEvent.request_id/release_id/model_version` | `src/db/models.py` + `alembic/018` | 路由层/时间线读取 | 迁移列全 nullable，静态核对与 ORM 一致 |
| `_STAGE_MAP`/`_OWNER_MAP`/`_NEXT_STAGE_MAP` 新字面量（receipt_only/delivered/execution_failed/cancelled） | `src/chancellor/decree_status.py` | `/tasks/{id}/status` 的 `current_stage`/`current_owner`/`next_stage` | 黄金测试重写 + 源码回归哨兵 `test_decree_stage_never_fakes_completion.py` |
| `DecisionRequest.action` 新增 `"cancel"` | `web/routers/shangshufang.py` + `src/emperor_decision_kind.py` | 决策端点 + OpenAPI 契约 | `tests/fixtures/shangshufang_contract_baseline_v1.json` 冻结基线同步更新 |

## 范围

6 个 REQ（008/013/014/018/020/022）对应的存量代码定点修复，不新建业务模块、不新建表。

## 非目标

不实现 REQ-020 的 `model_version` 全链贯穿（需要改 `run_swarm_execution_loop` 返回契约，
留作独立后续变更）；不实现真正的多 worker 并发 lease/generation fencing（R0 黄金路径是
单租户同步流程，无真实并发竞争场景，cancel 用终态幂等检查已足够）；不批 W05-W09。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 门下省重复审议同一有效路由（无轮次概念） | 每次都封驳，不因"轮次"放行 | `test_repeated_review_never_auto_approves_while_veto_reasons_remain` |
| reject 后再 adopt 同一任务 | 复用既有质量门错误，拒绝 | `test_reject_supersedes_formal_memorial_and_blocks_later_adopt` |
| direct 回执 / worker ACK | `current_stage` 只能是 `receipt_only`，不能是 `completed`/`delivered` | `test_status_shows_receipt_only_owner_for_direct_task` + 源码哨兵 |
| outbox dead_letter（硬重试上限打满） | `DecisionTask.status="execution_failed"`，`current_stage`/`current_owner`/`blocked_reason` 均明确，不停留在 executing | `test_dead_letter_promotes_task_to_execution_failed_and_status_reflects_it` |
| 重复/迟到 cancel | 终态幂等，不重开、不覆盖已落定状态 | `test_repeated_cancel_is_idempotent`、`test_cancel_rejected_on_already_archived_task` |
| task 创建 → 全链 | `request_id` 在 `DecisionTask`/每条 `DecreeExecutionEvent`/`DecreeExecutionStatusV1` 上一致 | `test_identity_fields_thread_through_chain.py` |

## 风险与回滚边界

纯存量代码定点修复 + 1 个新增迁移（仅加列，无表结构变更）。回滚：`git revert` 即可恢复到
W03 状态；`alembic downgrade` 撤销新列（迁移文件已带 `downgrade()`，因沙盒缺 alembic 未在此
环境实跑）。`_STAGE_MAP`/`_OWNER_MAP`/`_NEXT_STAGE_MAP` 的字面量改动有源码回归哨兵测试
防止被悄悄改回去。

## 计划确认记录

- 批准人：lyt（R0-W04 governance 批准，AskUserQuestion 确认绑定 exact HEAD `eefd4133`）
- 批准日期：2026-07-23
- 批准范围：R0-W04 实现（本变更全部内容）
- 明确未批准：R0-W05 及以后

## 验收标准

6 个 REQ 各自 RED case 有测试覆盖；backend/root doctor 0 错误；既有测试套件（2964 项）
零回归（含为反映真实行为变化而重写的 3 个既有黄金测试断言）。

## 验证计划

见 `ci_result/ci_summary.md`。

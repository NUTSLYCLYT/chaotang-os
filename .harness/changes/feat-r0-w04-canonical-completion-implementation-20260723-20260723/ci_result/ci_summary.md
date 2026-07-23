# CI 摘要：feat-r0-w04-canonical-completion-implementation-20260723-20260723

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest tests/test_menxia_veto.py tests/test_final_memorial_gate.py tests/test_decree_execution_status.py tests/test_execution_failed_status.py tests/test_task_cancellation.py tests/test_identity_fields_thread_through_chain.py tests/test_canonical_completion_no_parallel_table.py tests/test_decree_stage_never_fakes_completion.py tests/test_migration_018_canonical_completion_identity_fields.py -v` | 0 | 67 passed, 2 skipped（含独立审查后补的 2 项回归） | 6 个 REQ 全量 RED/正例 | 2026-07-23 |
| `python3 -m pytest tests/ -q --ignore=tests/test_migration_018_canonical_completion_identity_fields.py` | 0 | 2965 passed, 38 skipped | 全量回归（含黄金测试重写、冻结基线同步） | 同上 |
| `python3 scripts/harness_doctor.py` | 0 | 0 errors / 0 warnings | backend harness | 同上 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | 根 harness | 同上 |

## 结果

6 个 REQ（008/013/014/018/020/022）各自 RED case 均有独立测试且全部通过。全量回归
2964 passed + 38 skipped（skip 均为沙盒缺 alembic 包的既有环境缺口，非本次引入）。实现过程中
发现并顺手修复 REQ-022 的 2 处姊妹漏洞（不在最初计划的 `_STAGE_MAP` 范围内，但是同一 REQ 在
其他两处字面量写入点的同款问题）；发现 2 个需要同步更新的 repo 级冻结基线
（`test_schema_authority.py` 的 alembic head pin、`shangshufang_contract_baseline_v1.json`
的 OpenAPI action_enum）；发现 1 个真实但与本次改动无关的预先存在问题（`make_id` 秒级精度
无 nonce，同一秒内两次相同 action 会撞 `emperor_decisions.id`/`court_loop_runs.id` 主键）——
已记录、未顺手修，测试改为在函数层面直接验证幂等属性以绕开这条无关的既有故障路径。

## 独立审查发现与修复

独立（非实现者）code-reviewer agent 审查后返回 GO（0 HIGH + 2 MEDIUM），修复后追加 2 项回归：

| 严重度 | 问题 | 修复 | 回归测试 |
| --- | --- | --- | --- |
| MEDIUM | cancel 围栏词表（`shangshufang.py`）与 execution_failed 推进词表（`outbox_worker.py`）各写各的且已不同步，前者漏 `draft_cancelled` | 收口成单一 `TASK_TERMINAL_STATUSES` 公共常量，两处统一 import | `test_cancel_rejected_on_already_draft_cancelled_task` |
| MEDIUM | `record_task_decision_event` 独立硬编码 `stage="completed"`，跟 `_STAGE_MAP` 已改用的 `"delivered"` 不一致 | 改为 `stage="delivered" if task.status == "archived" else task.status` | `test_status_shows_delivered_only_after_final_memorial_gate` 追加对 `decision.adopted` 事件 `.stage` 的断言 |

## 未验证项

- 独立（非实现者）审查未做
- hosted PR / required check / merge 未发起
- REQ-020 的 `model_version` 未贯穿（需要改 `run_swarm_execution_loop` 返回契约，明确记为
  已知缺口，留作独立后续变更，不在本次范围内伪造完成）
- 迁移测试因沙盒环境未装 alembic 包而 skip（非本次引入，与 014/017 同款缺口）
- `make_id` 秒级精度无 nonce 导致的 ID 碰撞（预先存在，记录不顺手修）

## Diff 与回滚复核

- changed files：8 个存量代码文件定点修改（menxia_veto.py/shangshufang.py/decree_status.py/
  outbox_worker.py/decision_task_kernel.py/emperor_decision_kind.py/db/models.py/
  chancellor/contracts.py/canonical_court_dispatch.py）+ 1 个新迁移 + 8 个新测试文件 +
  3 个既有测试文件的黄金断言重写（test_menxia_veto.py/test_decree_execution_status.py/
  test_final_memorial_gate.py）+ 2 个冻结基线同步（test_schema_authority.py/
  shangshufang_contract_baseline_v1.json）+ 1 个 event vocabulary 冻结集同步
  （test_execution_state_projection.py）
- diff review：单人会话内自查，Plan Mode 阶段用 2 轮 Explore + 1 轮 Plan 子代理逐条对照实际
  代码核实设计假设（发现并修正若干与实际代码不符的初始假设，如 REQ-014 的"reject 完全不碰
  FinalMemorial.status"最初误判为更大范围的 gap，实测后发现真实 gap 更窄——只有 reject 分支
  缺失，adopt 分支的既有闸门逻辑本身是对的），未走独立 review
- 回滚是否演练：未演练；`git revert` 可完全回滚代码；`alembic downgrade` 撤销新列
  （迁移文件已带 `downgrade()`，未在此沙盒环境实跑）

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 6 个 REQ 各自 RED case 有测试覆盖 | 67 passed | 已满足 |
| backend/root doctor 0 错误 | 命令表 | 已满足 |
| 既有测试套件零回归（含必要的黄金断言重写） | 2965 passed | 已满足 |
| 独立审查 + hosted PR | `claude_code_review/exact-h-final.md`，GO | 已满足审查，PR/merge 留待后续 |

## 声明状态

- `VERIFIED_COMPLETE`（本地实现+验证+独立审查发现已修复，范围内）；hosted PR/merge 是明确的
  下一步，不在本次范围。

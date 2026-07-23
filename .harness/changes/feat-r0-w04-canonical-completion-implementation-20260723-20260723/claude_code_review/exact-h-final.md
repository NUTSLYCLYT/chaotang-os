# Claude Code Exact-H Independent Review — R0-W04 canonical completion implementation

| Identity | Value |
| --- | --- |
| Base B | `38c2bf5880398447b735e9025c972c045d2cf7c4` |
| Candidate H | `14b4083368f1eb7f6ba02fb6106ecac9c745aa2c` |
| Tree | `1ffb259599ff166db09b284743d42fdb376e9724` |
| Canonical diff SHA-256（`git diff B..H`） | `fae12967b122b4976ef0a75adc6614076876cd2241520641ccd3ac25323796fe` |
| Scope | 2 commits（`0ff4b737` 实现 + `14b40833` 独立审查发现修复），27 文件，1144 insertions |
| Reviewer | Claude Code，独立（非实现者）会话，`code-reviewer` agent，只读 + 独立复测 |

## Verdict

| Lane | Verdict | Unresolved HIGH | Unresolved MEDIUM |
| --- | --- | ---: | ---: |
| Correctness（6 个 REQ RED case 保真度） | GO | 0 | 0 |
| Fail-closed guarantees（menxia/final-memorial/stage-map/execution-failed/identity/no-parallel-table） | GO | 0 | 0 |
| Git-Evidence / Scope | GO | 0 | 0 |

Combined verdict: **GO**（首轮 0 HIGH + 2 MEDIUM，全部已在 `14b40833` 修复并补回归测试；复测确认
0 未解决项）。

## 独立验证（重新跑，不采信实现方声明）

- `cd backend && python3 -m pytest tests/test_menxia_veto.py tests/test_final_memorial_gate.py tests/test_decree_execution_status.py tests/test_execution_failed_status.py tests/test_task_cancellation.py tests/test_identity_fields_thread_through_chain.py tests/test_canonical_completion_no_parallel_table.py tests/test_decree_stage_never_fakes_completion.py tests/test_emperor_decision_kind.py tests/test_execution_state_projection.py tests/test_schema_authority.py tests/test_shangshufang_contract_baseline.py -v` → 全绿
- `python3 -m pytest tests/ -q --ignore=tests/test_migration_018_canonical_completion_identity_fields.py` → 2965 passed, 38 skipped, 0 failed
- `python3 scripts/harness_doctor.py` → 0 errors, 0 warnings
- `node scripts/harness-doctor.mjs`（根目录）→ 0 errors, 0 warnings
- 用 `git worktree add` 独立核实 `test_schema_authority.py` 在父提交 `38c2bf58` 就已经 3/8 失败
  （migration 017 在 W03 落地时没同步 head pin）——本次收口是真实必要修复，不是范围蔓延。

## 对抗式核验（主动尝试破坏 fail-closed 保证）

1. REQ-013——逐行核实 `review_route()` 只剩 `veto = bool(reasons)` 单一路径，无其他 return
   分支能在 `veto_reasons` 非空时给出准奏。
2. REQ-014——`_archive_task` 唯一调用方是 `apply_task_decision` 的 adopt/approve/archive
   分支，闸门 `formal.status == "ready_for_decision"` 前置；reject 分支正确翻转
   `formal.status`，永久堵死重新 adopt 的路径。
3. REQ-018——`outbox_worker.py` 两处 dead_letter 落点（`process_event` 异常处理 +
   `_reap_stale_processing_events`）均调用 `_promote_task_to_execution_failed`；已终态任务
   不会被降级覆盖。**首轮发现真实漏洞**：cancel 围栏词表（`shangshufang.py`）与
   execution_failed 推进词表（`outbox_worker.py`）各自独立定义且已经不同步（前者漏
   `draft_cancelled`），已收口成单一 `TASK_TERMINAL_STATUSES` 共用常量。
4. REQ-022——`_STAGE_MAP` 拆分核实正确；全仓 grep 未发现其他遗漏的零质量门 `"completed"`
   写入点。**首轮发现真实漏洞**：`record_task_decision_event` 独立硬编码
   `stage="completed"`，跟 `_STAGE_MAP` 已经改用的 `"delivered"` 不一致——已收口。
5. REQ-020——`request_id` 创建时生成一次、后续不被覆盖；`_REQUEST_ID_FROM_TASK` 哨兵对无
   `request_id` 的旧行安全回退到 `None`，不抛异常。
6. REQ-008——migration 018 纯加列不加表；`FinalMemorial` 仍是唯一带 `task_id` 唯一约束的
   完成事实表；新增的类名哨兵测试结合唯一约束结构检查，双重防线不是纯装饰。
7. 迁移文件字段与 ORM 逐字段核对——`decision_tasks.request_id`、
   `decree_execution_events.request_id/release_id/model_version` 全部一致（迁移在此沙盒
   无法实跑，因 alembic 包未装，静态核对为准）。
8. 范围蔓延扫描——`shangshufang.py` 与并行任务 `fix-ui-runtime-incident-20260722` 共享
   改动，两轮提交均用 `git add -p` 精确分离（第二轮因相邻行导致的误并入已发现并用 `s`
   拆分重做），确认最终 diff 只含本包 6 个 REQ 对应的字面量改动。

## Findings

首轮独立 code-reviewer agent 审查发现 2 项 MEDIUM，均已在本 H 内修复：

- **MEDIUM-1（已修复）**：cancel 围栏词表与 execution_failed 推进词表各写各的且已不同步
  （漏 `draft_cancelled`）。
- **MEDIUM-2（已修复）**：`record_task_decision_event` 的 `"completed"` 字面量未随
  `_STAGE_MAP` 一起改成 `"delivered"`。

复测未发现新的未解决项。首轮审查同时确认一项与本次改动无关、不阻塞合并的既有信息：
`CHAOTANG_MENXIA_VETO` 环境变量是 `routing_service.py` 里未被本次触碰的全局开关，默认值
安全（启用强制执行），不影响 `review_route()` 本身已经做到的"有理由就一律封驳"。

## Non-authorization statement

本审查只确认 H 的实现质量、fail-closed 行为与既有代码约定一致性，不批准 R0-W05 及以后、真实
客户数据或上线。这是对已获批 W04 range 内实现工作的复核，不是新的范围批准。

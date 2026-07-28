# 规格说明：fix-r0-w08-records-auto-discovery-20260729

## 背景

W08 的最后硬门是 5 名非开发用户、至少 4 名成功的真实闭环验收记录。
此前 runner 支持显式传入 `--user-acceptance <path>`，但 closeout
默认命令无法从受治理的 `records/` 目录自动发现 approved evidence。
这会增加人工传错文件、遗漏文件或把草稿当最终证据的风险。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | W08 authority 当前为 GO；36 黄金合同和 10 浏览器 flow 已过；真实用户记录仍缺失 | `execution-authority-v2`、`run_w08_acceptance.py --closeout-preflight` | Codex / 本地命令 | 否 |
| 推测 | 用户记录会以单个 approved JSON 进入 `records/` | W08 runbook 与 submission checklist | Product Acceptance Owner | 否 |
| 未知问题 | 真实用户是否能达到 4/5 成功 | 不适用 | 需真实用户测试 | 是 |

## 数据流与调用链

`--closeout-preflight`
-> golden contracts gate
-> browser flow evidence gate
-> if `--user-acceptance` provided: validate explicit file
-> else: scan `user_acceptance/records/*.json`
-> require exactly one JSON file
-> validate W08 user acceptance payload
-> READY_FOR_CLOSEOUT or BLOCKED

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `records/*.json` | Product Acceptance Owner | W08 closeout preflight | exactly-one discovery + focused tests |
| `--user-acceptance <path>` | Reviewer / CLI caller | W08 user acceptance validator | explicit override remains compatible |

## 范围

- Add default records discovery to W08 closeout preflight.
- Fail closed when records directory is missing, empty, or ambiguous.
- Preserve explicit path validation.
- Update focused tests and user-facing checklist docs.

## 非目标

- Do not create real participant evidence.
- Do not close W08.
- Do not change backend product endpoints or frontend screens.
- Do not push, deploy, migrate databases, or operate 3050.

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| no JSON under `records/` | BLOCKED | focused test + CLI default preflight |
| exactly one JSON under `records/` | validate that file | focused test |
| multiple JSON files under `records/` | BLOCKED as ambiguous | focused test |
| explicit `--user-acceptance` supplied | validate explicit file | existing tests |

## 风险与回滚边界

Primary risk is false closeout caused by ambiguous evidence. The fix fails
closed unless there is exactly one approved JSON record. Rollback is limited to
the runner discovery behavior, focused tests, docs, and this Packet.

## 计划确认记录

- 批准人：用户持续授权“下一步/继续任务”，W08 authority GO
- 批准日期：20260729
- 批准范围：W08 Product Acceptance evidence intake hardening
- 明确未批准：push、deployment、database migration、listener 3050 operation、W09 activation

## 验收标准

- `run_closeout_preflight(records_dir=<missing>)` blocks with a records evidence requirement.
- `run_closeout_preflight(records_dir=<one valid JSON>)` becomes READY_FOR_CLOSEOUT.
- `run_closeout_preflight(records_dir=<multiple JSON>)` blocks as ambiguous.
- Current repository default preflight remains BLOCKED until real records exist.

## 验证计划

- `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py`
- `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight; test $? -eq 1`
- `cd backend && python3 scripts/harness_doctor.py`
- `node scripts/harness-doctor.mjs`
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- `git diff --check`

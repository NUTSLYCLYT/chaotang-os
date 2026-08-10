# 规格说明：fix-r0-w08-closeout-record-path-boundary-20260729

## 背景

W08 closeout 的真实用户验收记录必须进入受治理目录
`user_acceptance/records/`。上一阶段已支持默认扫描该目录，但显式
`--closeout-preflight --user-acceptance <path>` 仍可能指向 records 外的
有效 JSON，导致草稿、临时文件或 reviewer rehearsal 文件绕过目录边界。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | closeout preflight 可显式传入用户验收路径；当前 W08 仍缺真实 records JSON | focused RED test / default preflight | Codex | 否 |
| 推测 | 真实 approved record 会进入 `records/` | W08 runbook | Product Acceptance Owner | 否 |
| 未知问题 | 真实用户能否达成 4/5 成功 | 不适用 | 真实用户测试 | 是 |

## 数据流与调用链

`--closeout-preflight --user-acceptance <path>`
-> verify `<path>` is under `user_acceptance/records/`
-> run existing user acceptance validator
-> combine with golden contracts and browser flow gates
-> READY_FOR_CLOSEOUT or BLOCKED

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| closeout explicit user acceptance path | CLI caller / reviewer | W08 closeout preflight | must be inside `records/` |
| `records/*.json` | Product Acceptance Owner | W08 closeout preflight | default discovery requires exactly one JSON |

## 范围

- Add closeout-only path boundary validation.
- Preserve file-level `--user-acceptance` validation for targeted checks.
- Update focused tests and user acceptance docs.

## 非目标

- Do not create real user records.
- Do not close W08.
- Do not change backend product endpoints or frontend screens.
- Do not push, deploy, migrate DB, or operate 3050.

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| explicit closeout path outside `records/` | BLOCKED | focused RED/GREEN test |
| explicit closeout path inside `records/` | existing validator result | focused test |
| default closeout with empty records | BLOCKED | CLI check |

## 风险与回滚边界

Risk is false closeout based on a valid but unmanaged JSON file. Rollback is
limited to the closeout path boundary helper, focused tests, docs, and this
change record.

## 计划确认记录

- 批准人：用户授权长时任务继续 W08 后续 harness 收口
- 批准日期：20260729
- 批准范围：W08 closeout evidence path-boundary hardening
- 明确未批准：push、deployment、database migration、listener 3050 operation、W09 activation

## 验收标准

- Focused test fails before implementation because records-external explicit
  path is accepted.
- Focused test passes after implementation.
- Current default preflight remains BLOCKED because real user records are absent.

## 验证计划

- `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py`
- `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight; test $? -eq 1`
- `cd backend && python3 scripts/harness_doctor.py`
- `node scripts/harness-doctor.mjs`
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- `git diff --check`

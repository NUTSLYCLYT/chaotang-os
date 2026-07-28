# 规格说明：fix-r0-w08-reject-fixture-records-20260729

## 背景

W08 已新增用户验收 fixture，便于 reviewer rehearsal。发现风险：fixture payload 的结构本身满足最终 user acceptance 条件，如果被误用为 `records/<approved-record>.json`，closeout preflight 可能误过。

本变更让最终验收 fail closed：fixture 只能用于显式 `allow_fixture=True` 的测试形状演练，不能作为最终证据。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 旧 validator 接受 `fixture-user-*` | RED focused pytest | TDD | 是，已修复 |
| 已确认事实 | 新 validator 拒绝 fixture final evidence | focused pytest / CLI | Backend Harness | 否 |
| 未完成事实 | 真实用户记录仍未提交 | `user_acceptance/records/` | Product Acceptance Owner | 是，阻塞 W08 closeout |

## 数据流与调用链

```text
fixture payload
-> validate_user_acceptance_payload(..., allow_fixture=True)
-> shape rehearsal only

final record
-> run_user_acceptance
-> rejects fixture: true and fixture-* IDs
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `allow_fixture` | W08 validator | focused tests only | default false |
| Fixture rejection | W08 validator | closeout / QA auditor | pytest |

## 范围

- Add fixture rejection for final payloads.
- Add focused tests for `fixture: true` and `fixture-*` IDs.
- Update fixture README and acceptance rules.
- Add root change record.

## 非目标

- 不创建真实用户验收记录。
- 不关闭 W08。
- 不激活 W09。
- 不修改产品运行时代码。
- 不 push、不部署、不迁移数据库、不操作 3050。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| fixture shape rehearsal | pass only with `allow_fixture=True` | pytest |
| `run_user_acceptance(fixture)` | fail | pytest / CLI |
| final participant ID starts with `fixture-` | fail | pytest |
| normal real-shaped non-fixture records | pass | existing tests |

## 风险与回滚边界

风险：未来真实用户 ID accidentally uses `fixture-` prefix.

缓解：`fixture-` prefix is reserved for harness examples. Real records should use neutral IDs such as `user-001`.

回滚：revert runner/test/docs hunk and this change record.

## 计划确认记录

- 批准人：User
- 批准日期：2026-07-29
- 批准范围：继续 W08 下一步，修复 fixture 被误当最终验收风险。
- 明确未批准：push、deployment、database migration、3050 operation、fake user acceptance、W08 closeout、W09 activation。

## 验收标准

- Focused pytest 通过。
- fixture CLI final validation 失败。
- no-user closeout preflight 仍 BLOCKED。
- backend/root doctor 通过。
- W08 authority 仍 GO。

## 验证计划

```bash
python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py
python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --user-acceptance backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/fixtures/valid_closeout_example.json; test $? -eq 1
python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight; test $? -eq 1
cd backend && python3 scripts/harness_doctor.py
node scripts/harness-doctor.mjs
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08
git diff --check
```

# 规格说明：test-r0-w08-user-acceptance-fixture-20260729

## 背景

W08 已具备用户验收 validator、closeout preflight 和执行 runbook。真实用户测试执行前，还需要一个可运行的合格 JSON 例子，帮助 reviewer 和 Product Acceptance Owner 校准记录形状，减少真实记录提交时的格式错误。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | fixture 能通过用户验收 validator | `valid_closeout_example.json` | focused pytest / CLI | 否 |
| 已确认事实 | fixture 不在真实 records 目录 | `user_acceptance/fixtures/` | focused pytest | 否 |
| 未完成事实 | 真实用户记录仍未提交 | `user_acceptance/records/` | Product Acceptance Owner | 是，阻塞 W08 closeout |

## 数据流与调用链

```text
valid_closeout_example.json
-> --user-acceptance
-> --closeout-preflight
-> reviewer rehearsal only
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| Fixture JSON | Backend product acceptance harness | tests / reviewer rehearsal | pytest |
| Real records | future user sessions | W08 closeout | not provided by this Packet |

## 范围

- Add `fixtures/README.md`.
- Add `fixtures/valid_closeout_example.json`.
- Add focused test ensuring fixture is valid but not under `records/`.
- Add backend harness manifest entries.

## 非目标

- 不提交真实用户验收记录。
- 不关闭 W08。
- 不激活 W09。
- 不修改产品运行时代码。
- 不 push、不部署、不迁移数据库、不操作 3050。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| fixture 缺失 | focused pytest fail | RED |
| fixture 放入 records | focused pytest fail | test path assertion |
| fixture 形状不合法 | user acceptance fail | focused pytest |

## 风险与回滚边界

风险：fixture 被误复制为真实验收记录。

缓解：fixture README、payload `fixture: true`、summary 和 tests 均明确它不是真实证据；真实 closeout 仍应使用 `records/<approved-record>.json`。

回滚：删除 fixture、测试 hunk、manifest hunk 和本 change record。

## 计划确认记录

- 批准人：User
- 批准日期：2026-07-29
- 批准范围：继续 W08 下一步，建立 field-test evidence intake fixture。
- 明确未批准：push、deployment、database migration、3050 operation、fake user acceptance、W08 closeout、W09 activation。

## 验收标准

- Focused pytest 通过。
- fixture CLI validation 通过。
- no-user closeout preflight 仍 BLOCKED。
- Backend/root doctor 通过。
- W08 authority 仍为 GO。

## 验证计划

```bash
python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py
python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --user-acceptance backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/fixtures/valid_closeout_example.json
python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight; test $? -eq 1
cd backend && python3 scripts/harness_doctor.py
node scripts/harness-doctor.mjs
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08
git diff --check
```

# 规格说明：feat-r0-w08-user-acceptance-gate-20260728

## 背景

R0-W08 已完成 36/36 黄金合同矩阵和 10/10 real-backend browser flow。剩余关闭条件是 5 名非开发用户无陪同验收，其中至少 4 名成功完成完整合同审查闭环。

本变更把用户验收记录从口头状态改为可校验证据，防止将本地自动化通过误报为真实用户验收通过。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | W08 authority 为 GO | `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | EXT Master Governance | 否 |
| 已确认事实 | 用户验收校验器和测试已建立 | `backend/tests/test_w08_product_acceptance_harness.py` | Backend Harness | 否 |
| 未完成事实 | 真实 5 名非开发用户记录尚未提交 | `product_acceptance/user_acceptance/records/` 仅含 README | Product Acceptance Owner | 是，阻塞 W08 closeout |

## 数据流与调用链

```text
real user session
-> deidentified JSON record
-> run_w08_acceptance.py --user-acceptance <record>
-> pass/fail evidence
-> W08 closeout review
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `w08-user-acceptance.v1` | Product Acceptance Owner | W08 closeout / QA Auditor | `validate_user_acceptance_payload` |
| `records/<approved-record>.json` | Real user session evidence | `run_user_acceptance` | CLI exit code and JSON summary |

## 范围

- 增加 W08 用户验收 JSON schema-like validator。
- 增加用户验收模板和空记录目录说明。
- 将新增用户验收资产登记到 backend harness manifest。
- 增加 focused tests 覆盖 pass/fail 条件。

## 非目标

- 不生成真实用户记录。
- 不修改产品运行时代码。
- 不新增页面、Agent、BFF 或状态机。
- 不 push、不部署、不迁移数据库、不操作 3050。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 记录少于 5 人 | fail closed | pytest |
| 开发参与者或工程师指导 | fail closed | pytest |
| 成功人数少于 4 | fail closed | validator |
| 成功记录缺少下载或史馆回读证据 | fail closed | validator |
| 合格 5 人记录且至少 4 成功 | GO for user evidence | pytest fixture |

## 风险与回滚边界

风险：模板可能被误认为真实验收记录。

缓解：模板放在 `user_acceptance/` 根下，`records/` 只保留 README；README 明确禁止 synthetic、assisted 或 developer-authored 记录作为最终证据。

回滚：回退本 Packet 即移除用户验收门，不影响产品运行代码。

## 计划确认记录

- 批准人：User
- 批准日期：2026-07-28
- 批准范围：继续 W08，建立非开发用户验收门，local only
- 明确未批准：push、deployment、database migration、3050 operation、fake user acceptance

## 验收标准

- Focused pytest 通过。
- Golden W08 runner 仍通过。
- Backend/root harness doctor 通过。
- W08 authority 仍为 GO。
- 明确记录 W08 仍缺真实非开发用户验收。

## 验证计划

```bash
python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py
python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py
cd backend && python3 scripts/harness_doctor.py
node scripts/harness-doctor.mjs
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08
git diff --check
```

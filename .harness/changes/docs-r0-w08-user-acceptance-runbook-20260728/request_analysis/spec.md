# 规格说明：docs-r0-w08-user-acceptance-runbook-20260728

## 背景

R0-W08 当前机器证据已经聚合到 closeout preflight，但真实非开发用户验收仍未执行。为了让验收能被非开发用户、观察者和 QA 审计一致执行，本变更把执行流程和提交要求固化到后端 product acceptance harness。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | R0-W08 authority 为 GO | `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | EXT governance | 否 |
| 已确认事实 | 执行资料已登记到 backend harness manifest | `backend/harness/manifest.json` | backend doctor | 否 |
| 未完成事实 | 真实 5 名用户记录尚未提交 | `user_acceptance/records/` | Product Acceptance Owner | 是，阻塞 W08 closeout |

## 数据流与调用链

```text
session_runbook
-> observer_checklist
-> deidentified JSON record
-> --user-acceptance
-> --closeout-preflight
-> W08 closeout review
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| Session runbook | Product Acceptance harness | facilitator / observer | manifest + doctor |
| Observer checklist | Product Acceptance harness | observer | manifest + doctor |
| Acceptance rules | Product Acceptance harness | QA auditor | manifest + doctor |
| Submission checklist | Product Acceptance harness | W08 closeout owner | manifest + doctor |

## 范围

- 增加用户验收执行材料。
- 更新 user acceptance README。
- 将执行材料登记到 backend harness manifest。
- 创建根级 change record。

## 非目标

- 不创建真实用户验收记录。
- 不关闭 W08。
- 不激活 W09。
- 不修改产品运行时代码。
- 不 push、不部署、不迁移数据库、不操作 3050。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 缺少执行材料 | backend doctor fail | manifest required files |
| 无真实 records | W08 closeout 仍 BLOCKED | closeout preflight |
| 使用开发者/被指导用户 | 不计为成功 | acceptance rules |

## 风险与回滚边界

风险：执行包被误读为验收完成。

缓解：summary、README、submission checklist 均明确本 Packet 不包含真实用户记录，不能关闭 W08。

回滚：删除新增执行材料并回退 manifest/README hunk。

## 计划确认记录

- 批准人：User
- 批准日期：2026-07-28
- 批准范围：继续 W08 下一步，建立真实用户验收执行包。
- 明确未批准：push、deployment、database migration、3050 operation、fake user acceptance、W08 closeout、W09 activation。

## 验收标准

- Focused pytest 仍通过。
- Backend/root harness doctor 通过。
- W08 authority 仍为 GO。
- closeout preflight 仍在无用户记录时 BLOCKED。

## 验证计划

```bash
python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py
python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight; test $? -eq 1
cd backend && python3 scripts/harness_doctor.py
node scripts/harness-doctor.mjs
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08
git diff --check
```

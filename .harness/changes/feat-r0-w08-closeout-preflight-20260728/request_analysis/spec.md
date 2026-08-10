# 规格说明：feat-r0-w08-closeout-preflight-20260728

## 背景

R0-W08 已完成黄金合同矩阵、真实后端浏览器 flow 和用户验收记录格式。剩余风险是 closeout 时把分散证据误读为完成。本变更增加一个 fail-closed preflight，由机器聚合三类硬门。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 36 黄金合同 runner 通过 | `run_w08_acceptance.py` | Backend Harness | 否 |
| 已确认事实 | 10 browser flow evidence packet 存在 | `.harness/changes/feat-r0-w08-browser-flow-batch{1,2,3,4}-20260728` | Preflight scan | 否 |
| 未完成事实 | 真实用户验收记录尚未提交 | `user_acceptance/records/` | Product Acceptance Owner | 是，阻塞 W08 closeout |

## 数据流与调用链

```text
golden runner
+ browser evidence scan
+ user acceptance runner
-> W08_CLOSEOUT_PREFLIGHT
-> READY_FOR_CLOSEOUT or BLOCKED
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `run_closeout_preflight` | W08 product acceptance runner | W08 closeout / QA auditor | pytest |
| Browser evidence packets | W08 Playwright batch packets | preflight scan | change record + ci summary |
| User acceptance record | Product Acceptance Owner | preflight / closeout | `w08-user-acceptance.v1` |

## 范围

- 增加 W08 closeout preflight 函数和 CLI flag。
- 增加 focused tests：无用户记录 BLOCKED，有合格记录 READY_FOR_CLOSEOUT。
- 更新 README 说明 closeout 命令。

## 非目标

- 不生成真实用户验收记录。
- 不关闭 W08。
- 不激活 W09。
- 不修改产品运行时代码。
- 不 push、不部署、不迁移数据库、不操作 3050。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 无 `--user-acceptance` | `BLOCKED` | pytest + CLI |
| 黄金合同不满 36 或失败 | `BLOCKED` | preflight gate |
| browser evidence 不满 10 | `BLOCKED` | preflight gate |
| 用户验收合格 | `READY_FOR_CLOSEOUT` | pytest fixture |

## 风险与回滚边界

风险：browser evidence scan 依赖 W08 batch change record 的固定 ID。

缓解：这些 batch 是 W08 既有验收事实源；若未来重跑 browser acceptance，应新建 Packet 并更新 preflight 固定清单。

回滚：回退本 Packet 即恢复原 runner，无产品运行影响。

## 计划确认记录

- 批准人：User
- 批准日期：2026-07-28
- 批准范围：继续 W08 收口前置门，local only。
- 明确未批准：push、deployment、database migration、3050 operation、fake user acceptance、W09 activation。

## 验收标准

- Focused pytest 通过。
- `--closeout-preflight` 在无用户验收记录时 fail closed。
- 既有 golden runner 仍通过。
- 后端/root doctor 通过。
- W08 authority 仍为 GO。

## 验证计划

```bash
python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py
python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py
python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight; test $? -eq 1
cd backend && python3 scripts/harness_doctor.py
node scripts/harness-doctor.mjs
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08
git diff --check
```

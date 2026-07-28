# 规格说明：feat-r0-w08-golden-matrix-batch1-20260728

## 背景

R0-W08 Product Acceptance Hardening 已建立 1 个 RUNNABLE_MINIMUM 黄金合同入口。本 Batch 1 将黄金合同矩阵扩展到 6 个合成、无客户秘密样本，为后续 36/36 和真实浏览器验收打底。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | W08 v2 authority 返回 GO | `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | EXT governance | 否 |
| 已确认事实 | Batch 1 扩展为 6 个黄金合同 | `w08_contracts.json` | runner / pytest | 否 |
| 已确认事实 | 覆盖 6 个类别与 10 个风险族 | runner `coverage` 输出 | pytest | 否 |
| 未完成 | 36 黄金合同、10/10 浏览器、5 人用户验收 | 不适用 | W08 后续 Packet | 是，阻止 W08 closeout |

## 数据流与调用链

```text
golden contract matrix
-> W08 acceptance validator
-> focused pytest
-> later real backend browser flow
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| Golden matrix | `w08_contracts.json` | W08 validator / QA | 6 case ids unique |
| Coverage | `run_w08_acceptance.py` | pytest / CLI | categories and risk families sorted |

## 范围

- 扩展黄金合同样本到 6 个。
- 增加 validator coverage 输出。
- focused test 固定 Batch 1 覆盖面。

## 非目标

- 不执行真实浏览器 10/10。
- 不执行非开发用户验收。
- 不关闭 W08。
- 不 push、不部署、不迁移数据库、不操作 3050。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| case_id 重复 | validator FAIL | payload validation |
| 缺少 coverage 输出 | pytest FAIL | focused test |
| 样本未覆盖扩展风险族 | pytest FAIL | risk_families assertion |

## 风险与回滚边界

风险：6/36 被误读为完成。缓解：Packet 状态 `VERIFIED_PARTIAL`，CI 和 summary 明确最终目标未完成。

## 计划确认记录

- 批准人：User / Product Owner
- 批准日期：20260728
- 批准范围：W08 下一步，扩展黄金合同矩阵第一批。
- 明确未批准：push、部署、数据库迁移、3050、W08 closeout、W09。

## 验收标准

- Runner 返回 `passed: true`、`cases: 6`。
- Coverage 返回 6 个类别、10 个风险族、case_id 唯一。
- Focused pytest 通过。

## 验证计划

- `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py`
- `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py`
- `python3 backend/scripts/harness_doctor.py`
- `node scripts/harness-doctor.mjs`
- `git diff --check`

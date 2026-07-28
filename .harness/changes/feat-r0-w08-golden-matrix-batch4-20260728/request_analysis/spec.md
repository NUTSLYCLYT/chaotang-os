# 规格说明：feat-r0-w08-golden-matrix-batch4-20260728

## 背景

Batch 3 已将 W08 黄金合同矩阵推进到 `18/36`。本 Packet 继续按小批量、可验证方式推进到 `24/36`，不改变产品运行逻辑，不启动 W09。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 本 Packet 新增 6 个合成、无客户秘密 case | `w08_contracts.json` | runner | 否 |
| 已确认事实 | focused test expectation 已同步到 24 case | `backend/tests/test_w08_product_acceptance_harness.py` | pytest | 否 |

## 数据流与调用链

`w08_contracts.json` -> `run_w08_acceptance.py` -> coverage/case validation -> pytest regression。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| Golden contract case | W08 JSON matrix | W08 runner | 与前 18 case 同 schema |
| Focused regression expectation | pytest | CI/local validation | 锁定 `cases == 24` 与 coverage categories |

## 范围

- 新增 6 个黄金合同 case。
- 更新 focused test 期望。
- 更新本 Packet 文档。

## 非目标

- 不执行 browser 10/10。
- 不做非开发用户验收。
- 不接金融数据源。
- 不启动 W09。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| JSON 语法错误 | parse fail | `python3 -m json.tool` |
| case schema 不合规 | runner fail | `run_w08_acceptance.py` |
| focused expectation 漂移 | pytest fail | `test_w08_product_acceptance_harness.py` |

## 风险与回滚边界

- 风险：24/36 仍不是 W08 完整验收。
- 风险：真实 browser flow 和用户验收仍未完成。
- 回滚：还原 JSON/test，删除本 Packet 目录。

## 计划确认记录

- 批准人：用户要求继续推进 W08
- 批准日期：20260728
- 批准范围：W08 黄金合同矩阵 Batch 4
- 明确未批准：push、deploy、DB migration、3050、W09、生产声明

## 验收标准

- W08 runner 输出 `cases: 24` 且 `passed: true`。
- focused pytest 通过。
- backend/root doctor 通过。
- diff check 通过。

## 验证计划

- `python3 -m json.tool backend/harness/chaotang-true-loop/product_acceptance/golden_cases/w08_contracts.json`
- `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py`
- `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py`
- `python3 backend/scripts/harness_doctor.py`
- `node scripts/harness-doctor.mjs`
- `git diff --check`

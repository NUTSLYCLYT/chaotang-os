# 规格说明：feat-r0-w08-golden-matrix-batch2-20260728

## 背景

R0-W08 的验收目标是 36 个黄金合同、10/10 real backend browser flow、5 名非开发用户至少 4 人成功。当前 EXT 已完成 RUNNABLE_MINIMUM 与 Batch 1，黄金合同为 `6/36`。本 Packet 按“先跑通、后完善”的加速策略，将矩阵扩展到 `12/36`，但不改变运行时产品逻辑。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 当前 W08 runner 读取 `w08_contracts.json` 并校验 case schema、artifact kinds、lineage fields、browser flow steps、download、audit replay | `backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py` | 源码只读 | 否 |
| 已确认事实 | Batch 1 后已有 6 个黄金合同并通过 runner | `backend/harness/chaotang-true-loop/product_acceptance/golden_cases/w08_contracts.json` | 源码只读 + runner | 否 |
| 已确认事实 | 本 Packet 新增 6 个中文制造业/B2B 合同 case，全部沿用既有 schema | 本 diff | TDD/validator | 否 |

## 数据流与调用链

`w08_contracts.json`
-> `run_w08_acceptance.py`
-> per-case schema/lineage/browser-flow/download/audit-replay validation
-> W08 Product Acceptance coverage report。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| Golden contract case | `w08_contracts.json` | W08 runner | 与既有 6 case 同 schema |
| ContractReviewPack requirement | 每个 case 的 `contract_review_pack` | W08 runner / later browser flow | 必须含 PDF/DOCX/JSON 和完整 lineage |
| Browser flow requirement | 每个 case 的 `browser_flow` | W08 runner / later Playwright | 必须覆盖上传、解析、审查、补证、裁决、生成、下载、回放 |

## 范围

- 新增 6 个 W08 黄金合同 case。
- 更新 Packet 文档和验证证据。
- 保持 `mode: RUNNABLE_MINIMUM`，最终目标仍是 36。

## 非目标

- 不实现新的后端 API。
- 不实现新的前端页面。
- 不新增 Agent。
- 不执行 browser 10/10。
- 不进行非开发用户测试。
- 不启动 W09。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| case_id 重复 | runner fail | `coverage_for` |
| 缺 PDF/DOCX/JSON | runner fail | `validate_case` |
| 缺 lineage 字段 | runner fail | `validate_case` |
| 非 `/shangshufang`/`/shiguan` | runner fail | `validate_case` |
| mock browser flow | runner fail | `validate_case` |

## 风险与回滚边界

- 风险：黄金合同仍是 harness acceptance matrix，不等同于真实用户 browser 成功。
- 风险：12/36 只代表覆盖扩大，不代表 W08 完整完成。
- 回滚：还原 `w08_contracts.json` 与删除本 change 目录。

## 计划确认记录

- 批准人：用户要求“加速尽快做完”
- 批准日期：20260728
- 批准范围：W08 黄金合同矩阵 Batch 2
- 明确未批准：push、deploy、DB migration、3050、W09、产品运行代码大改

## 验收标准

- W08 runner 显示 `cases: 12` 且 `passed: true`。
- Focused pytest 通过。
- Backend/root harness doctor 通过。
- Diff check 通过。

## 验证计划

- `python3 -m json.tool backend/harness/chaotang-true-loop/product_acceptance/golden_cases/w08_contracts.json`
- `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py`
- `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py`
- `python3 backend/scripts/harness_doctor.py`
- `node scripts/harness-doctor.mjs`
- `git diff --check`

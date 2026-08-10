# 变更摘要：feat-r0-w08-golden-matrix-batch5-20260728

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | feat-r0-w08-golden-matrix-batch5-20260728 |
| 类型 | feat |
| 状态 | VERIFIED_PARTIAL |
| Owner | Project Agent |
| 创建日期 | 20260728 |

## 范围

- 主线：R0-W08 Product Acceptance Hardening。
- 文件：
  - `backend/harness/chaotang-true-loop/product_acceptance/golden_cases/w08_contracts.json`
  - `backend/tests/test_w08_product_acceptance_harness.py`
  - `.harness/changes/feat-r0-w08-golden-matrix-batch5-20260728/`
- 验证：JSON parse、W08 runner、focused pytest、backend/root doctor、authority、diff check。

## 目标

将 W08 黄金合同矩阵从 `24/36` 扩展到 `30/36`。

## 新增场景

- 设备融资租赁。
- 委托研发与成果归属。
- 包装标识合规。
- 供应商审计权。
- 备件长期供货。
- 质量保证金扣留。

## 边界

- 不新增页面。
- 不新增 Agent。
- 不修改产品运行代码。
- 不 push、不部署、不迁移数据库、不操作 3050。

# 变更摘要：feat-r0-w08-golden-matrix-batch2-20260728

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | feat-r0-w08-golden-matrix-batch2-20260728 |
| 类型 | feat |
| 状态 | VERIFIED_PARTIAL |
| Owner | Project Agent |
| 创建日期 | 20260728 |

## 范围

- 主线：R0-W08 Product Acceptance Hardening。
- 文件：
  - `backend/harness/chaotang-true-loop/product_acceptance/golden_cases/w08_contracts.json`
  - `.harness/changes/feat-r0-w08-golden-matrix-batch2-20260728/`
- 验证：
  - W08 product acceptance runner
  - focused pytest
  - backend/root harness doctor
  - diff check

## 目标

将 W08 黄金合同矩阵从 `6/36` 扩展到 `12/36`，继续覆盖中文制造业/B2B 合同审查闭环。

## 新增场景

| Case | 场景 | 风险族 |
| --- | --- | --- |
| `w08-cn-manufacturing-tooling-007` | 开模/工装采购 | ip, payment |
| `w08-cn-manufacturing-after-sales-008` | 售后服务 | warranty, liability |
| `w08-cn-manufacturing-equipment-installation-009` | 设备安装调试 | acceptance, delivery |
| `w08-cn-manufacturing-long-term-supply-010` | 长期供货框架 | payment, termination |
| `w08-cn-manufacturing-quality-recall-011` | 批量质量/召回 | compliance, warranty |
| `w08-cn-manufacturing-mold-ownership-012` | 模具归属/保密/争议 | confidentiality, dispute |

## 边界

- 不新增页面。
- 不新增 Agent。
- 不修改产品运行代码。
- 不 push、不部署、不迁移数据库、不操作 3050。

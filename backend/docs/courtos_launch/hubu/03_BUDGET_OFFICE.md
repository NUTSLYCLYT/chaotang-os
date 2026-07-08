# 预算司设计

## 本文件目的

定义户部预算司: 负责预算、占用、偏差、超支预警。预算司不替老板花钱, 只判断“这笔钱是否在计划内”。

## 职责

- 年度/月度/项目/部门预算。
- 已用额度。
- 已承诺未支付额度。
- 预算剩余额度。
- 超支比例。
- 偏差解释。
- 预算确认门。

## 输入数据

| 输入 | sourceLabel | P0/P1 | 说明 |
| --- | --- | --- | --- |
| 预算表 | `internal_uploaded_file` | P0 | 预算基准 |
| 项目立项单 | `internal_uploaded_file` | P0 | 项目预算 |
| 采购/合同/付款申请 | `internal_uploaded_file` | P0 | 预算占用 |
| 手工确认预算 | `manual_confirmed` | P0 | 可用但需留痕 |

## 输出 contract 草案

```json
{
  "budgetId": "budget-2026-marketing",
  "budgetAmount": 0,
  "actualUsed": 0,
  "committedAmount": 0,
  "remainingAmount": 0,
  "variancePercent": 0,
  "status": "within_budget|near_limit|over_budget|needs_evidence",
  "evidence": []
}
```

## 裁决门

- `within_budget`: 可继续进入现金/投资/付款判断。
- `near_limit`: 提醒老板, 可要求部门说明。
- `over_budget`: 必须二次确认。
- `needs_evidence`: 缺预算表或缺付款依据。

## 当前融合点

- 与投资司: 初始投入必须占用预算或说明资金来源。
- 与出纳司: 预算通过不代表账上有钱。
- 与审计司: 预算表、合同和付款申请必须能回链。

## 后续 Codex 可执行任务

- 新增 `src/hubu_budget_validators.py`。
- 增加预算占用和超支测试。
- 将预算结果写入户部奏折。


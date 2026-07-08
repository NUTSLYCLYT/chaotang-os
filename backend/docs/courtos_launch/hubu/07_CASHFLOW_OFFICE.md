# 现金流司设计

## 本文件目的

定义户部现金流司: 负责 30/60/90 天资金缺口、回款、付款、偿债压力。现金流司优先级高于利润。

## 职责

- 回款计划。
- 付款计划。
- 银行余额和可用资金引用。
- 30/60/90 天现金流预测。
- 最低现金安全线。
- 融资需求。
- 回款延期压力测试。

## 当前可复用实现

- `finance_cashflow` prompt。
- `ar_aging()` 应收账龄与控制数闸。
- `ratios()` 可支撑偿债基础指标。
- 出纳司未来提供 `availableCash`。

## 输出 contract 草案

```json
{
  "asOf": "2026-06-21",
  "openingCash": 0,
  "expectedReceipts": [],
  "expectedPayments": [],
  "netCashFlow30d": 0,
  "netCashFlow60d": 0,
  "netCashFlow90d": 0,
  "minimumCashLine": 0,
  "fundingGap": 0,
  "status": "safe|watch|gap|needs_evidence"
}
```

## 裁决门

- 30/60/90 天任一窗口跌破最低现金安全线: 不得自动批准大额投资。
- 回款证据不完整: `needs_evidence`。
- 应收明细与控制数差异过大: 进入审计司。

## 后续 Codex 可执行任务

- 新增 `src/hubu_cashflow_validators.py`。
- 增加 30/60/90 天现金流纯函数。
- 与出纳司余额和预算司付款计划融合。


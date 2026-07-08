# 出纳司设计

## 本文件目的

定义户部出纳司: 负责真实资金余额、收付款流水、付款确认门。出纳司回答老板最直接的问题: 现在账上有多少钱, 今天能不能付。

## 职责

- 银行余额。
- 现金余额。
- 今日收款。
- 今日付款。
- 未到账款。
- 待付款。
- 可用资金。
- 大额付款确认门。

## 输入数据

| 输入 | sourceLabel | P0/P1 | 说明 |
| --- | --- | --- | --- |
| 银行流水导出 | `internal_uploaded_file` | P0 | 出纳司核心事实 |
| 网银余额截图/文件 | `internal_uploaded_file` | P0 | 可作为 evidence |
| 手工确认余额 | `manual_confirmed` | P0 | 可用, 但需操作者 |
| 用户口述余额 | `internal_user_input` | P0 | 不可直接付款 |

## 输出 contract 草案

```json
{
  "asOf": "2026-06-21T20:00:00+08:00",
  "cashBalance": 0,
  "bankBalance": 0,
  "availableCash": 0,
  "todayReceipts": [],
  "todayPayments": [],
  "pendingPayments": [],
  "paymentGate": {
    "status": "ready|needs_evidence|blocked",
    "reason": ""
  },
  "evidence": []
}
```

## 裁决门

- 无真实余额, 不允许批准付款。
- 大额付款、供应商付款、关联方付款必须二次确认。
- 付款对象、合同、发票、预算任一缺失, 状态为 `needs_evidence`。

## 当前融合点

- 通过 `sourceLabel` 与 `evidence` 接入审计司。
- 通过 `availableCash` 接入现金流司。
- 通过 `pendingPayments` 接入预算司和风控司。

## 后续 Codex 可执行任务

- 新增 `src/hubu_treasury_contract.py`。
- 增加资金日记账样例 JSON。
- 增加付款确认门纯函数和测试。


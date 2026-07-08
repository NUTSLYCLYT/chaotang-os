# 会计司设计

## 本文件目的

定义户部会计司的边界: 负责把业务事实变成可勾稽的账务事实, 为投资、预算、现金流和风控提供地基。

## 职责

- 凭证结构化。
- 科目归类。
- 收入、成本、费用、资产、负债、权益识别。
- 资产负债表、利润表、现金流量表基础事实包。
- 三表勾稽与会计恒等式校验。

## 输入数据

| 输入 | sourceLabel | P0/P1 | 说明 |
| --- | --- | --- | --- |
| 审计报表/财务报表 | `internal_uploaded_file` | P0 | 最可信入口 |
| 会计科目余额表 | `internal_uploaded_file` | P0 | 生成三表事实 |
| 凭证导出 | `internal_uploaded_file` | P1 | 后续用于穿透 |
| 用户口述数字 | `internal_user_input` | P0 | 只能待补证 |

## 当前可复用实现

- `src/finance_validators.py`
  - `accounting_identity()`
  - `tie_out()`
  - `ratios()`
  - `sanity_guards()`
- `src/finance_data_parser.py`
- `src/finance_facts.py`

## 输出 contract 草案

```json
{
  "period": "2026-06",
  "statements": {
    "balanceSheet": {},
    "incomeStatement": {},
    "cashFlowStatement": {}
  },
  "checks": [],
  "sourceLabel": "internal_uploaded_file",
  "evidence": []
}
```

## 裁决门

- `ready`: 资产=负债+权益, 核心科目来源完整。
- `needs_evidence`: 口述数据或缺少报表附件。
- `invalid`: 会计恒等式不平, 或净利率高于毛利率等明显非法。

## 后续 Codex 可执行任务

- 新增 `src/hubu_accounting_contract.py`。
- 增加会计事实包测试。
- 把会计事实包接入 `verified_facts`。


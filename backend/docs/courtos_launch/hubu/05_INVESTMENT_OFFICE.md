# 投资司设计

## 本文件目的

记录当前已落地的户部投资司能力, 并定义下一步接真实数据的方式。

## 当前已落地

- `config/flow_finance.yaml` 中已有 `finance_investment` step。
- `runtime_prompts/finance_investment/` 已定义企业投资备忘录。
- `src/finance_validators.py` 已有:
  - `investment_source_gate()`
  - `investment_metrics()`
  - `investment_decision_gate()`
- 已支持设备投资、项目投资、融资估值、企业股权投资框架。

## 支持的确定性测算

| 指标 | 公式 | 状态 |
| --- | --- | --- |
| 年度净现金流 | 收入增量 + 节省 - 成本增量 - 维护费 - 融资成本 - 税费 | 已有 |
| 累计净收益 | 年度净现金流 * 项目年限 | 已有 |
| ROI | 累计净收益 / 初始投入 | 已有 |
| 静态回收期 | 初始投入 / 年度净现金流 * 12 | 已有 |
| 投后估值 | 投前估值 + 投资额 | 已有 |
| 持股比例 | 投资额 / 投后估值 | 已有 |

## 禁止范围

- 个股。
- 证券。
- 基金。
- 期货/期权。
- 买入、卖出、加仓、减仓、仓位建议。
- 承诺收益率。

## 下一步真实数据样例

```json
{
  "caseId": "hubu-investment-demo-001",
  "investmentType": "equipment",
  "initial_investment": 1200000,
  "annual_revenue_delta": 900000,
  "annual_cost_delta": 520000,
  "annual_savings": 80000,
  "project_years": 3,
  "sources": {
    "initial_investment": {
      "sourceLabel": "internal_uploaded_file",
      "ref": "equipment_quote.pdf"
    },
    "annual_net_cash_flow": {
      "sourceLabel": "manual_confirmed",
      "ref": "boss_review_20260621"
    }
  }
}
```

## 后续 Codex 可执行任务

- 新增 `scripts/golden_cases/finance_investment_fact_pack.json` 或 `tests/fixtures/hubu_investment_fact_pack.json`。
- 写一个只读 demo 测试, 验证 ready/needs_evidence/invalid 三态。
- 后续再接 `smoke_all.py finance`, 不在文档 PR 内触发。


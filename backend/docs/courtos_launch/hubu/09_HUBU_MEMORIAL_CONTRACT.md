# 户部奏折 Contract

## 本文件目的

定义户部所有岗位最终如何汇总为老板能裁决的奏折。岗位可以多, 但老板只需要一个清晰结果: 批准、暂缓、退回补证、交刑部、交军机处。

## 输出对象

```json
{
  "memorialId": "hubu-memorial-001",
  "title": "",
  "decisionType": "finance_investment|payment|budget|cashflow|tax|audit",
  "recommendation": "approve|pause|needs_evidence|legal_review|council_review",
  "riskLevel": "low|medium|high|blocked",
  "summary": "",
  "knownFacts": [],
  "metrics": {},
  "missingEvidence": [],
  "riskGates": [],
  "sourceLabelSummary": {},
  "auditTrail": [],
  "nextActions": []
}
```

## 汇总规则

| 上游岗位 | 输入到奏折 |
| --- | --- |
| 会计司 | 账是否平、三表是否可信 |
| 出纳司 | 当前可用资金、付款是否可执行 |
| 预算司 | 是否超预算 |
| 审计司 | 来源是否可信、缺哪些证据 |
| 投资司 | ROI、回本期、估值、建议 |
| 税务司 | 税务风险和是否交刑部 |
| 现金流司 | 30/60/90 天资金缺口 |
| 风控司 | 风险等级和二次确认门 |

## 裁决枚举

- `approve`: 数据完整、风险可控、预算/资金允许。
- `pause`: 不建议立即推进, 但不是证据缺失。
- `needs_evidence`: 需要补合同、报价、流水、预算、发票、审计表等。
- `legal_review`: 涉税务/合同/证券/合规红线。
- `council_review`: 重大投资、争议大、跨部门影响。

## 验收标准

- 每个数字可回链。
- 每个风险有触发原因。
- 每个缺口有责任人或补证方向。
- 老板能在 30 秒内看懂建议。
- 高风险不能隐藏在正文里, 必须进入 `riskGates`。

## 后续 Codex 可执行任务

- 新增 `src/hubu_memorial_contract.py`。
- 写 `build_hubu_memorial()` 纯函数。
- 用投资 fact pack 生成第一份 deterministic 户部奏折。


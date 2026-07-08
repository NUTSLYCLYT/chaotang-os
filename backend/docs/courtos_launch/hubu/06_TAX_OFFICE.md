# 税务司设计

## 本文件目的

定义户部税务司: 负责发票、税负、税务合规、税务风险提示。税务司先做风险识别, 不替代专业税务师出具正式意见。

## 职责

- 增值税进销项检查。
- 企业所得税口径检查。
- 发票、合同、付款主体一致性检查。
- 税负率异常提示。
- 研发费用、高新、加计扣除等合规提醒。
- 税务风险转刑部/人工复核。

## 输入数据

| 输入 | sourceLabel | P0/P1 | 说明 |
| --- | --- | --- | --- |
| 发票台账 | `internal_uploaded_file` | P1 | 税务司核心 |
| 合同 | `internal_uploaded_file` | P1 | 主体一致性 |
| 付款流水 | `internal_uploaded_file` | P1 | 三流一致 |
| 人工确认税率 | `manual_confirmed` | P1 | 可用但需来源 |

## 输出 contract 草案

```json
{
  "taxStatus": "normal|warning|needs_legal_review|needs_evidence",
  "vatInput": 0,
  "vatOutput": 0,
  "taxBurdenRate": 0,
  "risks": [],
  "evidence": []
}
```

## 裁决门

- 发票、合同、付款主体不一致: 交刑部/人工复核。
- 税率或税负异常: 进入风险门。
- 缺发票台账: 不阻断投资草稿, 但不能形成最终付款/税务结论。

## 后续 Codex 可执行任务

- 新增 `src/hubu_tax_contract.py`。
- 增加税务异常样例。
- 与 legal 蜂群建立转交规则。


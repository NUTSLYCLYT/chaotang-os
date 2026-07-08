# 户部真实数据接入总闸 V1

## 本文件目的

定义真实财务数据进入户部蜂群前的最小安全契约。它负责把银行流水、发票、合同、应收应付、付款申请和预算数据收口为可审计的 `reportingFactPack`。

## 范围

- P0: 结构化数据接入、sourceLabel 覆盖率、三方匹配、银行对账、账龄摘要、报表事实包草稿。
- P1: Excel/PDF/OCR 抽取器接入。
- P2: 银行、税务、票据平台、财务软件直连。

## 能做什么

- 接收知识库或上传解析器输出的结构化 JSON。
- 判断每条数据是否有可信 `sourceLabel`。
- 做合同、发票、付款申请三方匹配。
- 做银行流水收支汇总与大额未勾稽检查。
- 做应收应付账龄摘要。
- 生成财务报表预览可用的 `reportingFactPack`。

## 不能做什么

- 不写数据库。
- 不改账。
- 不执行付款。
- 不报税。
- 不提交贷款申请。
- 不替代法定会计、审计、税务签字责任。

## API

`POST /api/chaotang/hubu/finance/intake/preview`

必须返回:

- `previewOnly: true`
- `executionAllowed: false`
- `sideEffects: "none"`

## 输入结构

```json
{
  "caseId": "hubu-intake-demo-001",
  "title": "2026-06 真实财务数据接入总闸",
  "period": "2026-06",
  "dataSources": {
    "bankStatements": [],
    "invoices": [],
    "contracts": [],
    "receivables": [],
    "payables": [],
    "paymentRequests": [],
    "budgets": [],
    "trialBalance": {}
  }
}
```

## 输出结构

- `sourceInventory`
- `matching`
- `bankReconciliation`
- `aging`
- `auditFindings`
- `bossBrief`
- `reportingFactPack`
- `archiveDraft`

## 验收标准

- 缺少 `dataSources` 时返回 `success=false`。
- sourceLabel 覆盖率低于 80% 时触发 `source_coverage_low`。
- 付款申请缺少合同/发票匹配时触发 `payment_request_unmatched`。
- 大额银行流水缺少 `matchRef` 时触发 `bank_reconciliation_gap`。
- 90 天以上应收/应付能进入账龄异常。
- 通过总闸的数据可以继续调用财务报表预览 contract。

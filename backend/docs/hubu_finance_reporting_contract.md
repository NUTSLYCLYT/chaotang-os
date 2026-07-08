# 户部财务报表与审计异常预览契约

## 本文件目的

把“财务报表、审计报告、融资计划书、贷款申报材料”收口为一个无副作用预览契约, 服务 P0 裁决闭环。

## 范围

- P0: 生成三表草稿、审计异常、老板摘要、史馆草稿。
- P1: 生成融资材料草稿、贷款申报材料清单。
- P2: 对接真实银行、税务、审计底稿、企业网银、发票系统。

## 能做什么

- 读取内部事实包, 确定性计算利润表、资产负债表、现金流量表草稿。
- 检查 sourceLabel、资产负债表是否平、重复付款、缺合同/发票、预算超支、偿付压力。
- 生成老板能读的 `bossBrief`。
- 生成融资材料和贷款申请草稿。
- 生成 `archiveDraft`, 但不写史馆。

## 不能做什么

- 不能替代注册会计师签字。
- 不能自动报税、报送银行、提交贷款申请。
- 不能执行付款、修改账套、写数据库。
- 不能把 `unknown` 来源数字当作可裁决依据。

## API

`POST /api/chaotang/hubu/finance/reporting/preview`

`POST /api/chaotang/hubu/finance/reporting/decision/preview`

该接口必须返回:

- `previewOnly: true`
- `executionAllowed: false`
- `sideEffects: "none"`

## 最小输入

```json
{
  "caseId": "hubu-reporting-demo-001",
  "title": "2026-06 财务报表与审计异常预览",
  "period": "2026-06",
  "currency": "CNY",
  "trialBalance": {},
  "cashFlow": {},
  "auditInputs": {},
  "sources": {}
}
```

## 最小输出

- `statements.incomeStatement`
- `statements.balanceSheet`
- `statements.cashFlowStatement`
- `auditFindings`
- `bossBrief`
- `financingMaterials`
- `loanApplicationDraft`
- `archiveDraft`
- `decisionActions`

## 老板动作

- `archive_preview`: 存入史馆草稿。
- `return_for_audit_review`: 交审计复核。
- `return_for_evidence`: 退回补证。
- `prepare_financing_materials`: 交融资准备, 仍需人工复核。
- `save_draft`: 保存草稿。

## 验收标准

- 缺少 `trialBalance` 等关键字段时返回 `success=false`。
- 资产负债表不平时出现 `balance_sheet_not_balanced`。
- 缺核心 sourceLabel 时出现 `source_label_gap`。
- 重复付款、缺合同/发票、预算超支能被标出。
- 所有输出只允许是预览草稿, 不允许产生真实外部副作用。
- 老板动作只生成裁决收据草稿, 不写史馆、不提交融资、不连接银行/税务。

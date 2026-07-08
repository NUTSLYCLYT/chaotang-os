# 审计司设计

## 本文件目的

定义户部审计司: 负责 sourceLabel、evidence、数字回链、异常识别和待补证。审计司是户部可信度中枢。

## 职责

- 检查每个数字来源。
- 检查证据是否存在。
- 检查 LLM 输出数字是否能回链到 verified facts。
- 标注口述、未知、系统生成、人工确认、历史旧案等来源等级。
- 输出待补证清单。

## 当前可复用实现

- `verify_numbers(text, facts)`
- `investment_source_gate(facts)`
- `step_assertions.py` 中 `number_provenance`
- `flow_finance.yaml` 中各 step 的 `number_provenance` 和 `disclaimer_when_unverified`

## sourceLabel 分级

| sourceLabel | 可信度 | 是否可裁决 |
| --- | --- | --- |
| `internal_uploaded_file` | 高 | 可裁决 |
| `manual_confirmed` | 中高 | 可裁决, 需操作者 |
| `historical_archive` | 中高 | 可作为历史依据 |
| `web_research` | 中 | 需时间戳和引用 |
| `internal_user_input` | 低 | 只能草稿/待补证 |
| `system_generated` | 低 | 不能独立裁决 |
| `agent_inference` | 低 | 不能独立裁决 |
| `unknown` | 不可用 | 必须补证 |

## 输出 contract 草案

```json
{
  "auditStatus": "ready|needs_evidence|blocked",
  "factsChecked": [],
  "missingEvidence": [],
  "numberProvenanceChecks": [],
  "warnings": [],
  "blockedReasons": []
}
```

## 裁决门

- 任一核心金额为 `unknown`, 不得批准。
- LLM 输出数字无法回链, hard fail。
- 用户口述可以进入分析草稿, 但最终建议必须标注“未经审计验证”。

## 后续 Codex 可执行任务

- 新增统一 `hubu_audit_gate(fact_pack)`。
- 把投资、预算、出纳都统一接到审计司。
- 增加 missing evidence 报告测试。


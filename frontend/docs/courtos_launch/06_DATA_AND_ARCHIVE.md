# 06 Data And Archive

本文件目的：定义 CourtOS 的证据链、来源标签、归档字段和旧案引用规则，确保裁决可信、可追溯、可复盘。
优先级：P0。

CourtOS 要可信，必须有证据链和归档链。

## 能做什么

- 定义奏折、裁决、归档记录的最小可信字段。
- 规定 `sourceLabel` 如何影响是否可裁决。
- 给前端展示、后端 contract、QA 门禁提供统一依据。

## 不能做什么

- 不能把 `unknown` 来源送入最终裁决。
- 不能把智能体推理当成已确认事实。
- 不能归档缺操作者、缺时间、缺证据的正式裁决。

## 奏折最小字段

```text
id
title
summary
decisionType
riskLevel
sourceLabel
evidence[]
generatedBy
reviewedBy
createdAt
decisionStatus
decisionResult
decisionReason
archiveId
relatedPastCases[]
```

## sourceLabel 分级

| sourceLabel | 含义 | 是否可直接裁决 |
|---|---|---|
| `internal_user_input` | 用户输入 | 视风险而定 |
| `internal_uploaded_file` | 上传文件 | 视风险而定 |
| `system_generated` | 系统生成 | 否，需证据 |
| `web_research` | 外部搜索 | 否，需核验 |
| `manual_confirmed` | 人工确认 | 是 |
| `historical_archive` | 史馆旧案 | 视差异而定 |
| `agent_inference` | 智能体推理 | 否，需证据 |
| `unknown` | 来源不明 | 否，只能待补证 |

## 归档要求

正式裁决必须保存：

- 问题原文。
- 奏折内容。
- 证据列表。
- 风险说明。
- 裁决动作。
- 操作者和时间。
- sourceLabel。
- 后续复盘字段。

## 验收标准

- 每份正式奏折至少有 `sourceLabel`、`evidence[]`、`decisionStatus` 和 `audit trail`。
- 高风险裁决能追溯到证据、责任人、确认动作和归档记录。
- 史馆页面能查到裁决结果，并能显示相关旧案。

## 后续 Codex 可执行任务

```text
你是 CourtOS 数据与归档 contract 审查官。
只读检查前端类型、后端对象、archive store 和现有测试。
输出 Memorial、ArchiveRecord、EvidenceSource、ImperialDecision 的最小字段差距。
不要修改文件，不要迁移数据库，不要启动服务。
```

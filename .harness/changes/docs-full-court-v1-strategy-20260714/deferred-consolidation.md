# Deferred 汇总页（干对账预备件 4/4）

> 收官门 5 要求"deferred 清单完整、映射 Wave、无遗漏差集"。本页只汇总引用，
> 不重写内容——各项以其原始 change 文件为准。2026-07-17 建。

## A. 战役内残段（收官前须清零或显式转 deferred）

| 项 | 来源 | 归宿 |
| --- | --- | --- |
| P9 残段 R1–R4 | p9-offset-ledger.md | P9 收官子任务 |
| 红灯 OPEN 14（后端 7+前端 7） | known-red-baseline-ledger.md | P6 子步骤 + 3 新立 change |
| legacy 计数快照未导出 | p7-dry-reconciliation 门 3 | P6 后（daemon gate 有观测窗口）导出 |
| NOT_RUN_SAFETY_BLOCKED 状态未定（存命令口径缺口） | not-run-safety-blocked-release-memo.md（内容为"解除候选证据包"；文件名 release-memo 为稳定引用键，语义以文件头声明为准，不代表已解除） | 收官终审裁定：判 RESOLVED 或维持 blocked |
| lint MISSING | P0 baseline | 用户裁决 |
| chancellor_chat deselect | P0 baseline | 收官显式 deferred |

## B. 移交 FULL_COURT_V1 Wave / FCV1 编号（战役外，正当 deferred）

| 项 | 来源 | 目标 |
| --- | --- | --- |
| throne 冻结边界双读收编 | P3 deferred-boundaries | 用户裁决后另立 change |
| daemon 物理拆除（现仅 gate） | P3 deferred-boundaries | P2 计数窗口+用户确认后 |
| 部级前端脑后端化（工部/御史/刑部 clause/锦衣卫雷达） | P4 review | Wave 3 |
| tenant 存量回填 + 全量隔离 | P4.5f | **FCV1-002（商业硬门，收官次日启动）** |
| DepartmentMemorial 一等对象表 | P4.5e（已做供给侧投影） | FCV1-007 |
| 御史两套 gate 合一（P4.5c 已分门框） | P4.5c | FCV1-008 |
| CourtReview 拆表 / EmperorDecision 收口（P4.5a/d 已冻结） | P4.5a/d | FCV1-009 |
| direct 真实执行语义（execution_state 已诚实呈现 receipt_only） | P4.5b/ING-04 | durable executor ADR |
| 专项库 memory/RAG/kpi 独立 DDL | P5 非目标节 | 各自治理 |
| census CEN-01..05 修订 | census-review.md | census 修订轮 |

## C. 完整性声明

收官终审核对：A 类每项在门 2 有闭环或显式 deferred 理由；B 类每项有 Wave/
FCV1 归宿编号。无第三类悬空项——若终审发现本页外的 deferred，即为遗漏差集，
NO_GO。

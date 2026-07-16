# P4a 施工图：军机处读模型字段缺口地图（Claude 只读分析，2026-07-16）

> 基准：ext @ 188fb3d。方法：从 junjichu/page.tsx JSX 逆推 UI 实际消费字段，
> 对照后端 swarm_review.synthesize_brief / memorial_from_swarm_result /
> chaotang_task_projection 现状。结论先行：
> **全部缺口纯派生自现有 court_doc.light/section/quality_gate，无需新表、
> 无新状态机**；nextAction/missingEvidence 后端等价物已齐，P4a 第一刀应
> 从"删本地叠加"开始（风险最低）。

## 一、后端已有等价物（直接投影，不用补）

| UI 字段 | 后端等价物 | 证据 |
| --- | --- | --- |
| report.nextAction | brief.recommended_next_action | swarm_review.py:122（page.tsx:407-409 已覆盖式采用，但无 brief 时仍回落本地——删回落） |
| report.missingEvidence | brief.missing_evidence / memorial.evidence_gaps | swarm_review.py:120（page.tsx:410-413 仍与本地+unified 两路叠加——改纯读） |
| report.risks | brief.risk_register / memorial.risk_flags | swarm_review.py:119 |
| review.conflicts | brief.conflict_summary | swarm_review.py:121 |
| sourceLabel | brief.source_label / run 行 | swarm_review.py:124、swarm_runs.py:76 |
| qualityGate | memorial.quality_gate{status,reasons,human_signoff_required} | shangshufang_loop.py:419-423 |
| needsHumanConfirmation | quality_gate.human_signoff_required | 同上 |
| 各部卡 summary/缺证/风险/后令/confidence | brief.department_sections[] | swarm_review.py:117 |
| 执行时间线 | DecreeExecutionEvent timeline | decree_status.py:256-289 |

## 二、需补投影字段（建议统一落 synthesize_brief，全部纯派生）

| 缺口字段 | 派生来源 | 说明 |
| --- | --- | --- |
| department_sections[].signal（RED/YELLOW/GREEN/GRAY） | section.position ↔ court_doc.light 1:1 反推（real_department_engines.py:45,132,655） | 军机处+上书房共用 |
| overall_signal | 对各 section signal 聚合（有 RED→RED…，照 computeOverall 语义） | |
| red_blue_highlights[]（main+deputy） | main=section.summary；deputy=risks[0] 或"副手挑战：缺少{missing_evidence[0]}"（照 unified-ui-adapter:130-140） | |
| verdict_code（APPROVE/NEED_EVIDENCE/RECHECK/REJECT） | memorial.verdict+overall_signal+source_label+human_signoff 映射；保留 decideVerdict 的刑部 RED→RECHECK、FALLBACK/DEMO 不准奏规则 | 这是蒸馏点：先写 golden case 再实现 |
| veto_departments | section signal=red × departments.yaml vetoPower | |
| 工部 forbidden_commitments / cross_department_reviews | 工部 court_doc 已有，通用引擎未透出——工部适配器透传 | |
| conditions_to_proceed | court_doc items 派生 | |
| audit 人读串 | quality_gate.warnings 机器码→人读映射（可留前端做纯文案映射） | |
| decision_actions | human_signoff_required 二分（可留前端派生，成本极低） | |

## 三、明确不进后端

formalQuoteDecisionBrief（前端正则"正式报价"+硬编码清单，unified-ui-adapter:65-121）
——纯前端业务脚手架，P4a 保留为展示层派生或另立议题，不算投影缺口。

## 四、P4b 直接受益

上书房 ShangshufangPage.tsx:1524-1560 是完全同源的四件套重算，输入同一
memorial；已有 edict_recorded 诚实门（:1517-1520）。二节补的 brief 字段
（signal/overall_signal/red_blue_highlights）两页共用，一套读模型去两份
本地状态机。

## 五、蒸馏清单（P4c 前置，先 golden case 后删引擎）

decideVerdict 规则（刑部 RED→RECHECK、缺证→NEED_EVIDENCE、FALLBACK/DEMO
不准奏）、computeOverall 聚合、detectConflicts 点名逻辑、yushitai 红队 6 检
——全部先导出为后端 golden case 测试再退役前端引擎。

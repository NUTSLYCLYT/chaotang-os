# 规格说明：refactor-frontend-second-brain-sunset-20260716

## 背景

军机处与上书房在前端重复计算信号、缺证、下一步、裁决和红蓝高亮，形成与 canonical
brief/memorial 并行的 second brain。P4a 先建立可施工的字段缺口地图，再进入实现。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | `nextAction`、`missingEvidence`、risks、conflicts、sourceLabel、qualityGate、部门卡和 timeline 已有后端等价物 | `p4a-read-model-gap-map.md`，2026-07-16 | 源码逐字段对照 / Project Agent | 否 |
| 已确认事实 | 其余 9 个缺口可从现有事实纯派生 | 同上第二节 | 来源字段与 UI 消费映射 | 否 |
| 推测 | `signal`、`overall_signal`、`red_blue_highlights` 统一进入 `synthesize_brief` 可同时服务两页 | 同上第四节 | P4b 实现时 TDD 验证 | 是（P4b） |
| 未知问题 | verdict 规则蒸馏后是否覆盖全部历史前端分支 | 同上第五节 | P4c golden cases | 是（P4c） |

## 数据流与调用链

当前：canonical `court_doc/brief/memorial` → 前端页面 → 页面内二次推断与叠加。

目标：canonical `court_doc/brief/memorial` → 统一后端读模型投影 → 军机处/上书房纯消费；
展示文案仍可在前端纯派生，但不得形成第二套业务状态机。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| brief 已有字段 | `swarm_review.synthesize_brief`、memorial、quality gate | 军机处、上书房 | P4b 先删本地 fallback/叠加，保持展示同形 |
| brief 待补派生字段 | 现有 `court_doc.light/section/quality_gate` | 两个页面 | 先写字段级/golden 测试，再补投影 |
| verdict_code | memorial + overall signal + source/human signoff | 决策 UI | P4c 蒸馏现有规则后才替换 |

## 范围

- P4a：只读盘点、字段映射、数据流与蒸馏清单。
- P4b/P4c：作为后续检查点登记，当前不实施。

## 非目标

- 不新增数据库表、运行时状态机或写入事实源。
- 不在 P4a 修改军机处/上书房生产代码。
- 不把 `formalQuoteDecisionBrief` 强行迁入后端。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 后端已有等价字段 | 后续优先删除前端 fallback/叠加 | 缺口地图第一节 |
| 纯派生缺口 | 从已有事实投影，不建新表 | 缺口地图第二节 |
| verdict/冲突规则 | golden case 先行，证明等价后再删旧引擎 | 缺口地图第五节 |
| FALLBACK/DEMO 来源 | 不得被派生为可正式准奏 | P4c golden cases |

## 风险与回滚边界

P4a 只有文档，无运行时风险，可单提交 revert。P4b/P4c 的主要风险是投影语义漂移；后续
必须以现有 UI 行为蒸馏的 golden cases 为门，按字段小步迁移，不整页重写。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-16
- 批准范围：P4a docs fast tier（commit `6b68719` 中记录 `Approved-by-user: go`）
- 明确未批准：在 P4a 直接实施 P4b/P4c、建立新表/新状态机、发布部署

## 验收标准

- UI 实际消费字段与现有后端等价物逐项可追溯。
- 缺口字段给出唯一派生来源和后续落点。
- 标出必须先做 golden cases 的规则，不提前声称实现完成。
- 根级 change 记录完整，doctor 与 closeout 通过。

## 验证计划

- `git show --check 6b68719`
- `node scripts/harness-doctor.mjs`
- `cd backend && python3 scripts/harness_doctor.py`
- `cd backend && python3 scripts/commit_closeout_check.py`

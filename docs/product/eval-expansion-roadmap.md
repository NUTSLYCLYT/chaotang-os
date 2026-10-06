# 能力评测扩展路线图（提案，Pending owner 拍板）

> 状态：提案。本文不构成施工授权；每批扩展仍走 M0 approval → candidate → 验证 →
> owner 确认的既有治理流程。起草：WorkBuddy，2026-10-07，owner 授权"灭红灯"顺带立项。

## 现状基线（2026-10-07 实测）

- 已登记候选：5 个（decision-quality-gate、hubu-financial-grounding、
  hubu-payment-three-gates、libu-responsibility-authority-chain、rites-war-truthfulness）
  + rites-message-quality-gate objects。
- 黄金评测集：38 case 全绿（provenance：`92007a2d` 旧金标种子，`wb-eval-seed/absorb-38-golden-cases`
  吸收 8/15 体系种子）。
- 目标：T03 交付 53 个能力位；当前覆盖率 ≈ 9%。
- 边界红线（不可为换取覆盖率而破坏）：`synthetic: true`、`network: false`、
  `authorizesPromotion=false`、候选零权限、离线、不可晋升。

## 分批计划（每批一个 M0 approval，独立验证独立合入）

| 批次 | 内容 | 目标候选 | 验收 |
|---|---|---|---|
| B1 种子收尾 | 吸收剩余 7/15 旧金标种子中仍适用的集 | +3~5 候选 / +15~20 case | 每 case 有 provenance；38→55+ 全绿 |
| B2 六部补全 | 户/吏/礼/兵/刑/工六部各至少 1 个 grounding 候选 | 覆盖六部全域 | 每部候选含 fail-closed 反例 case |
| B3 军机处/丞相链 | 军机处案卷、丞相路由、门下 veto 的 judgement case | +4~6 候选 | 与 ADR 0028 闭环对齐的端到端断言 |
| B4 蒸馏门禁升级 | 把六部蒸馏门禁从"存在性"升级为"黄金集回归" | 53 位全量门禁 | check_harness 回归全绿 |

## 排序理由

1. B1 最便宜（种子已在仓、只需登记胶囊摘要），先恢复"旧金标不流失"。
2. B2 补齐域覆盖空洞，防止能力位集中在个别部。
3. B3 才是产品主线（单链路可交付版）的验证骨架，需 B1/B2 垫底。
4. B4 把门禁从软约束变硬回归，是"评测内容防回退"的最后闸门。

## 风险

- 每批必须先冻结 goal/base/exact paths/non-goals（G3 教训：manifest 格式错误
  ——短 SHA、未排序、非白名单工具、>300s timeout——会让审批记录变成死档）。
- 评测 case 严禁"凑数"：宁可 53 位晚到，不降低 case 质量（owner 反伪造基线）。

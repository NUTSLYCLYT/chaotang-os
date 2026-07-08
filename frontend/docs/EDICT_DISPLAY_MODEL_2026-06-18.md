# Edict Display Model - 2026-06-18

> Product rule: the edict is the decision surface, not the whole investigation room. It must stay short, stable, and action-oriented.

## 1. Fixed First-Screen Model

Every user-facing edict or final memorial must fit this fixed display model:

1. `御前摘要`: one plain-language decision summary.
2. `红线`: what cannot be done yet, especially legal, cash, delivery, external-message, privacy, or human-confirmation blockers.
3. `回奏精华`: only the essence from each relevant department, not full department reports.
4. `丞相建议`: the recommended next action and why now.
5. `附件明细`: expandable evidence, missing evidence, department details, conflicts, source labels, quality-gate details, and archive links.

The first screen should answer:

- What is the decision?
- Can the user act now?
- What blocks action?
- What is the one next action?

## 2. Detail Ownership

| Surface | Owns | Must not become |
|---|---|---|
| 圣旨 / 最终奏折 | decision, blockers, essence, next action | a full trace viewer |
| 军机处 | review plan, department routing, conflicts, quality gate progress | a decorative dashboard |
| 各部门 | professional details, work orders, evidence gaps, generated artifacts | the primary user decision surface |
| 史馆 | archive record, retrospective, learning, later recall | an ad-hoc note dump |
| 锦衣卫 | source reliability, evidence chain, currentness, conflict of sources | a generic search widget |

## 3. Required Data Shape

The edict/memorial data must preserve the eight elements already tested in `MemorialV1` and `UnifiedLoopViewModel`:

- verdict / sacred judgement
- one-sentence summary
- department summaries
- conflicts
- evidence or missing evidence
- risks
- next action
- quality gate and source label

## 4. Hidden By Default

The first screen must not show by default:

- sub-office internals such as 礼部司、工部司、刑部司
- agent names, swarm trace, loop step logs
- raw prompt text
- raw tool output
- long department reports
- technical status unless it changes the user's next action

These belong behind `附件明细`, 军机处, or the relevant department page.

## 5. Current Test Guards

The current code already includes guards in `src/core/courtos/unified/unified-loop.nodetest.ts`:

- `UI ViewModel 最终奏折卷轴稳定输出八要素和裁决动作`
- `UI ViewModel 最终奏折卷轴不隐藏部门冲突`
- `UI ViewModel 默认不展示礼部司、agent 或蜂群 trace`
- `UI ViewModel 默认不展示工部司、agent 或蜂群 trace`

Any UI change touching edict/memorial presentation must keep these tests green and add a new test if it changes the first-screen model.


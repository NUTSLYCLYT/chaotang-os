# Chaotang OS Panel Skills

This file indexes the local advisor-panel skills used by Codex for Chaotang OS.
They live under `/home/ubuntu/.claude/skills` and are loaded on demand, not as
default visible Codex skills.

## Master Router

- `chaotang-product-system-panel`: whole-product routing, golden path, department relationships.
- `chaotang-panel-maturity-rubric`: shared maturity gate for every board.

## Department Panels

| Board | Skill | Purpose |
| --- | --- | --- |
| 上书房 | `chaotang-study-panel` | Daily briefing, operating suggestions, decision-ready memorials |
| 大殿 | `chaotang-throne-panel` | Global situation, executive overview, blocked/risky/awaiting judgment |
| 工部 | `chaotang-gongbu-panel` | Build tasks, acceptance criteria, implementation and QA |
| 户部 | `chaotang-hubu-panel` | Budget, ROI, resource allocation, downside checks |
| 军机处 | `chaotang-command-center-panel` | Dispatch, blockers, execution path, final memorial |
| 锦衣卫 | `chaotang-jinyiwei-panel` | External signals, risk, policy/news/market intelligence |
| 史馆 | `chaotang-shiguan-panel` | Archive, retrospectives, audit trail, reusable lessons |
| 礼部 | `chaotang-libu-panel` | Brand, marketing, public expression, launch narrative |
| 吏部 | `chaotang-libu-personnel-panel` | People, org design, ownership, KPI, accountability |
| 庄园 | `chaotang-manor-panel` | Customer/business scenarios and operational context |
| 三省治理 | `chaotang-governance-panel` | State machine, approvals, authority boundaries, auditability |
| 刑部 | `chaotang-xingbu-panel` | Risk, compliance, controls, audit findings, policy enforcement |
| 翰林院 | `chaotang-hanlin-panel` | Knowledge, research, documentation, source-backed synthesis |
| 东宫 | `chaotang-donggong-panel` | Human-AI authority boundaries, delegation, shadow decisions |
| 太医 | `chaotang-taiyi-panel` | Health/wellbeing guidance with safety and privacy boundaries |
| 钦天监 | `chaotang-qintianjian-panel` | Forecasts, scenario planning, uncertainty and triggers |
| 兵部 | `chaotang-bingbu-panel` | Competitive strategy, wartime execution, tradeoffs |
| 蜂群运行 | `chaotang-swarm-ops-panel` | Agent routing, evals, cost control, observability |
| 任务台账 | `chaotang-task-ledger-panel` | Tasks, reports, edicts, progress, acceptance proof |
| 实验/金库 | `chaotang-lab-panel` | Experiments, gold/investment lab, prototypes, graduation decisions |

## Product Rule

Every board must preserve the operating-loop contract:

```text
input -> evidence -> recommendation -> next action -> state -> verification -> archive -> learning
```

Maturity target:

```text
L0 decorative -> L1 informational -> L2 operational -> L3 evidence-backed -> L4 closed-loop -> L5 self-improving
```

Any board below L3 is not ready for serious use. Any flagship board should aim
for L4 first, then L5 after outcome data exists.

The first golden path remains:

```text
上书房 -> 工部 -> 户部 -> 军机处 -> 工部验收 -> 史馆归档
```

## Use

When changing a Chaotang page or workflow, Codex should:

1. Read `chaotang-product-system-panel`.
2. Read `chaotang-panel-maturity-rubric`.
3. Read the specific board panel skill.
4. Read `website-design-panel` if UI or 美工 is involved.
5. Use tests, Playwright screenshots, and source/audit checks according to the panel.

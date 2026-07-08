# Chaotang Board Review Checklist

Date: 2026-06-08

Purpose: convert the legacy Chaotang board maturity roadmap into a repeatable
review gate for current mainline boards, departments, and harnesses.

## Source Of Truth

| Concern | Source |
|---|---|
| Department output contract | `docs/chaotang_department_operating_contract.md` |
| Department protocol harness | `harness/chaotang_department_protocol/` |
| UI/UX harness | `harness/chaotang_uiux_system/` |
| Global risk gate | `harness/yushi_global_gate/` |
| Frontend launch plan | `/home/ubuntu/workspace/chaotang-web-lyt/docs/CHAOTANG_FINAL_LAUNCH_AND_OS_ABSORPTION_PLAN_2026-06-08.md` |

## North Star

Every board must answer:

```text
现在该做什么？
```

Every serious board must preserve this operating loop:

```text
input -> evidence -> recommendation -> next_action -> state -> verification -> archive -> learning
```

## Maturity Levels

| Level | Meaning | Release implication |
|---|---|---|
| L0 | Decorative screen | Do not expose as serious workflow |
| L1 | Informational | Demo/resource only |
| L2 | Operational | Has next action and visible state |
| L3 | Evidence-backed | Has source, owner, confidence, verification |
| L4 | Closed-loop | Routes action and archives outcome |
| L5 | Self-improving | Outcomes change future routing/recommendations |

Launch path target:

```text
上书房, 军机处, 工部, 户部, 史馆: L4 before public proof
Supporting boards: L3 minimum before serious use
```

## Nine-Axis Scorecard

Score each axis 0-5.

| Axis | Question | Fail condition |
|---|---|---|
| Product job | Does the board own one clear founder job? | User cannot tell what to do next |
| Evidence grounding | Are sources, timestamps, assumptions, and confidence visible? | Generated claims appear as facts |
| Workflow power | Can recommendation become a task, budget, decision, or archive? | Advice dead-ends in text |
| State machine | Are loading/empty/error/pending/running/done/archived explicit? | Failure looks like success |
| Advisor quality | Are at least two useful advisor lenses assigned? | Generic "AI suggestion" with no review pressure |
| Toolchain | Does the board know which tests, logs, screenshots, APIs, or plugins prove it? | No deterministic verification path |
| UI clarity | Does the first viewport answer "what now"? | Pretty page, unclear action |
| Learning loop | Does outcome feed 史馆 and future briefs? | No replay or future improvement |
| Safety/governance | Are auth, privacy, cost, claims, approvals, and audit handled? | Irreversible action can execute without signoff |

L4 gate:

```text
minimum average >= 4.0
no axis below 3
safety/governance >= 4
workflow power >= 4
learning loop >= 4
```

## Review Output Contract

Every board review must produce this record:

```yaml
board: string
route: string
owner: string
current_level: L0 | L1 | L2 | L3 | L4 | L5
target_level: L3 | L4 | L5
first_viewport_answer: string
input_contract:
  - string
output_contract:
  - string
evidence_sources:
  - source: string
    timestamp_required: boolean
    uncertainty_required: boolean
next_action:
  owner: string
  route: string
  due: string
  blocker: string
qintianjian_trigger:
  signal: string
  threshold: string
  watch_window: string
  decision_change: string
score:
  product_job: number
  evidence_grounding: number
  workflow_power: number
  state_machine: number
  advisor_quality: number
  toolchain: number
  ui_clarity: number
  learning_loop: number
  safety_governance: number
top_gaps:
  - string
build_tasks:
  - owner: string
    task: string
    verification: string
archive_plan:
  path: string
  fields:
    - run_id
    - evidence
    - outcome
    - lesson
    - next_signal
```

## Golden Path Review Order

| Order | Board | Target | Default advisors | Required verification |
|---:|---|---|---|---|
| 1 | 上书房 | L4 | zhang-xiaolong + harness-god | first-priority selector test, screenshot, source-mode audit |
| 2 | 军机处 | L4 | harness-god + martin-fowler | task/run lifecycle test, command-center screenshot |
| 3 | 工部 | L4 | karpathy + deming | build ledger/release gate evidence |
| 4 | 户部 | L4 | jeff-bezos-perspective + deming | ROI source/timestamp/uncertainty check |
| 5 | 史馆 | L4/L5 | harness-god + charity-majors | archive record includes outcome, lesson, next signal |

## Supporting Boards

| Board | Target | Main risk | Required proof |
|---|---|---|---|
| 锦衣卫 | L3/L4 | signals without action | source link, timestamp, suggested route |
| 钦天监 | L3/L4 | forecasts without triggers | trigger, threshold, decision-change condition |
| 东宫 | L4 | hidden AI authority boundary | signoff state and irreversible-action gate |
| 御史 / 刑部 | L4 | warnings without controls | block/allow/abstain decision and audit artifact |
| 礼部 | L3/L4 | generic brand copy | claim boundaries and customer next action |
| 庄园 | L3/L4 | scenarios disconnected from tasks | task linkage and owner |
| 太医 | L3 | unsafe health overclaim | privacy, disclaimer, source, no medical diagnosis |
| 兵部 | L3/L4 | competitive theater | sales/customer action and evidence |

## Review Procedure

1. Identify board, owner, user, and smallest useful action.
2. Read the current source files and contracts.
3. Score the nine axes.
4. Reject any board whose core claims lack evidence/source mode.
5. Convert the top three gaps into build tasks.
6. Attach verification commands or screenshot targets.
7. Submit the review output through the department contract where possible.
8. Archive the review as a 史馆-compatible learning record.

## Minimum Verification By Board Type

| Board type | Verification |
|---|---|
| Frontend/UI | build or typecheck, browser screenshot, no obvious overflow/console failure |
| Backend/harness | focused pytest or deterministic harness |
| Financial/news/media | source link, timestamp, uncertainty note, no personalized investment advice |
| Governance/signoff | abstain/block/allow test and human signoff boundary |
| Agent/prompt workflow | golden cases, deterministic checks, artifacts, before/after score |

## First P0 Implementation Target

Turn the legacy `今日先裁 -> 军机处 -> 史馆` idea into a current mainline lifecycle:

```text
Shangshufang top decision
  -> task/run id
  -> command center review state
  -> archive outcome
  -> lesson + next_signal
```

Do not create a second workflow API. Reuse current task, run, department protocol,
and archive contracts.

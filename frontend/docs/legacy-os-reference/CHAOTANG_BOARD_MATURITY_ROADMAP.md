# Chaotang Board Maturity Roadmap

This roadmap is the operating plan for reviewing Chaotang OS board by board.
It assumes the global advisor rule: every board has at least two advisor lenses,
and every serious review uses `chaotang-panel-maturity-rubric`.

## North Star

Every board must answer Zhang Xiaolong's first-screen question:

```text
现在该做什么？
```

Every board must satisfy the operating contract:

```text
input -> evidence -> recommendation -> next action -> state -> verification -> archive -> learning
```

## Maturity Gate

Use `chaotang-panel-maturity-rubric`.

Target:

- Flagship path boards: L4 now, L5 after enough outcome data.
- Supporting boards: L3 minimum, L4 when connected to the loop.
- Any L0-L2 board is a page, not an operating-system board.

## First Review Wave: Golden Path

| Order | Board | Panel skill | Target | Why first |
| --- | --- | --- | --- | --- |
| 1 | 上书房 | `chaotang-study-panel` | L4 | Daily entry and first decision |
| 2 | 工部 | `chaotang-gongbu-panel` | L4 | Converts suggestions into buildable work |
| 3 | 户部 | `chaotang-hubu-panel` | L4 | Adds budget, ROI, downside |
| 4 | 军机处 | `chaotang-command-center-panel` | L4 | Dispatches and unblocks execution |
| 5 | 任务台账 | `chaotang-task-ledger-panel` | L4 | Tracks execution proof |
| 6 | 史馆 | `chaotang-shiguan-panel` | L4/L5 | Archives outcome and feeds learning |

## Second Review Wave: Intelligence and Governance

| Board | Panel skill | Target | Main risk |
| --- | --- | --- | --- |
| 锦衣卫 | `chaotang-jinyiwei-panel` | L4 | Signal collection without actionability |
| 钦天监 | `chaotang-qintianjian-panel` | L3/L4 | Forecast theater without triggers |
| 三省治理 | `chaotang-governance-panel` | L4 | Unclear authority and dead-end states |
| 刑部 | `chaotang-xingbu-panel` | L4 | Warnings without controls |
| 东宫 | `chaotang-donggong-panel` | L4 | AI authority boundaries hidden from user |
| 蜂群运行 | `chaotang-swarm-ops-panel` | L4/L5 | Performative orchestration and cost risk |

## Third Review Wave: Growth, People, Knowledge, Scenes

| Board | Panel skill | Target | Main risk |
| --- | --- | --- | --- |
| 礼部 | `chaotang-libu-panel` | L3/L4 | Generic brand page without positioning |
| 吏部 | `chaotang-libu-personnel-panel` | L3/L4 | No accountability map |
| 翰林院 | `chaotang-hanlin-panel` | L4 | Unsourced synthesis and stale docs |
| 庄园 | `chaotang-manor-panel` | L3/L4 | Business scenes disconnected from tasks |
| 太医 | `chaotang-taiyi-panel` | L3 | Unsafe medical overclaiming |
| 兵部 | `chaotang-bingbu-panel` | L3/L4 | Competitive analysis without action |
| 实验/金库 | `chaotang-lab-panel` | L3/L4 | Experiments that never graduate or die |

## Per-Board Review Procedure

For each board:

1. Read `chaotang-product-system-panel`.
2. Read `chaotang-panel-maturity-rubric`.
3. Read the board panel skill.
4. If UI is involved, read `website-design-panel`.
5. Inspect real code, screenshot, data/API, and docs.
6. Score the 9 rubric axes.
7. Produce top 3 build tasks.
8. Verify with tests, Playwright screenshot, source audit, or logs.
9. Archive the result in 史馆-compatible form.

## Required Review Output

```text
板块:
当前成熟度:
第一屏答案:
核心输入:
核心输出:
下一动作:
证据/数据源:
缺口 top 3:
建议调用 skills:
天才设计:
验收方式:
```

## Immediate Next Step

Start with 上书房. It must become the daily command ritual:

```text
one priority -> three evidence signals -> one routed next action
```

If 上书房 cannot route a recommendation into 工部/户部/军机处 and later 史馆,
the rest of the palace becomes decorative.

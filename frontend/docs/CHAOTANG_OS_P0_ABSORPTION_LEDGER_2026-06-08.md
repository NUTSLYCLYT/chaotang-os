# Chaotang OS P0 Absorption Ledger

Date: 2026-06-08

Source:

```text
/home/ubuntu/chaotang-os
```

Target mainlines:

```text
/home/ubuntu/workspace/chaotang-web-lyt
/home/ubuntu/workspace/jiqun_ai
```

## Decision

P0 legacy absorption starts with three old surfaces:

1. `web/app/chaotang/study/page.tsx`
2. `web/app/chaotang/war-room/page.tsx`
3. `web/app/chaotang/archive/page.tsx`

The old implementation tried to create:

```text
今日先裁 -> 军机处形成决议 -> 史馆复盘一案
```

This is the right product loop, but the old code uses a separate `CourtWorkflow`
route, demo fallbacks, and legacy page structure. Mainline already has stronger
task, run, command center, and archive contracts, so absorption must be concept
first, not code first.

## P0 Verdict Table

| Source area | Useful idea | Verdict | Reason | Target |
|---|---|---|---|---|
| Study / 上书房 | `TopCourtDecision`: first screen chooses one highest-priority decision | `ACCEPT_CONCEPT` | Matches final launch loop and Zhang Xiaolong "what now" rule | Mainline `ChancellorItem` / `MemorialItem` ranking or a new typed `LaunchLoopCase` |
| Study / 上书房 | `RoutedWorkflowAction`: action carries source, evidence IDs, target department, owner, status | `ACCEPT_CONCEPT` | Good contract shape, but should map to mainline task/run IDs | `jiqun_ai` department protocol + `chaotang-web-lyt` task dispatch metadata |
| Study / 上书房 | Responsive three-column layout changes | `REJECT_CODE` | Mainline Shangshufang has its own cinematic layout and basePath discipline | Keep only as visual reference if screenshots show a better mobile solution |
| Study / 上书房 | POST `/api/court-workflows` from client | `REJECT_CODE` | Would create a second workflow system outside current task/orchestration APIs | Use existing `/api/orchestration/run`, backend tasks, and archive APIs |
| Study / 上书房 | Vitest coverage for top decision derivation | `ACCEPT_TEST_IDEA` | Deterministic ranking tests are valuable | Add later around mainline briefing/ranking contract |
| War room / 军机处 | First panel highlights the leading case and "形成决议" | `ACCEPT_CONCEPT` | Mainline command center already has stage/topline; the CTA can become route-aware | `deriveCenterTopline`, `PrimeMinisterMemoCard`, command-center route card |
| War room / 军机处 | Resolve workflow via `/api/court-workflows` | `REJECT_CODE` | Wrong source of truth; should resolve through task/report/review state | `jiqun_ai` review/governance state or mainline task status |
| War room / 军机处 | Mobile/overflow repair | `DEFER` | May be useful, but requires screenshot comparison against current command center | Browser QA batch |
| Archive / 史馆 | "复盘一案" as primary action | `ACCEPT_CONCEPT` | Strongly matches 史馆 as learning loop, not passive storage | Mainline Shiguan quick action or release archive gate |
| Archive / 史馆 | Demo fallback archive records | `REJECT_CODE` | Trust risk; mock/fallback must not look like production evidence | Keep explicit DEMO only in controlled resource gallery |
| Archive / 史馆 | Archive pending workflow and write lesson/signal | `ACCEPT_CONCEPT` | Good harness-god shape: outcome, lesson, next signal | `jiqun_ai` archive/learning record contract |
| Archive / 史馆 | Fetch timeout + demo replacement | `REJECT_CODE` | Hides API failure by swapping in fake records | Mainline should show source mode and soft error, not fake success |

## Mainline Comparison

| Surface | Mainline current state | Legacy value left |
|---|---|---|
| 上书房 | Uses Turso/SSE, `ChancellorItem`, `MemorialItem`, citations, source modes, orchestration run | Need a deterministic first-priority selector and evidence-backed "today's one decision" gate |
| 军机处 | Has task list, command input, run state, DAG, execution logs, review dock, route recommendations | Need a clearer "form decision / send to archive" step tied to task/report state |
| 史馆 | Has Shiguan UI, archive stats/records, release gates, knowledge feedback, build ledger | Need a first-class "review one unresolved case" action with outcome and lesson fields |

## Accepted Contract Shape

The old `CourtWorkflow` concept should be translated into a mainline-neutral
launch-loop case, not copied directly.

Candidate contract:

```ts
type LaunchLoopStatus =
  | "drafted"
  | "dispatched"
  | "running"
  | "decision_ready"
  | "reviewed"
  | "archived";

interface LaunchLoopCase {
  caseId: string;
  source: "shangshufang" | "command_center" | "shiguan";
  sourceId: string;
  title: string;
  command: string;
  owner: string;
  targetDept: string;
  evidenceIds: string[];
  taskId?: string;
  runId?: string;
  decisionId?: string;
  archiveId?: string;
  status: LaunchLoopStatus;
  nextAction: string;
  createdAt: string;
  updatedAt: string;
}
```

Backend/harness version should include:

```text
input -> evidence -> recommendation -> next_action -> run_id -> decision -> archive -> learning
```

## Rejected Code Paths

Do not migrate these directly:

| Path | Reason |
|---|---|
| `web/app/api/court-workflows/route.ts` | Competes with mainline task/orchestration/archive APIs |
| `web/lib/court-workflow.ts` as-is | Uses legacy workflow status separate from current task state |
| `DEMO_TIMELINE`, `DEMO_STATS`, `DEMO_DETAILS` | Fake archive success risk |
| Client-side fallback from failed API to demo records | Trust regression |
| Legacy `web/package.json` dependency changes | Dependency drift |
| Auth/session legacy changes | Requires security review before any extraction |

## Next Implementation Batch

P0.1 should happen in the backend/harness source of truth first:

| Step | Repo | Output | Verification |
|---|---|---|---|
| Define `LaunchLoopCase` or equivalent task lifecycle record | `jiqun_ai` | Contract/schema or docs tied to existing task protocol | focused pytest or schema test |
| Map current task/orchestration/archive IDs into one case lifecycle | `jiqun_ai` | deterministic transform from task/run/decision/archive | unit test with golden case |
| Expose frontend-readable state | `chaotang-web-lyt` | typed BFF or existing API adapter extension | TS type/build check |
| Add 上书房 first-priority selector | `chaotang-web-lyt` | one top decision with source/evidence/next action | deterministic test |
| Add 史馆 "复盘一案" action only after backend record exists | both | archive outcome + lesson + next signal | screenshot QA + backend test |

## Current Migration Status

| Item | Status |
|---|---|
| Old study code reviewed | `DONE` |
| Old war-room code reviewed | `DONE` |
| Old archive code reviewed | `DONE` |
| Concepts accepted | `DONE` |
| Code copied | `NONE` |
| Deletion readiness | `NO` |

## Why This Is Safer

The old implementation had the correct instinct but the wrong boundary. Copying
it would create:

```text
CourtWorkflow route -> legacy local DB/schema -> demo fallbacks -> duplicate lifecycle
```

The mainline needs:

```text
task/run/decision/archive IDs -> one launch-loop case -> visible next action -> verified archive lesson
```

That keeps the final product honest and makes every future page depend on the
same operating contract.

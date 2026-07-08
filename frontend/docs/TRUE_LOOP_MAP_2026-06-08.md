# True Loop Map: Shangshufang -> Backend Swarm -> Shiguan Archive

> Day 2 and Day 3 deliverable. Goal: choose one real loop, label every hop as `real`, `mock`, `fallback`, or `missing`, and define the first ship gate.

## Chosen Loop

One smallest useful ship:

```text
user command
-> Shangshufang study page
-> study edict API
-> jiqun_ai swarm run
-> replay artifact
-> Shiguan archive/retrospective
-> next action for user
```

Why this loop:

- It starts where a beginner user naturally starts: Shangshufang.
- It uses an existing backend contract: `/api/chaotang/study/run`.
- It already has live-mode support for `swarm_orchestrator`.
- It produces a replay artifact owned by Shiguan.
- It can be tested without adding another product surface.

## Truth Table

| Step | Owner Repo | Path / Contract | Current State | Evidence | Required Gate |
|---|---|---|---|---|---|
| User enters command | frontend | `/study`, `src/features/shangshufang/` | real | E2E can interact with page and submit decree | User can act within 10 seconds |
| Shangshufang briefing | frontend BFF | `/api/court/shangshufang/briefing` | fallback | Turso unavailable path falls back locally | Response must label fallback source |
| Study run bridge | frontend BFF -> backend | `/api/court/chaotang/study/run` | real bridge, env-dependent | Frontend calls backend route through BFF/API client patterns | Must not present mock as real |
| Backend study edict | backend | `POST /api/chaotang/study/run` | real deterministic contract | `tests/test_chaotang_study_run_edict.py` | Must return edict, evidence, risks, next_actions, quality_gate |
| Live swarm execution | backend | `mode=live`, `SwarmOrchestrator` | real, credential/config-dependent | `run_adapter.name = swarm_orchestrator` | Must produce session_id and run counts |
| Replay artifact | backend | `/api/swarm/sessions/{session_id}` | real when session exists | `run_adapter.replay_artifact.owner = shiguan` | Artifact path and API path must be present |
| Shiguan archive/retrospective | backend | `/api/chaotang/archive/{task_id}/retrospective` | real/fallback synthetic | Existing retrospective is real; otherwise synthesizes from run | Synthetic responses must be labeled |
| Frontend Shiguan view | frontend | `/shiguan?taskId=...` | mixed | UI exists; data may be BFF/mock/fallback | Page must show archive state and evidence boundary |
| Human signoff | both | `quality_gate.human_signoff_required` | real contract | Backend edict includes flag | Irreversible action blocked without signoff |
| Production observability | backend | `src/production_events.py`, `/api/observability` | partial | Events exist for several routes | True loop needs one named event family |

## Real / Mock / Fallback / Missing Summary

Real:

- `/study` user input and edict display.
- Backend `/api/chaotang/study/run` deterministic edict contract.
- Live swarm adapter path using `SwarmOrchestrator`.
- Replay artifact contract for `/api/swarm/sessions/{session_id}`.
- Quality gate fields: `status`, `score`, `reasons`, `human_signoff_required`.

Fallback:

- Shangshufang briefing can fall back when Turso/local data is unavailable.
- Shiguan retrospective can synthesize a record when no stored retrospective exists.
- Frontend true-chain health reports missing env/config rather than failing silently.

Mock:

- Some frontend E2E fixtures and product screens use mocked briefing, build-ledger, or archive data.
- Some visual/product pages still use static content to demonstrate workflow states.

Missing:

- One production DB-backed archive record for this exact chosen loop.
- One named observability event family for the full loop.
- One operator dashboard that shows loop status, owner, evidence, next action, and archive path in one place.
- One signed human approval record for high-risk outputs.

## V1 Contract

The chosen loop is considered V1-ready when one run produces this record:

```json
{
  "loop_id": "shangshufang_true_loop_v1",
  "input": "user command",
  "owner": "shangshufang",
  "backend_run": {
    "api": "/api/chaotang/study/run",
    "mode": "live",
    "adapter": "swarm_orchestrator",
    "session_id": "study-live-*"
  },
  "quality_gate": {
    "status": "passed|needs_review|blocked",
    "score": 0.0,
    "human_signoff_required": true
  },
  "archive": {
    "owner": "shiguan",
    "api_path": "/api/swarm/sessions/{session_id}",
    "retrospective_path": "/api/chaotang/archive/{task_id}/retrospective"
  },
  "next_action": {
    "owner": "user|hubu|gongbu|command-center|shiguan",
    "label": "concrete next action"
  }
}
```

## Ship Gate V1

Frontend gate:

- `pnpm build`
- `pnpm test:e2e e2e/true-loop-contract.spec.ts`

Backend gate:

- `pytest -q tests/test_chaotang_study_run_edict.py tests/test_chaotang_true_loop_contract.py`

Manual gate:

- Confirm whether the run is dry-run, hybrid, or live.
- Confirm if any output is irreversible, financial, legal, or customer-facing.
- Confirm archive/replay artifact path before treating the result as completed.

## Day-3 Decision

Chosen chain:

```text
上书房 -> /api/chaotang/study/run live mode -> SwarmOrchestrator -> replay artifact -> 史馆复盘
```

Do not add another first loop until this chain has one production-like run with archive evidence.

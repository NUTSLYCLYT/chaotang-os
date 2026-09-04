# G3 Capability Inventory Calibration · 2026-09-04

## Status

Review

## Baseline

- Repository: `gitee.com/msxn/chaotang-os`
- Branch: `origin/ext-dev`
- Baseline HEAD: `47238c546c62e23c06a6e1bdad22eeb79edc1598`
- Baseline tree: `3e9b4423b8cc6814760a13320909ed002348c002`
- Observation mode: read-only inventory calibration
- Production deployment: not authorized and not performed

This document calibrates stale capability-inventory facts after the roadshow RC
and First Decree Cockpit replay. It does not approve runtime migration,
retirement, deletion, external provider activation, or a second capability
registry.

## Confirmed stale fact

`frontend/src/lib/db/courtos-decision-store.ts` does not exist on the current
mainline, but older capability inventory and semantic ledgers still reference a
`courtos-decision-store.ts` lineage under historical attic/source entries.

Decision:

`STALE_FILE_FACT / DO_NOT_COUNT_AS_CURRENT_MIGRATE_REQUIRED_PATH`

The historical record remains evidence. It must not be used to claim that a
live frontend database store is currently missing or must be migrated.

## Current live frontend facts

The current frontend client library contains the active boundary files under
`frontend/src/lib/`, including:

- `frontend/src/lib/backendClient.ts`
- `frontend/src/lib/requireUser.ts`
- `frontend/src/lib/session.ts`
- corresponding boundary tests for session, backend client, Junjichu cases,
  decree jobs, Shiguan decisions, Qintian, and daily memorial flows.

These files, not the deleted `courtos-decision-store.ts`, should be treated as
the present frontend integration surface until a successor proves otherwise.

## Still-visible legacy or compatibility entrances

The following families remain visible in source history or live code references
and must not be declared retired solely from this calibration:

- legacy direct/swarm/orchestration endpoints and adapters;
- `swarm-runs` compatibility surface;
- Shangshufang compatibility paths and frontend rewrite adapters;
- flywheel and knowledge writer families;
- governance and Shiguan writer families that still need a canonical
  replacement proof.

Telemetry observation is still insufficient: no current evidence proves 14
continuous zero-call days for those entrances. Therefore retirement remains
blocked.

## Classification

| Item | Current classification | Reason |
| --- | --- | --- |
| `frontend/src/lib/db/courtos-decision-store.ts` | `STALE_FILE_FACT` | No such current path; historical attic facts remain archival only. |
| `frontend/src/lib/backendClient.ts` | `CURRENT_FRONTEND_API_SURFACE` | Active BFF/client boundary used by current pages and tests. |
| `frontend/src/lib/session.ts` | `CURRENT_AUTH_SESSION_SURFACE` | Active browser session boundary and stale-session redirect lineage. |
| legacy direct/swarm/orchestration surfaces | `OBSERVE_BEFORE_RETIREMENT` | Replacement/traffic evidence is incomplete. |
| flywheel/knowledge writers | `MIGRATION_REVIEW_REQUIRED` | Potential duplicate fact-writing paths need scoped successor review. |
| governance/Shiguan writers | `P0_CANONICAL_REPLACEMENT_REQUIRED` | Must prove one canonical writer before cleanup or retirement. |

## Next safe successor

Create a narrow `G4 Business Entrance Convergence` successor after this
calibration is accepted. Its first package should not rewrite every entrance.
It should freeze the P0 set only:

1. governance and Shiguan writer replacement proof;
2. direct/swarm session write boundary;
3. flywheel/knowledge writer fail-closed or migration boundary.

The successor must:

- preserve current `/dadian`, `/study`, `/junjichu`, `/honglusi`, and Shiguan
  roadshow RC behavior;
- route BUSINESS only through `DecisionTask`;
- route ENGINEERING only through the engineering kernel;
- add telemetry observation rather than delete old entrances immediately;
- require 14 continuous zero-call days before retiring any legacy entrance;
- run frontend, backend, Harness, authority regression, V2 convergence,
  browser smoke, and `git diff --check`.

## Decision

`G3_CAPABILITY_INVENTORY_CALIBRATED / STALE_FILE_FACT_REMOVED_FROM_CURRENT_SCOPE / RETIREMENT_BLOCKED_BY_TELEMETRY_ABSENCE`

The inventory is no longer treated as a literal to-do list. It is an evidence
ledger: historical assets stay preserved, current surfaces are named, and
legacy entrances move into observation-backed convergence rather than bulk
deletion.

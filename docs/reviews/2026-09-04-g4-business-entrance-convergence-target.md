# G4 Business Entrance Convergence Target · 2026-09-04

## Status

Review

## Baseline

- Repository: `gitee.com/msxn/chaotang-os`
- Branch: `origin/ext-dev`
- Baseline HEAD: `2be48c2493bdf626bdabe5218481f0b9f4f715c0`
- Baseline tree: `d47d00bfbc2673a41c7840cd050a8062eafbec73`
- Observation mode: bounded source review and convergence target design
- Production deployment: not authorized and not performed

This document freezes the next business-entry convergence target after G0/G1/G3
and the non-production roadshow RC. It does not authorize runtime rewrites,
legacy endpoint deletion, product authority consumption, external provider
activation, production deployment, or bulk absorption of dirty donor worktrees.

## Current canonical entrance map

The current mainline already has a usable, roadshow-ready business chain. The
canonical chain is:

1. authenticated frontend surface;
2. Chancellor draft preparation;
3. explicit user decree;
4. persistent decree job;
5. server-owned route, owner, evidence, report-artifact, and Shiguan binding;
6. Junjichu or Honglusi projection only after server-side identity is fixed.

Current source anchors include:

- `frontend/src/lib/requireUser.ts`
- `frontend/src/lib/session.ts`
- `frontend/src/lib/backendClient.ts`
- `frontend/src/app/study/StudyClient.tsx`
- `frontend/src/app/dadian/`
- `frontend/src/app/junjichu/scene-board/page.tsx`
- `frontend/src/app/honglusi/page.tsx`
- `backend/app/api/chancellor_drafts.py`
- `backend/app/api/decrees.py`
- `backend/app/api/decree_jobs.py`
- `backend/app/api/shiguan.py`
- `backend/app/api/junjichu_cases.py`
- `backend/app/api/report_artifacts.py`
- `backend/app/api/scene_packs.py`

The route decision is inherited from the current ADR set: business requests
must become server-owned decision/decree work; engineering work must remain in
the engineering kernel. A visual page, compatibility route, old branch, or
donor file is not by itself a business entrance authority.

## Live entrance families

| Family | Classification | Current decision |
| --- | --- | --- |
| `/study` Chancellor draft and decree flow | `CANONICAL_BUSINESS_ENTRY` | Preserve. It remains the formal business execution chain. |
| `/api/v1/chancellor-drafts` | `CANONICAL_PRE_DECREE_ENTRY` | Preserve as no-side-effect preparation before explicit decree. |
| `/api/v1/decrees/chancellor` | `CANONICAL_EXECUTION_ENTRY` | Preserve. It is the explicit user-authorized decree boundary. |
| `/api/v1/decree-jobs` | `CANONICAL_ASYNC_JOB_SURFACE` | Preserve. It owns persistent job state and resume semantics. |
| `/api/v1/shiguan` | `CANONICAL_ARCHIVE_AND_RECALL_SURFACE` | Preserve. It must receive server-bound outcomes, not parallel writer truth. |
| `/api/v1/junjichu/cases` | `CANONICAL_CASE_PROJECTION` | Preserve as owner-scoped projection; not a second decree queue. |
| `/api/v1/court/scene-packs` and `/scene-runs` | `ROADSHOW_CANONICAL_SCENE_SURFACE` | Preserve for RC/roadshow; later bind to the same DecisionTask receipt spine. |
| `/api/v1/court/military-office/missions` | `ROADSHOW_CASE_HANDOFF_SURFACE` | Preserve as controlled handoff; do not promote to independent authority. |
| `/honglusi` capability gate UI | `OBSERVE_AND_BIND` | Preserve UI; production third-party capability ingestion remains not authorized. |
| Jinyiwei and Qintianjian read surfaces | `BOUNDED_EVIDENCE_READERS` | Preserve as controlled readers; they are not general search or external write gates. |

## Legacy and donor-only entrance families

The following families remain review targets. They must not be deleted or merged
wholesale until a successor proves replacement, no-call telemetry, and rollback:

| Family | Classification | Reason |
| --- | --- | --- |
| legacy direct execution sessions | `MIGRATION_REVIEW_REQUIRED` | Potential duplicate execution boundary; must route to canonical decree or engineering kernel. |
| legacy swarm session runners | `MIGRATION_REVIEW_REQUIRED` | Risk of second orchestration/runtime; preserve donor bytes until strategy is proven. |
| old orchestration compatibility routes | `OBSERVE_BEFORE_RETIREMENT` | Some wrappers may still support frontend compatibility; retire only after telemetry. |
| `swarm-runs` adapters | `OBSERVE_BEFORE_RETIREMENT` | Need invocation evidence and replacement mapping before removal. |
| flywheel writers | `P0_CANONICAL_WRITER_PROOF_REQUIRED` | May write outcome or improvement facts; must bind to Shiguan/receipt truth. |
| knowledge upload/index writers | `FAIL_CLOSED_OR_MIGRATE` | Current 409 fail-closed behavior is acceptable until a scoped successor migrates it. |
| old Shangshufang path rewrites | `COMPATIBILITY_ADAPTER` | Frontend/backend rewrite may remain, but canonical destination must stay server-owned. |
| dirty root `backend/src` and `backend/web` assets | `DONOR_ONLY_PENDING_TRIAGE` | Not present in the clean current worktree; never bulk import from the dirty root. |

## Non-negotiable convergence rules

- Do not create a second product authority, truth ledger, runtime skill registry,
  Shiguan writer, capability registry, or swarm runtime.
- Do not treat external LLM, IMA, MCP, LangGraph, swarm, or third-party skill
  output as final truth without server-owned evidence binding.
- Do not retire a legacy route without 14 continuous observation days of
  zero invocation or a separately approved shorter owner exception.
- Do not let a frontend page bypass `requireUser`, server owner binding, route
  approval, idempotency, or receipt/report identity.
- Do not use dirty worktree bytes, historical branches, old approvals, old
  machine GO, or donor tests as current candidate identity.
- Do not upload the root mixed worktree or any generated/untracked artifacts
  as a convenience bundle.

## G4 implementation target

Recommended successor task:

`BUSINESS-ENTRANCE-CONVERGENCE-V1-OBSERVATION-SUCCESSOR-20260904`

Recommended approval commit paths:

- `.harness/approvals/BUSINESS-ENTRANCE-CONVERGENCE-V1-OBSERVATION-SUCCESSOR-20260904.json`
- `docs/product/tasks/2026-09-04-business-entrance-convergence-v1-observation-successor.md`
- `docs/superpowers/plans/2026-09-04-business-entrance-convergence-v1-observation-successor.md`

The first candidate should be an observation and routing-boundary package, not a
large rewrite. Candidate paths should be frozen only after a fresh source scan
on the then-current `origin/ext-dev`. The expected minimal families are:

1. a route/entry inventory projection under `docs/reviews/`;
2. a non-authorizing telemetry or observation contract if existing scripts can
   support it without creating a second runtime;
3. targeted tests proving no frontend route bypasses authentication and no
   business path bypasses the canonical server-owned decree/job/receipt spine.

Do not freeze runtime candidate paths in advance. The current evidence proves
the target and risk order, not the exact implementation file set.

## Validation matrix for the successor

The successor should require:

- route inventory diff against current `origin/ext-dev`;
- focused frontend route/authentication tests;
- focused backend API boundary tests;
- Shiguan writer and recall tests;
- Junjichu case projection tests;
- Scene Pack V1 and Honglusi smoke tests;
- root Harness;
- Harness self-test;
- Harness doctor;
- product-authority regression;
- V2 convergence check and tests;
- frontend lint, typecheck, Node tests, and production build when frontend
  runtime paths are touched;
- backend Ruff and full pytest when backend runtime paths are touched;
- real browser smoke for `/dadian`, `/study`, `/junjichu`, `/honglusi`, and the
  synthetic accounting decree route before any RC claim;
- `git diff --check`;
- independent governance, frontend/backend, and security reviews.

## Stop conditions

Stop immediately if a proposed implementation:

- needs a second business runtime, authority, Shiguan writer, capability
  registry, evidence ledger, or swarm executor;
- weakens authentication, tenant owner binding, route identity, evidence
  binding, idempotency, or report/artifact digest checks;
- deletes or retires legacy routes without telemetry or explicit owner
  lifecycle approval;
- pulls product bytes from dirty donor worktrees without byte identity,
  lineage, and fresh verification;
- mixes business DecisionTask routing with engineering-kernel execution;
- touches production credentials or external publication channels;
- fails any P0/P1 review or core verification gate.

## Mingshuo vertical alignment

The Mingshuo solution-hub work should be registered as a vertical slice over the
same canonical chain, not a new fourth mainline:

- reuse requirements, IMA read-only evidence, KnowledgeRouter, cell engineering,
  PACK R&D, quotation, battery stage gate, OPC, customer success, Yushi, and
  Shiguan surfaces;
- introduce `MingshuoProjectFactPackV1` only as a server-owned fact packet
  bound to evidence and tenant identity;
- keep the five-layer knowledge system as source classification:
  IMA raw, structured truth, project private, Shiguan outcome, candidate area;
- keep LangGraph isolated as PoC unless separately promoted through authority;
- generate market/project deliverables only from evidence-bound facts and
  explicit human approval.

## Decision

`G4_BUSINESS_ENTRANCE_CONVERGENCE_TARGET_FROZEN / RUNTIME_REWRITE_NOT_AUTHORIZED`

The correct next acceleration step is a narrow successor that proves observation
and canonical routing before deleting or merging anything. This preserves the
roadshow RC while converting the current pile of old entrances, swarm ideas,
knowledge writers, and vertical-slice designs into one controlled mainline.

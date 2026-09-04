# 朝堂 OS Roadshow RC Readiness Review · 2026-09-04

## Status

Review

## Baseline

- Repository: `gitee.com/msxn/chaotang-os`
- Branch: `origin/ext-dev`
- Remote HEAD: `17507010ea8250b71a91b676566a9d40238d0b6e`
- Tree: `e3521ce4aa3328c09a09eb41b1fd242007b81204`
- Verification worktree: `/home/ubuntu/Projects/chaotang-os/.worktrees/rc-latest-smoke-20260904`
- Production deployment: not authorized and not performed

`17507010e` is a direct successor of the previously verified roadshow baseline
`1a5cc4ea1d666d6d329a812b3a6f511df0764845`. The intervening delta adds only
two approval documents:

- `.harness/approvals/AGENTIC-ORG-OS-V1-PROJECT-ORGANIZATION-20260903.json`
- `.harness/approvals/CAPABILITY-REGISTRY-V1-EXACT1-READONLY-PROJECTION-20260903.json`

No frontend runtime, backend runtime, P01/P10/P14 product byte, readiness
validator, Harness runtime, or authority runtime path is changed by that delta.

## Verified local RC surface

The following checks passed on the clean `17507010e` worktree:

- Root Harness: `PASS`, 159 baseline files
- V2 convergence: `PASS / nonAuthorizing`
- Frontend typecheck: `PASS`
- Frontend lint: `PASS`
- Frontend production build: `PASS`
- Frontend Node tests: `PASS`
- Backend Ruff: `PASS`
- Backend full pytest: `4558 passed, 4 skipped, 3 warnings`
- Harness doctor: `PASS / STRUCTURE_VALID_NON_AUTHORIZING`
- Harness doctor tests: `10/10`
- Stop hook self-test: `PASS`, 3 checks
- Product-authority regression: `12/12`
- V2 convergence tests: `PASS`
- Release/offline evidence script tests: `PASS`, 90 checks
- `git diff --check`: `PASS`

## Verified browser chain

The local non-production production-mode chain was exercised with:

- Backend: `http://127.0.0.1:8013`
- Frontend standalone: `http://127.0.0.1:3009`
- Health: frontend `/health` returned `200` and reported `data-backend-ok="true"`

The real browser journey passed:

1. Register a new user.
2. Log in and reach `/dadian`.
3. Open Scene Pack V1.
4. Submit the single-product export diagnosis form with a battery/PACK example.
5. Receive a deterministic decision, risk level, confidence, next actions, and
   evidence-source list.
6. Save the result to Junjichu and verify the task appears on the scene board.
7. Open `/honglusi` and verify the external capability gate UI renders.

The key business pages produced no blocking console errors during the journey.

## Roadshow-ready claims

It is safe to claim:

- The current ext-dev line has a locally verified roadshow RC surface.
- The V2 frontend, backend decision flow, Scene Pack V1, Junjichu handoff, and
  Honglusi capability gate surface are connected for non-production demonstration.
- The system now presents a coherent loop: user input → decision → evidence
  labels → next actions → case/task persistence → capability gate visibility.
- Product-authority, Harness, backend, frontend, and browser gates have current
  evidence on a clean worktree.

It is not safe to claim:

- Production deployment is complete.
- Honglusi has production third-party capability ingestion.
- Historical donors and every old branch have been fully integrated.
- Business success has been measured in real customer traffic.
- Legacy entrypoints can be retired today.

## Remaining convergence backlog

The remaining work should stay serialized through the single `ext-dev` mainline:

1. System-level non-production installed acceptance for the credential-separated
   product verifier. This requires the separate root/systemd acceptance boundary
   and must stop all units and leave them disabled after verification.
2. H0 asset ledger: freeze the current branch/worktree/donor inventory without
   deleting or bulk-committing dirty worktrees.
3. Candidate semantic replay: selectively decide whether recent isolated donors
   such as first-decree cockpit, swarm evaluation skeletons, P14 trusted
   delivery, and small Harness fixes are `REPLAY`, `SUPERSEDED`, `DOC_ARCHIVE`,
   or `REJECT`.
4. Capability source calibration: update obsolete inventory facts such as removed
   frontend database files without creating a second capability registry.
5. Business entry convergence: route legacy governance/Shiguan writers,
   direct/swarm sessions, flywheel/knowledge writers, swarm-runs adapters,
   frontend compatibility paths, and specialized loops into the canonical
   DecisionTask / engineering-kernel split.
6. Mingshuo vertical slice: reuse existing requirements, IMA, KnowledgeRouter,
   cell engineering, PACK R&D, quotation, stage-gate, OPC, customer success,
   Yushi, and Shiguan modules; do not introduce a fourth mainline.
7. Pilot evidence: run at least the approved golden task set and record real
   result receipts, negative tests, rollback proof, and reviewer signoff before
   any production release decision.

## Decision

`ROADSHOW_RC_READY_NON_PRODUCTION / PRODUCTION_DEPLOYMENT_NOT_AUTHORIZED`

The current mainline is strong enough for a roadshow narrative and local
demonstration. It is not yet a production release. The next highest-leverage
work is to preserve the current RC evidence, keep services demo-ready, and then
finish the system-level installed acceptance plus donor convergence backlog in
small machine-verifiable batches.

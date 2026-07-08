# Chaotang Harness Plan

Date: 2026-06-07

## Purpose

The Chaotang harness is the reliability layer around swarms, workflows, and
department loops. It should answer one question before any AI output reaches a
customer, operator, budget, safety decision, or archive:

> Did this workflow produce a grounded, traceable, reversible-enough result, and
> if not, what exactly blocks it?

This harness does not replace existing flows. It wraps them with contracts,
golden cases, deterministic checks, model-graded evals, human signoff gates,
observability, and regression reports.

## Current Baseline

Existing pieces already present:

- `scripts/score_swarm.py`: independent LLM judge against golden cases.
- `scripts/golden_cases/`: swarm-level truth cases.
- `src/decision_guard.py`: irreversible-decision advisory/signoff gate.
- `scripts/governance_monitor.py`: quality-rate based governance downgrade.
- `harness/chaotang-commercial-loop/`: deterministic commercial-loop harness.

Verified on 2026-06-07:

- `pytest -q tests/test_commercial_loop_harness.py` -> `23 passed`.
- `python harness/chaotang-commercial-loop/scripts/run_harness.py --dry-run --all --no-write-ledger`
  passes all 3 commercial golden cases with `score=5.0`, `trace=1.0`,
  `grounding=1.0`.
- `python scripts/governance_monitor.py --dry-run` reports 5 suspended swarms:
  `opc`, `quotation`, `pack_rd`, `sourcing`, `storage_aftercare`.

## Target Structure

Use one harness package per operating loop, plus shared conventions:

```text
harness/
  README.md
  _shared/
    contracts/
    evaluators/
    gates/
    reports/
    observability/
  chaotang-commercial-loop/
    README.md
    contracts/
    golden_cases/
    scripts/
    artifacts/
  <next-loop>/
    README.md
    contracts/
    golden_cases/
    scripts/
    artifacts/
```

Recommended next loops:

- `chaotang-swarm-quality-loop`: score, govern, suspend, repair, and re-score swarms.
- `chaotang-archive-learning-loop`: turn failures and business outcomes into reviewed golden cases.
- `chaotang-human-signoff-loop`: enforce advisory -> human review -> executable decision.
- `chaotang-department-board-loop`: verify each department board has input, output, next action, owner, evidence, state, archive, and learning.

## Standard Harness Contract

Every harness loop should define:

- `case_id`: stable identifier.
- `task`: user/customer/system input.
- `source`: where the task came from.
- `owner`: responsible department or person.
- `success_metric`: observable pass condition.
- `records`: one record per block/department.
- `quality_gate`: score, traceability, grounding, signoff, reasons.
- `report`: boss/customer/operator-facing summary.
- `artifacts`: event logs, failure samples, golden candidates, run ids.

Every block record should include:

- `block_id`
- `status`: `passed | blocked | failed`
- `owner`
- `input`
- `output`
- `evidence`
- `assumptions`
- `confidence`
- `next_action`
- optional `run_id`
- optional `quality_score`

## Gate Rules

A workflow is releasable only if all are true:

- Required blocks produced valid contract records.
- Traceability is at least `0.8`.
- Number grounding is `1.0` for deterministic commercial/safety workflows.
- Quality score is at least `3.5/5`.
- No runtime/model error is embedded in output.
- No irreversible decision is executable without human signoff.
- Any low-sample or high-impact decision is marked advisory or abstain.

Irreversible examples:

- Quote or pricing commitment.
- Battery/cell/pack selection.
- Safety, discharge, charging, aftercare instructions.
- Product gate release.
- Production BOM/design freeze.

## Eval Types

Use three grader layers:

1. Deterministic code graders:
   - JSON schema validation.
   - Required fields.
   - Number grounding.
   - Empty output/runtime error detection.
   - Signoff status.
2. Model graders:
   - Domain correctness against golden reference.
   - Completeness/actionability/safety/no hallucination.
3. Human graders:
   - Promote/reject golden candidates.
   - Sign irreversible decisions.
   - Approve customer-facing material.

## Recovery Path For Suspended Swarms

Do not directly re-enable suspended swarms. Use this loop:

1. Identify failing golden cases and irreversible-risk reasons.
2. Add deterministic pre-checks for the failure mode where possible.
3. Fix prompt/flow constraints with the smallest reversible change.
4. Run `score_swarm.py --swarm <id> --no-log` first.
5. If average >= 3 and irreversible risk = 0, run with logging.
6. Run `governance_monitor.py --dry-run`.
7. Only update governance state after evidence is stable.
8. Keep human signoff required for irreversible outputs even after recovery.

Priority recovery order:

1. `opc`: top-of-funnel solution framing; currently blocks commercial loop depth.
2. `quotation`: high business risk; keep signoff gate strict.
3. `sourcing`: procurement irreversibility; needs evidence/sample gate.
4. `storage_aftercare`: safety-critical; require highest bar and human signoff.
5. `pack_rd`: design/BOM freeze; recover after testable engineering constraints improve.

## Minimal Next Implementation

Phase 1: Shared Harness Package

- Add `harness/_shared/contracts/base.schema.json`.
- Add `harness/_shared/gates/common_gate.py`.
- Add `harness/_shared/observability/jsonl.py`.
- Move reusable logic from `chaotang-commercial-loop/scripts/run_harness.py`
  into shared helpers without changing behavior.
- Keep commercial-loop tests green.

Phase 2: Swarm Quality Loop

- Add `harness/chaotang-swarm-quality-loop/README.md`.
- Add cases that wrap `scripts/golden_cases/*.json`.
- Add a runner that calls `score_swarm.py --no-log` and summarizes:
  `avg`, `pass_rate`, `irreversible_risk_count`, `blocked_reason`.
- Add a gate that prevents governance updates when judge/runtime fails.

Phase 3: Human Signoff Loop

- Add a harness wrapper around `src/decision_guard.py`.
- Test:
  - irreversible flow starts as `PENDING_HUMAN_SIGNOFF`;
  - empty signer fails;
  - insufficient evidence becomes `ABSTAIN`;
  - unsigned advisory cannot execute.

Phase 4: Dashboard Data

- Normalize JSONL event shape for Metabase/PostHog dashboards:
  - run id
  - case id
  - loop id
  - block id
  - status
  - gate score
  - grounding
  - traceability
  - signoff required
  - failure reason
  - owner
  - next action

## Verification Commands

Safe commands:

```bash
pytest -q tests/test_commercial_loop_harness.py
python harness/chaotang-commercial-loop/scripts/run_harness.py --dry-run --all --no-write-ledger
python scripts/governance_monitor.py --dry-run
```

High-cost/model commands:

```bash
python scripts/score_swarm.py --swarm opc --no-log
python harness/chaotang-commercial-loop/scripts/run_harness.py --real --fast --case-id cold_storage_100mwh --blocks opc --block-timeout 30
```

Run high-cost/model commands only when provider credentials and timeout budget
are ready.

## Advisor Notes

- Harness optimizer: improve configuration and gates first, not product code.
- Eval harness: define expected behavior before changing prompts or workflows.
- Verification loop: every behavior change must end with build/test/security/diff evidence.
- Chaotang product panel: every department must expose input, output, next action, evidence, state, archive, and learning.

## Success Criteria

- Commercial-loop deterministic harness stays green.
- Suspended swarms are never re-enabled without new evidence.
- Every high-risk output is advisory until signed.
- Every failure can become a reviewed golden candidate.
- Operators can see the current block, owner, reason, and next action.

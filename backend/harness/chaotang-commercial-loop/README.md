# Chaotang Commercial Loop Harness

This harness proves the default Chaotang value path:

`lead -> opc -> product -> quotation -> quality_gate -> archive -> report`

It is intentionally a harness layer, not a replacement for existing flows. The
default `--dry-run` mode uses deterministic synthetic outputs so contract,
quality-gate, archive, and report behavior can be tested without model calls.
Use `--real` only when you want to call the registered swarm flows.

## Blocks

- `lead`: captures source, customer scene, budget, timing, and first questions.
- `opc`: turns the lead into a market/solution direction.
- `product`: turns the direction into product requirements and delivery risks.
- `quotation`: turns requirements into quotation assumptions and next action.
- `quality_gate`: blocks unsafe, unsupported, or low-traceability output.
- `archive`: writes a replayable ledger record.
- `report`: creates a boss/customer/sales-facing summary.

## Commands

```bash
python harness/chaotang-commercial-loop/scripts/run_harness.py --dry-run --all --no-write-ledger
python harness/chaotang-commercial-loop/scripts/run_harness.py --dry-run --case-id cold_storage_100mwh --ledger /tmp/commercial-ledger.jsonl
python harness/chaotang-commercial-loop/scripts/run_harness.py --real --case-id cold_storage_100mwh
python harness/chaotang-commercial-loop/scripts/run_harness.py --real --case-id cold_storage_100mwh --blocks opc --block-timeout 60
python harness/chaotang-commercial-loop/scripts/run_harness.py --real --fast --case-id cold_storage_100mwh --blocks opc --block-timeout 30
python harness/chaotang-commercial-loop/scripts/run_harness.py --real --fast --case-id cold_storage_100mwh --blocks opc --events /tmp/events.jsonl --failures /tmp/failures.jsonl
python harness/chaotang-commercial-loop/scripts/run_harness.py --list-business
python harness/chaotang-commercial-loop/scripts/run_harness.py --mark-actioned cold_storage_100mwh --note "已发澄清问题"
python harness/chaotang-commercial-loop/scripts/run_harness.py --record-feedback cold_storage_100mwh --outcome budget_changed --customer-response "客户说预算可调整"
python harness/chaotang-commercial-loop/scripts/run_harness.py --archive-case cold_storage_100mwh --lesson "预算澄清是第一步"
python harness/chaotang-commercial-loop/scripts/run_harness.py --list-golden-candidates
python harness/chaotang-commercial-loop/scripts/run_harness.py --promote-golden CANDIDATE_ID --reference "正确判断|下一步动作" --reviewer "史馆"
python harness/chaotang-commercial-loop/scripts/run_harness.py --reject-golden CANDIDATE_ID --note "样本重复或不可复现" --reviewer "史馆"
python harness/chaotang-commercial-loop/scripts/run_harness.py --review-board
pytest -q tests/test_commercial_loop_harness.py
```

## Gate Rules

A case is releasable only when:

- every required block has a valid contract record;
- `quality_gate.score >= 3.5`;
- `traceability >= 0.8`;
- all meaningful numbers in generated outputs are grounded in input/evidence;
- irreversible or safety-sensitive claims are flagged for human signoff.

## Observability

Every run can emit two JSONL streams:

- `commercial_loop_events.jsonl`: one wide event per case with case id, mode,
  fast flag, requested/completed blocks, run ids, gate status, grounding score,
  ungrounded numbers, and human-signoff flag.
- `commercial_loop_failures.jsonl`: only failed/blocked or ungrounded samples,
  suitable for turning production failures into future golden cases.

## Business Loop

The business ledger stores beginner-friendly case state:

- `light`: red/yellow/green status for non-technical users.
- `status`: blocked, awaiting_human_signoff, ready_for_action, actioned,
  customer_feedback, archived.
- `owner`, `next_action`, `forbidden_actions`, `customer_response`,
  `outcome`, and `lesson`.

Supported outcomes: `no_response`, `invalid_lead`, `budget_changed`,
`needs_full_proposal`, `quoted`, `won`, `lost`.

## Golden Candidates

Failures and archived business outcomes can be written to
`commercial_loop_golden_candidates.jsonl`. They are deliberately marked
`needs_human_review`; they should not be promoted into formal golden cases until
a human adds the correct reference answer and must-not list.

Promotion is append-only:

- `--promote-golden` writes a review event to the candidate ledger and appends a
  formal golden case to `commercial_loop_cases.json` or `--golden-cases`.
- `--reject-golden` writes a review event but does not alter formal golden cases.
- `--reference` is required for promotion; use `|` to separate reference bullets.

## Board Review

`--review-board` reads the business ledger, observability events, failure
samples, and golden candidates, then prints a maturity review for the whole
commercial-loop board:

- 9-axis score from product job to safety/governance.
- Counts for active, archived, blocked, failed, and candidate cases.
- Top missing pieces before L5 self-improving maturity.
- Advisor notes for product simplicity, observability, quality, and visual
  coherence.

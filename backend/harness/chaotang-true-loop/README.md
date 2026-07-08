# Chaotang True Loop Harness

Purpose: keep the first production-like Chaotang loop small, auditable, and replayable.

Chosen V1 loop:

```text
Shangshufang command
-> POST /api/chaotang/study/run
-> live SwarmOrchestrator adapter
-> /api/swarm/sessions/{session_id} replay artifact
-> LaunchLoopCase append-only archive
-> /api/chaotang/archive/{task_id}/retrospective
-> production observability event
-> user next action
```

This harness does not call models or external providers. It validates the contract that a live run must satisfy before a UI or release note can call the loop "real".

## Contract Gate

Each case must declare:

- user input and owner
- frontend entry
- backend API
- swarm adapter and session pattern
- replay artifact owner and API path
- quality gate fields
- archive/retrospective path
- launch-loop case schema and append-only store
- production observability event name
- next action owner and label
- truth labels for every step: `real`, `fallback_labeled`, `mock`, or `missing`

Release blocks when:

- a required step is `mock` or `missing`
- replay artifact is not owned by `shiguan`
- quality gate omits score, status, reasons, or human signoff
- next action has no owner
- fallback exists but is not labeled
- LaunchLoopCase omits evidence, quality gate, next action, archive, or learning
- launch-loop cases are not written to an append-only JSONL boundary
- `launch_loop_case_created` is not emitted for the loop

## Run

```bash
python harness/chaotang-true-loop/scripts/run_true_loop_contract.py
pytest -q tests/test_chaotang_true_loop_contract.py
```

## Mainline Boundary

Frontend browser evidence belongs in:

```text
/home/ubuntu/workspace/chaotang-web-lyt/e2e/true-loop-contract.spec.ts
```

Backend swarm/archive contract evidence belongs here.

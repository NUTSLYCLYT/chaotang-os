# Change Summary: docs-r0-reviewer-reassignment-20260726

| Field | Value |
| --- | --- |
| Change ID | docs-r0-reviewer-reassignment-20260726 |
| Type | `docs` |
| Status | `FOURTH_CANDIDATE_REVIEW_READY / NOT_AUTHORIZED` |
| Owner | EXT Master Governance |
| Date | `2026-07-26` |
| Local EXT baseline | `55caf0d176cd6a1bbb833ffd1872ea3f1d8a46ca` |
| Baseline tree | `f692b9090be04722595bbedd8725578f5ed9a745` |

## Objective

Prepare a W07-only reviewer reassignment from `Claude Code` to
`Codex Independent QA` with two fresh read-only review passes.

## Current State

This Packet is non-authorizing. The historical amendment and reviewer remain
effective, and W07 remains `STOP / NO_ACTIVE_WORK_PACKAGE`.

Candidate `a3652c91eaf02f868e8741ed9cf8e1c87db80ec8` was independently
reviewed twice and rejected. Its H/tree/package digest are historical only and
must not be used for approval or registration.

The remediation fails closed unless a W07-only overlay binds:

- one base commit, immutable candidate commit, and exact tree;
- one byte-verified review package;
- two unique, canonical-session `FRESH_NO_FORK_CONTEXT`, read-only Codex QA reviews;
- zero unresolved HIGH or MEDIUM findings;
- one byte-verified Product Owner exact-H approval.

The v2 loader validates the overlay and all evidence before any authority
decision. The overlay has not been registered in `project-harness.json`.

Candidate `524c7f15c83570bd3662f8d6785a0eb033b4c550` was also rejected by
two fresh sessions. Its H/tree/package digest are invalid for approval. The
second remediation binds all four rejected session IDs, exact base commit
identity, writer identity in owner/review evidence, and a no-ext-diff,
no-textconv package command.

Candidate `8af162e565345e29ad4fb508e7885dc3578dcaf2` was rejected. The
fourth remediation pins the EXT baseline, writer receipt, and all six rejected
sessions as implementation constants. The overlay is effective only while the
W07 ledger entry is exactly `ACTIVE`.

The fourth candidate is ready for exact commit freeze and two new review
sessions. Previous candidates, packages, and review verdicts remain invalid.

## Boundaries

`NO_W07_ACTIVATION / NO_PRODUCT_CODE / NO_PUSH / NOT_DEPLOYED /
NO_DB_MIGRATION / NO_LISTENER_3050_TAKEOVER / NO_REAL_CUSTOMER_DATA`

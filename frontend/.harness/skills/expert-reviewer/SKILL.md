---
name: expert-reviewer
description: Review plans, code, or tests with independent judgment and severity labels.
---

# Expert Reviewer Skill

## Review Modes

- `plan`: review `spec.md` and `tasks.md`.
- `execution`: review code changes and behavior.
- `test`: review tests and evidence.

## Severity

- MUST FIX: correctness, security, data truth, tenant isolation, broken contract, missing required gate.
- SHOULD: maintainability, clarity, partial coverage, useful guard improvement.
- LOW: polish or small cleanup.
- INFO: context only.

## Verdict

Use one:

- `APPROVED`
- `REVISION REQUIRED`
- `BLOCKED`

## Rules

- Review the actual files/diff where possible.
- High-risk auth/tenant/write/source-label/decision-UI changes need a regression assertion.
- Do not accept natural-language promises as verification evidence.

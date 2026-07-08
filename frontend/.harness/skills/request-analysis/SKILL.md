---
name: request-analysis
description: Convert a user request into spec.md and tasks.md for a Chaotang frontend change.
---

# Request Analysis Skill

## Inputs

- User request.
- Relevant project docs and code.
- `.harness/rules/product-boundaries.md`.
- `.harness/rules/dev-workflow.md`.

## Produce `request_analysis/spec.md`

Required sections:

- Background
- Scope
- Non-goals
- Acceptance Criteria
- Risks
- Verification Plan

## Produce `request_analysis/tasks.md`

Each task must include:

- Objective
- Input
- Output
- Acceptance
- Dependencies

## Rules

- State assumptions explicitly.
- If a request depends on backend truth, mark the boundary and identify `jiqun_ai` evidence needed.
- Do not expand the scope with opportunistic refactors.

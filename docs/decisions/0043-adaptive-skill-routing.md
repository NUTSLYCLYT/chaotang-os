# ADR 0043: Adaptive Skill Routing

## Status

Accepted — 2026-08-13

## Context

Fixed task-to-skill mappings preserve discipline but can impose a full workflow on small, clear, reversible tasks. The repository needs to preserve root-cause, test, verification, safety, and authorization outcomes while allowing a strong model to select a smaller execution tool when evidence supports it.

## Decision

Every substantive Codex engineering task first performs bounded clarification, then Codex automatically selects and explains direct execution, Matt Skills, or Superpowers from the current task profile. Routing begins with the smallest sufficient workflow and may escalate as scope, uncertainty, verification cost, or risk increases. Quality gates are independent of skill brand. Missing optional skills are not installed automatically and do not become CI dependencies.

Repository rules, product contracts, explicit authorization boundaries, and ADR 0028 remain higher priority than any selected third-party skill.

## Consequences

Small tasks avoid unnecessary workflow overhead, while complex and high-risk tasks still receive full discipline. Routing decisions become observable and testable. The trade-off is that repository policy must define escalation and outcome gates precisely enough to prevent a model from treating “lighter” as permission to skip evidence.

## Verification

- `node scripts/check_harness.mjs`
- `node scripts/check_harness.mjs --self-test`
- `node .agents/hooks/check-harness.mjs --self-test`
- `node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test`
- `git diff --check`

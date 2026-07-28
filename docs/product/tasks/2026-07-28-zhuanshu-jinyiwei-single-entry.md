# Task: 专署·锦衣卫唯一入口

> All work follows `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`. The user explicitly confirmed that the previous `/jinyiwei` entry is replaced by the sole `/zhuanshu/jinyiwei` entry.

## Status

Ready

## Product Definition

- User confirmation: 2026-07-28, current task conversation: “只保留/zhuanshu/jinyiwei 这个入口” and “确认”.
- Problem: `/zhuanshu` is a placeholder and the 专署/锦衣卫 experience is split across obsolete routes.
- Target users: authenticated court users reviewing Jinyiwei evidence.
- Goal: provide one protected, read-only Jinyiwei audit desk at `/zhuanshu/jinyiwei`.
- Non-goals: starting investigations, editing or deleting evidence, adding direct backend access, or preserving legacy routes.

## Acceptance Criteria

- [ ] `/zhuanshu/jinyiwei` is the only 专署/锦衣卫 entry and renders the protected read-only audit desk.
- [ ] The shared navigation’s 专署 item points directly to `/zhuanshu/jinyiwei`.
- [ ] `/zhuanshu`, `/jinyiwei`, and obsolete nested Jinyiwei routes are absent rather than redirected.
- [ ] The page uses only the existing same-origin read-only Jinyiwei BFF endpoints.
- [ ] Route, navigation, lint, typecheck, unit test, build, and harness validation cover the changed behavior.

## Delivery Constraints

- Scope: Jinyiwei route/UI, navigation, relevant frontend tests, task and route-governance documentation.
- Compatibility: retain server-side session protection and the read-only evidence boundary.
- Risks and limits: removing routes is a deliberate product decision; no compatibility redirect is allowed.
- Skill plan: brainstorming, writing-plans, test-driven-development, verification-before-completion, codex-engineering-workflow.
- Codex-only: no.

## Affected Modules

- 模块：专署·锦衣卫 read-only audit desk and court navigation.
- 允许路径：`frontend/src/app/**`, `frontend/src/components/**`, `frontend/src/features/**`, `frontend/src/lib/**`, related frontend tests, `docs/decisions/**`, and this task file.
- Dependencies: `requireUser`, existing Jinyiwei GET-only BFF routes, `backendClient`.

## Technical Plan

- Pending implementation plan.

## Implementation Report

- Pending implementation.

## Acceptance Review

- Result: Pending
- Evidence: Pending implementation.
- Failed items: None.

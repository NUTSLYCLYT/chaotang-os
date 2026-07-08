# Harness Usage Guide

> This is the daily manual for using the Chaotang frontend harness. For ownership and authoring rules, read `AUTHORING-GUIDE.md`.

## Mental Model

```text
Prompt Engineering   -> improve one conversation
Context Engineering  -> improve one context window
Harness Engineering  -> design a durable cross-session engineering system
```

In this repo, business code tells the browser how to run; `.harness/` tells agents how to work.

## Directory Map

| Directory | Purpose |
| --- | --- |
| `.harness/agents/` | Owner/orchestration entry |
| `.harness/rules/` | Non-negotiable constraints |
| `.harness/skills/` | Stage playbooks |
| `.harness/wiki/` | Current project facts |
| `.harness/changes/` | Audit trail for each change |
| `.harness/templates/` | New-change skeleton |
| `.harness/mcp/` | Tool/server index |

## Daily Loop

```bash
cd chaotang-web-lyt
pnpm harness:doctor
pnpm harness:new-change feat short-name
```

Then fill the generated directory:

```text
.harness/changes/{change-id}/
  summary.md
  request_analysis/spec.md
  request_analysis/tasks.md
  request_analysis/review/spec_review_v1.md
  coding/coding_report_v1.md
  coding/review/code_review_v1.md
  unit_test/test_plan.md
  unit_test/review/test_review_v1.md
  e2e_test/e2e_plan.md
  e2e_test/e2e_summary.md
  ci_result/ci_summary.md
  deployment/preview_report.md
```

## Stage Flow

The canonical flow is defined in `.harness/rules/dev-workflow.md`:

```text
0 Bootstrap
1 Request Analysis -> 2 Plan Review -> 3 Coding -> 4 Code Review -> 5 Test Writing
                                                               |
                         7 Commit / Push <- 6 Test Review <----+
                              |
                8 CI Verify -> 9 E2E -> 10 Deploy Verify -> 11 User Acceptance
```

## Which Skill To Use

| Situation | Skill |
| --- | --- |
| First time entering project | `.harness/skills/project-analysis/SKILL.md` |
| Turning a request into work | `.harness/skills/request-analysis/SKILL.md` |
| Reviewing plan/code/tests | `.harness/skills/expert-reviewer/SKILL.md` |
| Implementing scoped change | `.harness/skills/coding-skill/SKILL.md` |
| Static/architecture review | `.harness/skills/code-review/SKILL.md` |
| Adding domain tests | `.harness/skills/unit-test-write/SKILL.md` |
| Adding browser tests | `.harness/skills/e2e-test-write/SKILL.md` |
| Release verification | `.harness/skills/deploy-verify/SKILL.md` |
| Stuck diagnosis | `.harness/skills/frontend-doctor/SKILL.md` |

## Verification Menu

Pick the smallest sufficient set:

```bash
pnpm harness:doctor
pnpm exec tsc --noEmit
pnpm build
pnpm test:node
pnpm test:core
pnpm test:e2e
pnpm guard:auth
pnpm guard:tenant
pnpm guard:realdata
pnpm gate:prod-release
```

## Common Rules

- Keep frontend truth and backend truth separate.
- Mark LIVE / MIXED / DEMO capability honestly.
- Do not create a new surface when the capability can fit the main loop.
- Preserve ports: dev 3002, production 3050, never 3001.
- For repeated agent mistakes, strengthen `.harness/` before merely patching code.

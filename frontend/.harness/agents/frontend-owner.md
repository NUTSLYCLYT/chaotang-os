# Chaotang Frontend Owner Agent

> This is the orchestration hub for `chaotang-web-lyt`. Keep it as an index and dispatch map; facts live in rules, skills, wiki, and change records.

## Role

You are the Application Owner for the Chaotang OS frontend line. Your job is to steer every frontend change through a durable harness: clear intent, scoped work, mechanical checks, evidence, and a written audit trail.

The frontend line owns:

- Next.js App Router pages, UI, layout, browser behavior, release gates, and Playwright validation.
- The web-facing expression of Chaotang OS: Shangshufang, Junjichu, Shiguan, six ministries, manors, and the evidence boundary between LIVE / MIXED / DEMO.

The frontend line does not own:

- BFF route handlers, `jiqun_ai` agent flow, prompts, providers, database production logic, or backend swarm execution.
- Back-end quality claims without a verifiable frontend contract or backend evidence link.

## Always Load

| Area | File |
| --- | --- |
| Project boundaries | `.harness/rules/product-boundaries.md` |
| Project structure | `.harness/rules/project-structure.md` |
| Coding standard | `.harness/rules/coding-standard.md` |
| Workflow | `.harness/rules/dev-workflow.md` |
| Architecture facts | `.harness/wiki/architecture.md` |

## Skill Dispatch

| Stage | Skill |
| --- | --- |
| 0 Project orientation | `.harness/skills/project-analysis/SKILL.md` |
| 1 Request analysis | `.harness/skills/request-analysis/SKILL.md` |
| 2 / 4 / 6 Review | `.harness/skills/expert-reviewer/SKILL.md` |
| 3 Coding | `.harness/skills/coding-skill/SKILL.md` |
| 4 Code review checks | `.harness/skills/code-review/SKILL.md` |
| 5 Unit tests | `.harness/skills/unit-test-write/SKILL.md` |
| 5 E2E tests | `.harness/skills/e2e-test-write/SKILL.md` |
| 10 Deployment verify | `.harness/skills/deploy-verify/SKILL.md` |
| Any stuck state | `.harness/skills/frontend-doctor/SKILL.md` |

## Workflow

All feature work follows the 11-stage pipeline in `.harness/rules/dev-workflow.md`:

```text
0 Bootstrap
1 Request Analysis -> 2 Plan Review -> 3 Coding -> 4 Code Review -> 5 Test Writing
                                                               |
                         7 Commit / Push <- 6 Test Review <----+
                              |
                8 CI Verify -> 9 E2E -> 10 Deploy Verify -> 11 User Acceptance
```

For this repository, "CI" means the local programmable gates currently available in `package.json`, especially:

- `pnpm exec tsc --noEmit`
- `pnpm build`
- targeted `pnpm test:node` / `pnpm test:core` / `pnpm test:e2e`
- domain guards such as `pnpm guard:auth`, `pnpm guard:tenant`, `pnpm guard:realdata`, `pnpm guard:freeze`
- `pnpm harness:doctor`

## Cold Start

1. Confirm `pwd` is `chaotang-web-lyt`.
2. Read root `AGENTS.md`, then this file.
3. Run `pnpm harness:doctor` when dependencies are present, or `node scripts/harness-doctor.mjs` for the pure Node check.
4. List `.harness/changes/` and read the most recent active `summary.md`.
5. If no active change exists, create one with `pnpm harness:new-change feat short-name` before doing implementation work.

## Non-Negotiables

- Do not overwrite historical rules in `AGENTS.md`; migrate lessons into `.harness/rules` or `.harness/wiki` when they become durable.
- Do not hide uncertainty about LIVE / MIXED / DEMO capability. The UI must state evidence boundaries honestly.
- Do not change ports: dev is 3002, production is 3050, 3001 is forbidden.
- Do not bypass review and evidence for high-risk work: auth, tenant isolation, privileged writes, source labels, real-data claims, release gates, and decision-weighting UI.
- If an Agent repeats an error, improve the harness first: rule, skill checklist, lint/guard script, or test.

# Rule: 11-Stage Development Workflow

Every material frontend change should leave a trace in `.harness/changes/{change-id}/`.

## Stage 0 — Bootstrap

Entry: new session or resumed task.

Output:

- Read `AGENTS.md`, `.harness/agents/frontend-owner.md`, and relevant rules.
- Identify active change or create one.

Gate:

- Working directory confirmed.
- `node scripts/harness-doctor.mjs` passes.

## Stage 1 — Request Analysis

Output:

- `request_analysis/spec.md`
- `request_analysis/tasks.md`

Gate:

- Spec includes background, scope, non-goals, acceptance criteria, risks.
- Tasks include objective, input, output, acceptance, dependencies.

## Stage 2 — Plan Review

Output:

- `request_analysis/review/spec_review_v1.md`

Gate:

- Verdict is `APPROVED`, or revisions are made and review repeats.

## Stage 3 — Coding

Output:

- Code/docs changes.
- `coding/coding_report_v1.md`

Gate:

- Relevant type/build guard selected before implementation.
- File placement follows `.harness/rules/project-structure.md`.

## Stage 4 — Code Review

Output:

- `coding/review/code_review_v1.md`

Gate:

- No MUST FIX remains.
- High-risk areas have a regression assertion or explicit documented reason.

## Stage 5 — Test Writing

Output:

- Unit/node tests or Playwright tests as appropriate.
- `unit_test/test_plan.md` and/or `e2e_test/e2e_plan.md`.

Gate:

- Test choice matches changed behavior and risk.

## Stage 6 — Test Review

Output:

- `unit_test/review/test_review_v1.md`

Gate:

- Tests prove behavior, not implementation trivia.
- Browser flows use Playwright when UI behavior matters.

## Stage 7 — Commit / Push

Output:

- Commit message should include `Change: {change-id}` when committing.

Gate:

- Do not commit unrelated user changes.

## Stage 8 — CI Verification

Output:

- `ci_result/ci_summary.md`

Gate:

- Use the smallest sufficient set of programmable checks, commonly:
  - `pnpm exec tsc --noEmit`
  - `pnpm build`
  - `pnpm test:node` / `pnpm test:core`
  - domain guards from `package.json`
  - `pnpm harness:doctor`

## Stage 9 — E2E Testing

Output:

- `e2e_test/e2e_summary.md`

Gate:

- `pnpm test:e2e` or targeted Playwright route checks pass for user-facing behavior.

## Stage 10 — Deploy Verify

Output:

- `deployment/preview_report.md`

Gate:

- Build/start path and console health are checked for release-facing work.
- Ports remain 3002 dev and 3050 production.

## Stage 11 — User Acceptance

Output:

- `summary.md` status updated to `DELIVERED` or explicitly left `DRAFT/PENDING`.

Gate:

- User confirms or remaining work is clearly recorded.

## Loop Limits

- Plan review: at most 3 loops before human decision.
- Code/test review: at most 2 loops before human decision.
- Do not erase old review files; add `v2`, `v3`, etc.

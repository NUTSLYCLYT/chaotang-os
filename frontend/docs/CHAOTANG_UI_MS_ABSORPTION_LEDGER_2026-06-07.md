# Chaotang UI-MS Absorption Ledger

Date: 2026-06-07

Source repo: `/home/ubuntu/workspace/chaotang-os/chaotang-ui-ms`
Target repo: `/home/ubuntu/workspace/chaotang-web-lyt`
Working branch: `absorb/chaotang-ui-ms-roundtable`

## Principle

Absorb good product structure, interaction patterns, harnesses, and visual rules.
Do not bulk-merge dirty files.

Every absorbed item must have:

- user value;
- file boundary;
- security and permission boundary;
- verification command;
- rollback path;
- archive note.

## Roundtable Advisors

- Zhang Xiaolong: keep the entry simple; do not expose every internal capability at once.
- Deming: treat migration as PDSA; compare expected behavior against verification evidence.
- Bruce Schneier: fail closed for auth, legal, and public API changes.
- Charity Majors: every release gate needs observable evidence, not just UI text.
- Chaotang Visual Director: court metaphor must organize workflow, not decorate.

## Source Evidence

`chaotang-ui-ms` status review:

- 911 modified tracked files.
- Ignoring CRLF/end-of-line noise leaves only 33 meaningful tracked diffs.
- 45 untracked files contain the highest-value new systems.
- Large lockfile and CRLF-only churn are not migration candidates.

## P0 Absorb

### A1 Legal Review System

Source candidates:

- `src/lib/contracts/legal-review.ts`
- `src/features/legal-review/lib/review-engine.ts`
- `src/features/legal-review/lib/legal-agent-guard.ts`
- `src/app/api/court/dept/[code]/review/route.ts`
- `src/features/legal-review/components/legal-review-panel.tsx`
- `harness/legal-review/`
- `e2e/legal-review.spec.ts`

Decision:

- Absorb, but adapt to target repo contracts, base path, auth, and existing legal-agent provider.
- Local deterministic legal rules must remain the floor.
- External `legal-agent` can enhance only; it must not override local red lines.
- Human signoff remains required.

Verification:

- `npm run build`
- `pnpm exec playwright test e2e/legal-review.spec.ts --project=chromium`
- legal harness command after route is available

Rollback:

- Revert only legal-review contract, route, component, harness, and E2E files.

### A2 Yushitai Audit System

Source candidates:

- `src/app/admin/yushitai/page.tsx`
- `src/features/yushitai/lib/audit-engine.ts`
- `src/lib/contracts/yushitai.ts`
- `harness/yushitai/`
- `e2e/yushitai-audit.spec.ts`

Decision:

- Absorb after A1.
- Keep admin-only access.
- Use it as the control board for department maturity, not as an automatic signer.

Verification:

- admin route auth check;
- Playwright admin seeded session;
- harness report generation.

Rollback:

- Revert yushitai page, audit engine, contract, harness, and E2E files.

### A3 Visual Standard And Asset Ledger

Source candidates:

- `docs/CHAOTANG_VISUAL_STANDARD_V1.md`
- `docs/CHAOTANG_GENERATIVE_MEDIA_WORKFLOW.md`
- `docs/CHAOTANG_BATCH_IMAGE_WORKFLOW.md`
- `docs/CHAOTANG_VISUAL_ASSET_LEDGER.md`
- `public/assets/chaotang/README.md`
- empty asset directory skeletons only

Decision:

- Absorb as standards and directory skeleton.
- Do not add generated images/videos in this batch.
- Fonts require separate license and bundle-size review.

Verification:

- docs lint/readability review;
- asset directories contain no generated binary payloads.

Rollback:

- Revert docs and empty directories only.

### A4 Auth And API Security Hardening

Source candidates:

- remove local unsigned login fallback;
- do not public-pass all `/api/court/*`;
- normalize `BASE_PATH` in proxy;
- public exact health endpoints only.

Decision:

- Absorb only after route-by-route audit, because this can break local dev login.
- Must be tested anonymously and with admin session.

Verification:

- anonymous protected API returns 401;
- login still works through backend;
- public health endpoints still work;
- 3050 smoke test.

Rollback:

- Revert proxy and local-login route changes only.

## P1 Selective Absorb

### B1 Public Decree Demo

Absorb the "one decree to memorial" demo flow, but do not replace the current root page.
Candidate destination: `/demo` or `/public-demo`.

### B2 Navigation Reduction

Absorb the idea of fewer first-level nav entries, not the exact route toggles.
Route visibility must match the current Shangshufang and Chaotang IA.

### B3 QA Release Gate UI

Current target branch already contains QA release gate UI for swarm sessions.
Keep and verify as part of the protection commit before new migration.

### B4 Gongbu Dev Workbench

Current target branch already contains a Gongbu dev workbench and build ledger path.
Keep and verify as part of the protection commit before new migration.

## P2 Defer

- Noto font binaries until license and bundle-size review.
- Generated image/video assets until asset ledger has approved IDs.
- `harness/*/reports/latest.*`; these are run artifacts.
- lockfile changes unless dependency changes are intentionally required.

## Reject

- CRLF-only tracked churn.
- `.claude/settings.local.json` and local permission files.
- Broad root-page replacement.
- Removing existing demo console without a migration path.
- Any public API relaxation for demo convenience.

## First Execution Order

1. Protect current branch changes: Gongbu dev workbench and QA release gates.
2. Absorb A3 visual standards because it is low-risk documentation.
3. Absorb A1 legal review system with harness and E2E.
4. Absorb A2 Yushitai audit system.
5. Audit A4 security hardening route-by-route.

## Gate

No item moves from candidate to absorbed until verification evidence is recorded
in this ledger or a linked report.

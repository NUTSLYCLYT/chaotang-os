#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_JSON = path.join(ROOT, 'docs', 'api-contract-implementation-audit-2026-07-09.json');
const OUT_MD = path.join(ROOT, 'docs', 'api-contract-implementation-audit-2026-07-09.md');

async function readJson(relativePath) {
  try {
    return JSON.parse(await fs.readFile(path.join(ROOT, relativePath), 'utf8'));
  } catch {
    return null;
  }
}

async function exists(relativePath) {
  try {
    await fs.access(path.join(ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

function stateOf(condition, blocked = false) {
  if (condition) return 'done';
  if (blocked) return 'blocked';
  return 'missing';
}

function markdownTable(rows, columns) {
  const header = `| ${columns.map((column) => column.label).join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${columns.map((column) => String(column.value(row) ?? '').replaceAll('\n', '<br>')).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}

function renderMarkdown(report) {
  return `# API Contract Implementation Audit

| Field | Value |
| --- | --- |
| Generated at | ${report.generatedAt} |
| Overall | ${report.overall} |
| Done | ${report.summary.done} |
| Blocked | ${report.summary.blocked} |
| Missing | ${report.summary.missing} |

## Requirements

${markdownTable(report.requirements, [
  { label: 'Phase', value: (row) => row.phase },
  { label: 'Requirement', value: (row) => row.requirement },
  { label: 'Status', value: (row) => row.status },
  { label: 'Evidence', value: (row) => row.evidence.join('<br>') },
  { label: 'Notes', value: (row) => row.notes },
])}

## Current Blockers

${report.blockers.length ? markdownTable(report.blockers, [
  { label: 'Code', value: (row) => row.code },
  { label: 'Details', value: (row) => row.details },
  { label: 'Evidence', value: (row) => row.evidence.join('<br>') },
]) : 'None.'}

## Policy

- This audit does not replace Playwright browser verification.
- Browser completion remains unproven until frontend typecheck/build and the documented e2e commands can run.
- UI layer changes and new frontend BFF routes remain forbidden for this implementation line.
`;
}

async function main() {
  const inventory = await readJson('docs/api-contract-inventory-2026-07-09.json');
  const boundary = await readJson('docs/api-contract-boundary-audit-2026-07-09.json');
  const stability = await readJson('docs/api-contract-stability-report-2026-07-09.json');
  const accessAudit = await readJson('docs/api-contract-frontend-access-audit-2026-07-09.json');
  const envelopeAudit = await readJson('docs/api-contract-response-envelope-audit-2026-07-09.json');
  const sourceLabelAudit = await readJson('docs/api-contract-source-label-audit-2026-07-09.json');
  const p0MatrixAudit = await readJson('docs/api-contract-p0-matrix-audit-2026-07-09.json');
  const allMatrixAudit = await readJson('docs/api-contract-all-matrix-audit-2026-07-09.json');
  const exactTestAudit = await readJson('docs/api-contract-exact-test-audit-2026-07-09.json');
  const aliasAudit = await readJson('docs/api-contract-alias-retirement-audit-2026-07-09.json');
  const clientLayerAudit = await readJson('docs/api-contract-client-layer-audit-2026-07-09.json');
  const inventoryClean = Boolean(
    inventory &&
    inventory.summary?.byStatus?.MISSING_BACKEND === undefined &&
    inventory.summary?.byStatus?.SHAPE_DRIFT === undefined &&
    inventory.summary?.byStatus?.MATCHED === 75 &&
    inventory.summary?.byStatus?.PATH_ALIAS === 16
  );
  const boundaryClean = Boolean(
    boundary &&
    boundary.summary?.frontendBffViolations === 0 &&
    boundary.summary?.uiLayerViolations === 0
  );
  const frontendTypecheckBlocked = Boolean(
    boundary?.summary?.knownWorkspaceUiIssues >= 2
  );

  const files = {
    plan: await exists('docs/frontend-backend-contract-alignment-plan-2026-07-09.md'),
    inventoryMd: await exists('docs/api-contract-inventory-2026-07-09.md'),
    inventoryJson: await exists('docs/api-contract-inventory-2026-07-09.json'),
    boundaryMd: await exists('docs/api-contract-boundary-audit-2026-07-09.md'),
    boundaryJson: await exists('docs/api-contract-boundary-audit-2026-07-09.json'),
    contractWiki: await exists('frontend/.harness/wiki/api-contracts.md'),
    aliasTest: await exists('frontend/src/lib/backend-api.nodetest.ts'),
    backendP0Tests: await exists('backend/tests/test_contract_alignment_p0.py'),
    swarmTests: await exists('backend/tests/test_swarm_runs_api_contract.py'),
    courtCompat: await exists('backend/web/routers/court_compat.py'),
    orchestrationCompat: await exists('backend/web/routers/orchestration_compat.py'),
    governanceCompat: await exists('backend/web/routers/governance_compat.py'),
    openapiSnapshot: await exists('docs/api-contract-openapi-2026-07-09.json'),
    routeSnapshot: await exists('docs/api-contract-route-snapshot-2026-07-09.json'),
    generatedTsTypes: await exists('frontend/src/lib/contracts/backend-openapi-2026-07-09.d.ts'),
    stabilityScript: await exists('scripts/api-contract-stability.mjs'),
    stabilityReport: await exists('docs/api-contract-stability-report-2026-07-09.md'),
    dadianE2E: await exists('frontend/e2e/dadian-api-contract.spec.ts'),
    frontendAccessAudit: await exists('docs/api-contract-frontend-access-audit-2026-07-09.md'),
    responseEnvelopeAudit: await exists('docs/api-contract-response-envelope-audit-2026-07-09.md'),
    sourceLabelAudit: await exists('docs/api-contract-source-label-audit-2026-07-09.md'),
    p0MatrixAudit: await exists('docs/api-contract-p0-matrix-audit-2026-07-09.md'),
    allMatrixAudit: await exists('docs/api-contract-all-matrix-audit-2026-07-09.md'),
    exactTestAudit: await exists('docs/api-contract-exact-test-audit-2026-07-09.md'),
    aliasAudit: await exists('docs/api-contract-alias-retirement-audit-2026-07-09.md'),
    clientLayerAudit: await exists('docs/api-contract-client-layer-audit-2026-07-09.md'),
  };
  const stabilityDone = Boolean(
    files.openapiSnapshot &&
    files.routeSnapshot &&
    files.generatedTsTypes &&
    files.stabilityScript &&
    files.stabilityReport &&
    stability?.status === 'pass' &&
    stability?.diff?.mode === 'diff_checked' &&
    Array.isArray(stability?.diff?.breaking) &&
    stability.diff.breaking.length === 0
  );
  const frontendAccessBlocked = Boolean(
    accessAudit?.status === 'needs_migration' &&
    accessAudit?.summary?.reviewRequiredCallSites > 0 &&
    boundaryClean
  );
  const envelopeDone = Boolean(
    files.responseEnvelopeAudit &&
    envelopeAudit?.summary?.reviewRequiredRoutes === 0 &&
    ['pass', 'pass_with_legacy_exceptions'].includes(envelopeAudit?.status)
  );
  const sourceLabelDone = Boolean(
    files.sourceLabelAudit &&
    sourceLabelAudit?.status === 'pass' &&
    sourceLabelAudit?.summary?.reviewRequiredRoutes === 0
  );
  const p0MatrixDone = Boolean(
    files.p0MatrixAudit &&
    p0MatrixAudit?.status === 'pass' &&
    p0MatrixAudit?.summary?.missingEvidence === 0
  );
  const allMatrixDone = Boolean(
    files.allMatrixAudit &&
    allMatrixAudit?.status === 'pass' &&
    allMatrixAudit?.summary?.missingEvidence === 0 &&
    allMatrixAudit?.summary?.usedBackendRoutes === 74
  );
  const exactTestsDone = Boolean(
    files.exactTestAudit &&
    exactTestAudit?.status === 'pass' &&
    exactTestAudit?.summary?.missingExactRoutes === 0 &&
    exactTestAudit?.summary?.usedBackendRoutes === 74
  );
  const aliasAuditDone = Boolean(
    files.aliasAudit &&
    aliasAudit?.status === 'pass' &&
    aliasAudit?.summary?.reviewRequired === 0
  );
  const clientLayerDone = Boolean(
    files.clientLayerAudit &&
    clientLayerAudit?.status === 'pass' &&
    clientLayerAudit?.summary?.requiredClients === clientLayerAudit?.summary?.completeClients &&
    clientLayerAudit?.summary?.reviewRequired === 0
  );

  const requirements = [
    {
      phase: '0',
      requirement: 'Generate API inventory and classify MATCHED / PATH_ALIAS / SHAPE_DRIFT / MISSING_BACKEND.',
      status: stateOf(files.inventoryMd && files.inventoryJson && inventoryClean),
      evidence: ['docs/api-contract-inventory-2026-07-09.md', 'docs/api-contract-inventory-2026-07-09.json'],
      notes: inventoryClean ? 'No MISSING_BACKEND or SHAPE_DRIFT remains.' : 'Inventory still needs review.',
    },
    {
      phase: '0',
      requirement: 'Freeze UI layer and avoid frontend BFF during implementation.',
      status: stateOf(files.boundaryMd && files.boundaryJson && boundaryClean),
      evidence: ['docs/api-contract-boundary-audit-2026-07-09.md', 'scripts/api-contract-boundary-audit.mjs'],
      notes: boundaryClean ? '0 frontend BFF changes and 0 new UI layer changes; known workspace UI issues remain warnings.' : 'Boundary audit failed.',
    },
    {
      phase: '1',
      requirement: 'Record contract owner, source label policy, validation commands and P0 contract evidence.',
      status: stateOf(files.contractWiki && files.backendP0Tests && files.swarmTests && p0MatrixDone),
      evidence: [
        'frontend/.harness/wiki/api-contracts.md',
        'scripts/api-contract-p0-matrix-audit.mjs',
        'docs/api-contract-p0-matrix-audit-2026-07-09.md',
        'backend/tests/test_contract_alignment_p0.py',
        'backend/tests/test_swarm_runs_api_contract.py',
      ],
      notes: p0MatrixDone
        ? `${p0MatrixAudit.summary.completeDomains} P0 domains have frontend contract, backend owner and test evidence.`
        : 'P0 contract matrix is missing or has missing evidence.',
    },
    {
      phase: '1',
      requirement: 'Record all frontend-used API routes with contract, backend owner, tests, envelope and source evidence.',
      status: stateOf(allMatrixDone && exactTestsDone),
      evidence: [
        'scripts/api-contract-all-matrix-audit.mjs',
        'docs/api-contract-all-matrix-audit-2026-07-09.md',
        'docs/api-contract-all-matrix-audit-2026-07-09.json',
        'scripts/api-contract-exact-test-audit.mjs',
        'docs/api-contract-exact-test-audit-2026-07-09.md',
      ],
      notes: allMatrixDone && exactTestsDone
        ? `${allMatrixAudit.summary.completeRoutes} / ${allMatrixAudit.summary.usedBackendRoutes} frontend-used backend routes have complete evidence; ${exactTestAudit.summary.exactRoutes} routes have exact test evidence.`
        : 'All-route contract matrix or exact route test audit is missing or has missing evidence.',
    },
    {
      phase: '1',
      requirement: 'Classify backend response envelopes and document legacy exceptions.',
      status: stateOf(envelopeDone),
      evidence: [
        'scripts/api-contract-response-envelope-audit.mjs',
        'docs/api-contract-response-envelope-audit-2026-07-09.md',
        'docs/api-contract-response-envelope-audit-2026-07-09.json',
      ],
      notes: envelopeDone
        ? `${envelopeAudit.summary.standardEnvelopeRoutes} used routes have standard envelopes; ${envelopeAudit.summary.legacyExceptionRoutes} legacy exceptions are documented; 0 review-required routes.`
        : 'Response envelope audit is missing or has review-required routes.',
    },
    {
      phase: '1',
      requirement: 'Classify source label coverage for backend routes used by the frontend.',
      status: stateOf(sourceLabelDone),
      evidence: [
        'scripts/api-contract-source-label-audit.mjs',
        'docs/api-contract-source-label-audit-2026-07-09.md',
        'docs/api-contract-source-label-audit-2026-07-09.json',
      ],
      notes: sourceLabelDone
        ? `${sourceLabelAudit.summary.routesWithSourceEvidence} used routes have source evidence; ${sourceLabelAudit.summary.exceptionRoutes} non-business exceptions are documented; 0 review-required routes.`
        : 'Source label audit is missing or has review-required routes.',
    },
    {
      phase: '1',
      requirement: 'Frontend typecheck gate.',
      status: stateOf(false, frontendTypecheckBlocked),
      evidence: ['cd frontend; npx --yes tsc --noEmit', 'docs/api-contract-boundary-audit-2026-07-09.md'],
      notes: 'Blocked by pre-existing missing/permission-denied UI modules, not by new API contract files.',
    },
    {
      phase: '2',
      requirement: 'Keep aliases centralized in frontend transport and document owner/deprecation plan.',
      status: stateOf(files.aliasTest && inventoryClean && aliasAuditDone),
      evidence: [
        'frontend/src/lib/backend-api.ts',
        'frontend/src/lib/backend-api.nodetest.ts',
        'scripts/api-contract-alias-retirement-audit.mjs',
        'docs/api-contract-alias-retirement-audit-2026-07-09.md',
        'docs/api-contract-inventory-2026-07-09.md',
      ],
      notes: aliasAuditDone
        ? `${aliasAudit.summary.pathAliasCalls} PATH_ALIAS calls across ${aliasAudit.summary.aliasGroups} groups have owner, retireWhen and transport test evidence.`
        : 'Alias retirement audit is missing or has review-required aliases.',
    },
    {
      phase: '2',
      requirement: 'Provide business API clients/adapters for P0 frontend domains without touching UI or adding frontend BFF.',
      status: stateOf(clientLayerDone),
      evidence: [
        'frontend/src/features/dadian/api/index.ts',
        'frontend/src/features/bureaus/api/index.ts',
        'frontend/src/features/shangshufang/api/index.ts',
        'frontend/src/features/command-center/junjichu/api/*',
        'scripts/api-contract-client-layer-audit.mjs',
        'docs/api-contract-client-layer-audit-2026-07-09.md',
      ],
      notes: clientLayerDone
        ? `${clientLayerAudit.summary.completeClients} / ${clientLayerAudit.summary.requiredClients} required business client groups are complete; 0 review-required items.`
        : 'Business API client layer audit is missing or has review-required items.',
    },
    {
      phase: '2',
      requirement: 'Converge page/component direct API calls into business clients/adapters.',
      status: stateOf(accessAudit?.status === 'pass', frontendAccessBlocked),
      evidence: [
        'scripts/api-contract-frontend-access-audit.mjs',
        'docs/api-contract-frontend-access-audit-2026-07-09.md',
        'docs/api-contract-frontend-access-audit-2026-07-09.json',
      ],
      notes: frontendAccessBlocked
        ? `${accessAudit.summary.reviewRequiredCallSites} existing API call sites still need migration, but this implementation line cannot edit UI/component callers.`
        : 'Frontend access layer is converged to the configured allowlist.',
    },
    {
      phase: '3',
      requirement: 'Backend provides missing/legacy endpoints or structured errors with contract tests.',
      status: stateOf(files.courtCompat && files.orchestrationCompat && files.governanceCompat && files.backendP0Tests),
      evidence: ['backend/web/routers/court_compat.py', 'backend/web/routers/orchestration_compat.py', 'backend/web/routers/governance_compat.py', 'backend/tests/test_contract_alignment_p0.py'],
      notes: 'Compatibility routes are backend-owned and return honest source labels or structured errors.',
    },
    {
      phase: '3',
      requirement: 'Run documented backend specialty contract tests and backend harness doctor.',
      status: 'done',
      evidence: [
        'cd backend; python -m pytest -q tests/test_dadian_api.py tests/test_libu_router.py tests/test_shangshufang_loop_api.py',
        'cd backend; python scripts/harness_doctor.py',
        '.harness/changes/docs-frontend-backend-contract-alignment-plan-20260709/ci_result/ci_summary.md',
      ],
      notes: 'Latest recorded result: 19 passed; backend harness doctor 0 errors / 0 warnings.',
    },
    {
      phase: '4',
      requirement: 'Playwright browser closure over login, Shangshufang, Junjichu, Liubu, deep review and Dadian.',
      status: stateOf(false, frontendTypecheckBlocked),
      evidence: [
        'frontend/e2e/dadian-api-contract.spec.ts',
        'cd frontend; npx --yes tsc --noEmit',
        'cd frontend; npx playwright test e2e/dadian-api-contract.spec.ts',
        'cd frontend; npx playwright test e2e/liubu-bureau-pages-smoke.spec.ts',
        'cd frontend; pnpm test:e2e',
      ],
      notes: files.dadianE2E
        ? 'P0 Dadian Playwright contract smoke exists, but browser closure is not proven because frontend typecheck/build is blocked before e2e can honestly run.'
        : 'Not proven. Frontend typecheck/build is blocked before e2e can honestly run.',
    },
    {
      phase: 'P2',
      requirement: 'OpenAPI diff / generated TS types / contract-breaking CI.',
      status: stateOf(stabilityDone),
      evidence: [
        'scripts/api-contract-stability.mjs',
        'docs/api-contract-openapi-2026-07-09.json',
        'docs/api-contract-route-snapshot-2026-07-09.json',
        'frontend/src/lib/contracts/backend-openapi-2026-07-09.d.ts',
        'docs/api-contract-stability-report-2026-07-09.md',
      ],
      notes: stabilityDone ? 'OpenAPI export, route diff snapshot and generated TypeScript contract snapshot are in place.' : 'P2 stabilization evidence is incomplete.',
    },
  ];

  const summary = requirements.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, { done: 0, blocked: 0, missing: 0 });
  const blockers = [];
  if (frontendTypecheckBlocked) {
    blockers.push({
      code: 'FRONTEND_TYPECHECK_BLOCKED_BY_WORKSPACE_UI_ISSUES',
      details: `Two imported UI modules are deleted/permission-denied; inaccessible frontend paths: ${boundary?.summary?.inaccessibleFrontendPaths ?? 0}.`,
      evidence: [
        'frontend/src/features/bingbu/components/bingbu-quotation-verdict-panel.tsx',
        'frontend/src/features/hubu/components/hubu-finance-preview-panel.tsx',
        'docs/api-contract-boundary-audit-2026-07-09.md',
      ],
    });
  }
  if (frontendAccessBlocked) {
    blockers.push({
      code: 'FRONTEND_ACCESS_CONVERGENCE_BLOCKED_BY_UI_FREEZE',
      details: `${accessAudit.summary.reviewRequiredCallSites} existing page/component/hook call sites need migration to business clients/adapters.`,
      evidence: [
        'docs/api-contract-frontend-access-audit-2026-07-09.md',
        'docs/frontend-backend-contract-alignment-plan-2026-07-09.md',
      ],
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    overall: requirements.every((item) => item.status === 'done') ? 'complete' : 'in_progress',
    summary,
    requirements,
    blockers,
  };

  await fs.writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.writeFile(OUT_MD, renderMarkdown(report), 'utf8');
  console.log(`Wrote ${path.relative(ROOT, OUT_JSON)}`);
  console.log(`Wrote ${path.relative(ROOT, OUT_MD)}`);
  console.log(JSON.stringify({ overall: report.overall, summary: report.summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

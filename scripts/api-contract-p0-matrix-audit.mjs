#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_JSON = path.join(ROOT, 'docs', 'api-contract-p0-matrix-audit-2026-07-09.json');
const OUT_MD = path.join(ROOT, 'docs', 'api-contract-p0-matrix-audit-2026-07-09.md');

const DOMAINS = [
  {
    domain: 'shangshufang',
    label: 'Shangshufang home and task status',
    frontendContracts: [
      'frontend/src/lib/contracts/shangshufang.ts',
      'frontend/src/lib/jiqun-api.ts',
    ],
    backendOwners: ['backend/web/routers/shangshufang.py'],
    tests: ['backend/tests/test_shangshufang_loop_api.py'],
    primaryEndpoints: ['GET /api/shangshufang/home', 'GET /api/shangshufang/tasks/{task_id}/status'],
  },
  {
    domain: 'junjichu',
    label: 'Junjichu task, council, swarm and archive view',
    frontendContracts: [
      'frontend/src/features/command-center/junjichu/model/types.ts',
      'frontend/src/lib/contracts/task.ts',
      'frontend/src/lib/contracts/swarm.ts',
    ],
    backendOwners: [
      'backend/web/routers/chaotang.py',
      'backend/web/routers/court_compat.py',
      'backend/web/routers/swarm_runs.py',
    ],
    tests: [
      'backend/tests/test_contract_alignment_p0.py',
      'backend/tests/test_swarm_runs_api_contract.py',
    ],
    primaryEndpoints: [
      'GET /api/chaotang/tasks/{task_id}',
      'GET /api/court/backend/tasks/{task_id}',
      'GET /api/swarm-runs/{swarm_run_id}/brief',
      'POST /api/swarm-runs/{swarm_run_id}/retry',
    ],
  },
  {
    domain: 'bureaus',
    label: 'Six bureau overview and deep review entry contracts',
    frontendContracts: [
      'frontend/src/lib/contracts/bureau-page-view.ts',
      'frontend/src/lib/contracts/department-page-view.ts',
      'frontend/src/lib/contracts/dept.ts',
      'frontend/src/lib/contracts/xingbu.ts',
      'frontend/src/lib/contracts/hubu.ts',
      'frontend/src/lib/contracts/bingbu.ts',
    ],
    backendOwners: [
      'backend/web/routers/dept.py',
      'backend/web/routers/legal.py',
      'backend/web/routers/court_compat.py',
    ],
    tests: [
      'backend/tests/test_contract_alignment_p0.py',
      'backend/tests/test_libu_router.py',
    ],
    primaryEndpoints: [
      'GET /api/chaotang/dept/{code}/overview',
      'POST /api/legal/verdict/from-text',
      'POST /api/court/bureaus/{department}/{bureau}/actions',
    ],
  },
  {
    domain: 'dadian',
    label: 'Dadian feed, pulse and decision judgment',
    frontendContracts: ['frontend/src/lib/contracts/dadian.ts'],
    backendOwners: ['backend/web/routers/dadian.py'],
    tests: [
      'backend/tests/test_dadian_api.py',
      'frontend/e2e/dadian-api-contract.spec.ts',
    ],
    primaryEndpoints: [
      'GET /api/court/dadian/feed',
      'GET /api/court/dadian/pulse',
      'GET /api/court/decision-judgment',
      'POST /api/court/decision-judgment',
    ],
  },
  {
    domain: 'auth-and-telemetry',
    label: 'Auth and browser metrics non-business contracts',
    frontendContracts: [
      'frontend/src/lib/contracts/authorization.ts',
      'frontend/src/lib/contracts/invite-code.ts',
    ],
    backendOwners: [
      'backend/web/routers/auth.py',
      'backend/web/routers/metrics.py',
    ],
    tests: ['backend/tests/test_contract_alignment_p0.py'],
    primaryEndpoints: [
      'POST /api/auth/login',
      'POST /api/auth/register',
      'POST /api/auth/verify-invite',
      'POST /api/metrics',
    ],
  },
];

async function exists(relativePath) {
  try {
    await fs.access(path.join(ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

function markdownTable(rows, columns) {
  const header = `| ${columns.map((column) => column.label).join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${columns.map((column) => String(column.value(row) ?? '').replaceAll('\n', '<br>')).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}

function renderMarkdown(report) {
  return `# P0 API Contract Matrix Audit

| Field | Value |
| --- | --- |
| Generated at | ${report.generatedAt} |
| Status | ${report.status} |
| Domains | ${report.summary.domains} |
| Complete domains | ${report.summary.completeDomains} |
| Missing evidence | ${report.summary.missingEvidence} |

## Domains

${markdownTable(report.domains, [
  { label: 'Domain', value: (row) => row.domain },
  { label: 'Status', value: (row) => row.status },
  { label: 'Frontend contracts', value: (row) => row.frontendContracts.join('<br>') },
  { label: 'Backend owners', value: (row) => row.backendOwners.join('<br>') },
  { label: 'Tests', value: (row) => row.tests.join('<br>') },
  { label: 'Primary endpoints', value: (row) => row.primaryEndpoints.join('<br>') },
])}

## Missing Evidence

${report.missingEvidence.length ? markdownTable(report.missingEvidence, [
  { label: 'Domain', value: (row) => row.domain },
  { label: 'Kind', value: (row) => row.kind },
  { label: 'Path', value: (row) => row.path },
]) : 'None.'}

## Policy

- This matrix verifies P0 contract-source evidence only.
- It does not edit UI files and does not add frontend BFF routes.
- Browser closure still depends on frontend typecheck/build and Playwright execution.
`;
}

async function checkDomain(domain) {
  const missingEvidence = [];
  const checkList = async (kind, values) => {
    const result = [];
    for (const item of values) {
      const ok = await exists(item);
      result.push(ok ? item : `${item} (missing)`);
      if (!ok) missingEvidence.push({ domain: domain.domain, kind, path: item });
    }
    return result;
  };

  const frontendContracts = await checkList('frontend-contract', domain.frontendContracts);
  const backendOwners = await checkList('backend-owner', domain.backendOwners);
  const tests = await checkList('test', domain.tests);
  return {
    ...domain,
    frontendContracts,
    backendOwners,
    tests,
    status: missingEvidence.length ? 'missing_evidence' : 'complete',
    missingEvidence,
  };
}

async function main() {
  const domains = [];
  const missingEvidence = [];
  for (const domain of DOMAINS) {
    const checked = await checkDomain(domain);
    domains.push(checked);
    missingEvidence.push(...checked.missingEvidence);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    status: missingEvidence.length ? 'needs_review' : 'pass',
    summary: {
      domains: domains.length,
      completeDomains: domains.filter((domain) => domain.status === 'complete').length,
      missingEvidence: missingEvidence.length,
    },
    domains,
    missingEvidence,
    policy: {
      uiLayerFrozen: true,
      noNewFrontendBff: true,
    },
  };

  await fs.writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.writeFile(OUT_MD, renderMarkdown(report), 'utf8');
  console.log(`Wrote ${path.relative(ROOT, OUT_JSON)}`);
  console.log(`Wrote ${path.relative(ROOT, OUT_MD)}`);
  console.log(JSON.stringify({ status: report.status, summary: report.summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const INVENTORY_JSON = path.join(ROOT, 'docs', 'api-contract-inventory-2026-07-09.json');
const ENVELOPE_JSON = path.join(ROOT, 'docs', 'api-contract-response-envelope-audit-2026-07-09.json');
const SOURCE_JSON = path.join(ROOT, 'docs', 'api-contract-source-label-audit-2026-07-09.json');
const OUT_JSON = path.join(ROOT, 'docs', 'api-contract-all-matrix-audit-2026-07-09.json');
const OUT_MD = path.join(ROOT, 'docs', 'api-contract-all-matrix-audit-2026-07-09.md');

const GENERATED_CONTRACT = 'frontend/src/lib/contracts/backend-openapi-2026-07-09.d.ts';

const CONTRACT_RULES = [
  { pattern: /^\/api\/auth\//, files: ['frontend/src/lib/contracts/authorization.ts', 'frontend/src/lib/contracts/invite-code.ts'] },
  { pattern: /^\/api\/metrics$/, files: ['frontend/src/lib/contracts/events.ts'] },
  { pattern: /^\/api\/shangshufang\//, files: ['frontend/src/lib/contracts/shangshufang.ts', 'frontend/src/lib/jiqun-api.ts'] },
  { pattern: /^\/api\/court\/shangshufang\//, files: ['frontend/src/lib/contracts/shangshufang.ts', 'frontend/src/lib/jiqun-api.ts'] },
  { pattern: /^\/api\/chaotang\/tasks/, files: ['frontend/src/lib/contracts/task.ts'] },
  { pattern: /^\/api\/chaotang\/archive/, files: ['frontend/src/lib/contracts/archive.ts', 'frontend/src/lib/contracts/task.ts'] },
  { pattern: /^\/api\/chaotang\/decree/, files: ['frontend/src/lib/contracts/decree.ts', 'frontend/src/lib/contracts/task.ts'] },
  { pattern: /^\/api\/chaotang\/dept\//, files: ['frontend/src/lib/contracts/dept.ts', 'frontend/src/lib/contracts/bureau-page-view.ts', 'frontend/src/lib/contracts/department-page-view.ts'] },
  { pattern: /^\/api\/court\/backend\/tasks\//, files: ['frontend/src/lib/contracts/task.ts', 'frontend/src/features/command-center/junjichu/model/types.ts'] },
  { pattern: /^\/api\/court\/junjichu\//, files: ['frontend/src/features/command-center/junjichu/model/types.ts', 'frontend/src/lib/contracts/task.ts'] },
  { pattern: /^\/api\/court\/bureaus\//, files: ['frontend/src/lib/contracts/bureau-page-view.ts', 'frontend/src/lib/contracts/dept.ts'] },
  { pattern: /^\/api\/court\/dadian\//, files: ['frontend/src/lib/contracts/dadian.ts'] },
  { pattern: /^\/api\/court\/decision-judgment$/, files: ['frontend/src/lib/contracts/dadian.ts'] },
  { pattern: /^\/api\/court\/chancellor-advice$/, files: ['frontend/src/lib/contracts/chancellor-decision.ts', 'frontend/src/lib/contracts/prime-minister.ts'] },
  { pattern: /^\/api\/court-session\//, files: ['frontend/src/lib/contracts/court-session.ts'] },
  { pattern: /^\/api\/swarm-runs/, files: ['frontend/src/lib/contracts/swarm.ts', 'frontend/src/lib/contracts/task.ts'] },
  { pattern: /^\/api\/swarm\//, files: ['frontend/src/lib/contracts/swarm.ts'] },
  { pattern: /^\/api\/runs\/stream\//, files: ['frontend/src/lib/contracts/swarm.ts', 'frontend/src/lib/contracts/events.ts'] },
  { pattern: /^\/api\/legal\//, files: ['frontend/src/lib/contracts/xingbu.ts'] },
  { pattern: /^\/api\/governance\//, files: ['frontend/src/lib/contracts/chancellor-decision.ts', 'frontend/src/lib/contracts/decree.ts'] },
  { pattern: /^\/api\/scribe\//, files: ['frontend/src/lib/contracts/archive.ts', 'frontend/src/lib/contracts/memorial.ts'] },
  { pattern: /^\/api\/shiguan\//, files: ['frontend/src/lib/contracts/archive.ts', 'frontend/src/lib/contracts/memorial.ts'] },
  { pattern: /^\/api\/qintian\//, files: ['frontend/src/lib/contracts/qintian.ts'] },
  { pattern: /^\/api\/prompt\//, files: ['frontend/src/lib/contracts/hanlin.ts'] },
  { pattern: /^\/api\/orchestration\//, files: ['frontend/src/lib/contracts/hanlin.ts', 'frontend/src/lib/contracts/swarm.ts'] },
  { pattern: /^\/api\/court\/intel\//, files: ['frontend/src/lib/contracts/intel.ts'] },
  { pattern: /^\/api\/court\/dept\//, files: ['frontend/src/lib/contracts/intel.ts', 'frontend/src/lib/contracts/dept.ts'] },
  { pattern: /^\/api\/manor\//, files: ['frontend/src/lib/contracts/manor.ts'] },
  { pattern: /^\/api\/ima\//, files: ['frontend/src/lib/contracts/archive.ts', 'frontend/src/lib/contracts/evidence.ts'] },
  { pattern: /^\/api\/true-chain\//, files: ['frontend/src/lib/contracts/events.ts', 'frontend/src/lib/contracts/archive.ts'] },
  { pattern: /^\/api\/court\/zhuangyuan\//, files: ['frontend/src/lib/contracts/dept.ts'] },
  { pattern: /^\/api\/health$/, files: ['frontend/src/lib/contracts/events.ts'] },
  { pattern: /^\/api\/chat$/, files: ['frontend/src/lib/contracts/taiyi.ts'] },
];

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function exists(relativePath) {
  try {
    await fs.access(path.join(ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

function routeKey(route) {
  return `${route.method} ${route.path}`;
}

function uniqueRoutes(inventory) {
  const routes = new Map();
  for (const call of inventory.frontendCalls || []) {
    if (!call.backendRoute) continue;
    const key = routeKey(call.backendRoute);
    if (!routes.has(key)) {
      routes.set(key, {
        key,
        method: call.backendRoute.method,
        path: call.backendRoute.path,
        domain: call.domain || 'unknown',
        backendOwner: call.backendRoute.file,
        backendTests: call.backendRoute.tests || [],
        frontendCalls: [],
        statuses: new Set(),
        aliases: new Set(),
      });
    }
    const route = routes.get(key);
    route.frontendCalls.push(`${call.file}:${call.line}`);
    route.statuses.add(call.status);
    if (call.alias?.from && call.alias?.to) {
      route.aliases.add(`${call.alias.from} -> ${call.alias.to}`);
    }
    if (route.domain === 'unknown' && call.domain && call.domain !== 'unknown') {
      route.domain = call.domain;
    }
  }
  return [...routes.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function contractFilesFor(route) {
  const files = new Set([GENERATED_CONTRACT]);
  for (const rule of CONTRACT_RULES) {
    if (rule.pattern.test(route.path)) {
      for (const file of rule.files) files.add(file);
    }
  }
  return [...files];
}

function evidenceSets(envelopeAudit, sourceAudit) {
  const envelopeReviewRequired = new Set((envelopeAudit.reviewRequired || []).map((route) => route.key));
  const sourceCovered = new Set([
    ...(sourceAudit.withEvidence || []).map((route) => route.key),
    ...(sourceAudit.exceptions || []).map((route) => route.key),
  ]);
  return { envelopeReviewRequired, sourceCovered };
}

function markdownTable(rows, columns) {
  const header = `| ${columns.map((column) => column.label).join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${columns.map((column) => String(column.value(row) ?? '').replaceAll('\n', '<br>')).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}

function renderMarkdown(report) {
  return `# All API Contract Matrix Audit

| Field | Value |
| --- | --- |
| Generated at | ${report.generatedAt} |
| Status | ${report.status} |
| Frontend calls | ${report.summary.frontendCalls} |
| Used backend routes | ${report.summary.usedBackendRoutes} |
| Complete routes | ${report.summary.completeRoutes} |
| Missing evidence | ${report.summary.missingEvidence} |

## Route Matrix

${markdownTable(report.routes, [
  { label: 'Route', value: (row) => row.key },
  { label: 'Domain', value: (row) => row.domain },
  { label: 'Status', value: (row) => row.status },
  { label: 'Backend owner', value: (row) => row.backendOwner },
  { label: 'Tests', value: (row) => row.backendTests.join('<br>') },
  { label: 'Frontend contracts', value: (row) => row.frontendContracts.join('<br>') },
  { label: 'Calls', value: (row) => row.frontendCalls.length },
])}

## Missing Evidence

${report.missingEvidence.length ? markdownTable(report.missingEvidence, [
  { label: 'Route', value: (row) => row.key },
  { label: 'Kind', value: (row) => row.kind },
  { label: 'Details', value: (row) => row.details },
]) : 'None.'}

## Policy

- This matrix covers every unique backend route reached by the current frontend API inventory.
- Generated OpenAPI TypeScript is the all-route frontend contract baseline; domain files are supplementary contract sources.
- This audit does not edit UI files and does not add frontend BFF routes.
`;
}

async function main() {
  const inventory = await readJson(INVENTORY_JSON);
  const envelopeAudit = await readJson(ENVELOPE_JSON);
  const sourceAudit = await readJson(SOURCE_JSON);
  const generatedContractExists = await exists(GENERATED_CONTRACT);
  const { envelopeReviewRequired, sourceCovered } = evidenceSets(envelopeAudit, sourceAudit);
  const routes = [];
  const missingEvidence = [];

  for (const route of uniqueRoutes(inventory)) {
    const frontendContracts = [];
    for (const file of contractFilesFor(route)) {
      const ok = await exists(file);
      frontendContracts.push(ok ? file : `${file} (missing)`);
      if (!ok) {
        missingEvidence.push({ key: route.key, kind: 'frontend-contract', details: file });
      }
    }
    const ownerExists = await exists(route.backendOwner);
    if (!ownerExists) {
      missingEvidence.push({ key: route.key, kind: 'backend-owner', details: route.backendOwner });
    }
    if (!route.backendTests.length) {
      missingEvidence.push({ key: route.key, kind: 'backend-test', details: 'No related backend test detected by inventory.' });
    }
    if (!generatedContractExists) {
      missingEvidence.push({ key: route.key, kind: 'generated-contract', details: GENERATED_CONTRACT });
    }
    if (envelopeReviewRequired.has(route.key) || envelopeAudit.summary?.reviewRequiredRoutes !== 0) {
      missingEvidence.push({ key: route.key, kind: 'response-envelope', details: 'Route is not covered by standard envelope or documented legacy exception audit.' });
    }
    if (!sourceCovered.has(route.key)) {
      missingEvidence.push({ key: route.key, kind: 'source-label', details: 'Route is not covered by source evidence or documented non-business exception audit.' });
    }

    const routeMissing = missingEvidence.filter((item) => item.key === route.key);
    routes.push({
      ...route,
      statuses: [...route.statuses],
      aliases: [...route.aliases],
      frontendContracts,
      backendOwnerExists: ownerExists,
      envelopeCovered: !envelopeReviewRequired.has(route.key) && envelopeAudit.summary?.reviewRequiredRoutes === 0,
      sourceCovered: sourceCovered.has(route.key),
      status: routeMissing.length ? 'missing_evidence' : 'complete',
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    status: missingEvidence.length ? 'needs_review' : 'pass',
    summary: {
      frontendCalls: inventory.summary?.frontendCalls || 0,
      usedBackendRoutes: routes.length,
      completeRoutes: routes.filter((route) => route.status === 'complete').length,
      missingEvidence: missingEvidence.length,
    },
    routes,
    missingEvidence,
    policy: {
      uiLayerFrozen: true,
      noNewFrontendBff: true,
      generatedContract: GENERATED_CONTRACT,
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

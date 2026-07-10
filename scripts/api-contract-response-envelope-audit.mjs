#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const INVENTORY_JSON = path.join(ROOT, 'docs', 'api-contract-inventory-2026-07-09.json');
const OUT_JSON = path.join(ROOT, 'docs', 'api-contract-response-envelope-audit-2026-07-09.json');
const OUT_MD = path.join(ROOT, 'docs', 'api-contract-response-envelope-audit-2026-07-09.md');

const LEGACY_EXCEPTION_RULES = [
  {
    pattern: /^POST \/api\/auth\//,
    category: 'auth-contract-exception',
    reason: 'Auth endpoints intentionally return token/session-oriented response shapes consumed by auth adapters.',
  },
  {
    pattern: /^GET \/api\/health$/,
    category: 'health-contract-exception',
    reason: 'Health endpoint is operational telemetry and not a page view model contract.',
  },
  {
    pattern: /^GET \/api\/runs\/stream\//,
    category: 'stream-contract-exception',
    reason: 'Runs stream endpoints expose stream/status contracts rather than the standard JSON view envelope.',
  },
];

function classifyException(routeKey) {
  return LEGACY_EXCEPTION_RULES.find((rule) => rule.pattern.test(routeKey)) || null;
}

function uniqueUsedRoutes(inventory) {
  const routes = new Map();
  for (const call of inventory.frontendCalls || []) {
    if (!call.backendRoute) continue;
    const route = call.backendRoute;
    const key = `${route.method} ${route.path}`;
    if (!routes.has(key)) {
      routes.set(key, {
        key,
        method: route.method,
        path: route.path,
        file: route.file,
        auth: route.auth,
        envelope: route.envelope || 'unknown',
        tests: route.tests || [],
        frontendCalls: [],
      });
    }
    routes.get(key).frontendCalls.push(`${call.file}:${call.line}`);
  }
  return [...routes.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function markdownTable(rows, columns) {
  const header = `| ${columns.map((column) => column.label).join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${columns.map((column) => String(column.value(row) ?? '').replaceAll('\n', '<br>')).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}

function renderMarkdown(report) {
  return `# API Response Envelope Audit

| Field | Value |
| --- | --- |
| Generated at | ${report.generatedAt} |
| Status | ${report.status} |
| Used backend routes | ${report.summary.usedBackendRoutes} |
| Standard envelope routes | ${report.summary.standardEnvelopeRoutes} |
| Legacy exception routes | ${report.summary.legacyExceptionRoutes} |
| Review required routes | ${report.summary.reviewRequiredRoutes} |

## Legacy Exceptions

${report.legacyExceptions.length ? markdownTable(report.legacyExceptions, [
  { label: 'Route', value: (row) => row.key },
  { label: 'Category', value: (row) => row.category },
  { label: 'File', value: (row) => row.file },
  { label: 'Frontend calls', value: (row) => row.frontendCalls.length },
  { label: 'Reason', value: (row) => row.reason },
]) : 'None.'}

## Review Required

${report.reviewRequired.length ? markdownTable(report.reviewRequired, [
  { label: 'Route', value: (row) => row.key },
  { label: 'Envelope', value: (row) => row.envelope },
  { label: 'File', value: (row) => row.file },
  { label: 'Frontend calls', value: (row) => row.frontendCalls.length },
]) : 'None.'}

## Policy

- Standard page/data contracts should return a parseable envelope or be adapted before reaching UI components.
- Legacy exceptions must stay documented with owner and tests; they are not permission to add frontend BFF routes.
- This audit is evidence only and does not modify UI behavior.
`;
}

async function main() {
  const inventory = JSON.parse(await fs.readFile(INVENTORY_JSON, 'utf8'));
  const routes = uniqueUsedRoutes(inventory);
  const standard = routes.filter((route) => route.envelope !== 'unknown');
  const unknown = routes.filter((route) => route.envelope === 'unknown');
  const legacyExceptions = [];
  const reviewRequired = [];

  for (const route of unknown) {
    const exception = classifyException(route.key);
    if (exception) {
      legacyExceptions.push({ ...route, category: exception.category, reason: exception.reason });
    } else {
      reviewRequired.push(route);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    status: reviewRequired.length ? 'needs_review' : legacyExceptions.length ? 'pass_with_legacy_exceptions' : 'pass',
    summary: {
      usedBackendRoutes: routes.length,
      standardEnvelopeRoutes: standard.length,
      legacyExceptionRoutes: legacyExceptions.length,
      reviewRequiredRoutes: reviewRequired.length,
    },
    legacyExceptions,
    reviewRequired,
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

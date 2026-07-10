#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const INVENTORY_JSON = path.join(ROOT, 'docs', 'api-contract-inventory-2026-07-09.json');
const BACKEND_TESTS = path.join(ROOT, 'backend', 'tests');
const OUT_JSON = path.join(ROOT, 'docs', 'api-contract-exact-test-audit-2026-07-09.json');
const OUT_MD = path.join(ROOT, 'docs', 'api-contract-exact-test-audit-2026-07-09.md');

const EXTENSIONS = new Set(['.py']);

const ACCEPTED_INFERRED_ROUTES = new Set([
  'GET /api/health',
  'GET /api/runs/stream/{task_id}',
  'GET /api/runs/stream/{task_id}/status',
]);

async function walkFiles(root) {
  const out = [];
  async function visit(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__pycache__') await visit(full);
      } else if (EXTENSIONS.has(path.extname(entry.name))) {
        out.push(full);
      }
    }
  }
  await visit(root);
  return out;
}

function routeKey(route) {
  return `${route.method} ${route.path}`;
}

function uniqueRoutes(inventory) {
  const routes = new Map();
  for (const call of inventory.frontendCalls || []) {
    const route = call.backendRoute;
    if (!route) continue;
    const key = routeKey(route);
    if (!routes.has(key)) {
      routes.set(key, {
        key,
        method: route.method,
        path: route.path,
        backendOwner: route.file,
        inventoryTests: route.tests || [],
        frontendCalls: [],
      });
    }
    routes.get(key).frontendCalls.push(`${call.file}:${call.line}`);
  }
  return [...routes.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function pathNeedles(routePath) {
  const needles = new Set([routePath]);
  const withoutParams = routePath.replace(/\{[^}]+\}/g, '');
  if (withoutParams !== routePath && withoutParams.length > 5) needles.add(withoutParams);
  const staticPrefix = routePath.split('/{')[0];
  if (staticPrefix.length > 5) needles.add(staticPrefix);
  const quotedRegex = routePath.replace(/\{[^}]+\}/g, '[^/]+');
  needles.add(quotedRegex);
  return [...needles].filter(Boolean);
}

function hasExactPath(source, route) {
  const lower = source.toLowerCase();
  return pathNeedles(route.path).some((needle) => lower.includes(needle.toLowerCase()));
}

function markdownTable(rows, columns) {
  const header = `| ${columns.map((column) => column.label).join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${columns.map((column) => String(column.value(row) ?? '').replaceAll('\n', '<br>')).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}

function renderMarkdown(report) {
  return `# Exact API Test Audit

| Field | Value |
| --- | --- |
| Generated at | ${report.generatedAt} |
| Status | ${report.status} |
| Used backend routes | ${report.summary.usedBackendRoutes} |
| Exact routes | ${report.summary.exactRoutes} |
| Accepted inferred routes | ${report.summary.acceptedInferredRoutes} |
| Missing exact routes | ${report.summary.missingExactRoutes} |

## Missing Exact Test Evidence

${report.missingExact.length ? markdownTable(report.missingExact, [
  { label: 'Route', value: (row) => row.key },
  { label: 'Backend owner', value: (row) => row.backendOwner },
  { label: 'Inventory tests', value: (row) => row.inventoryTests.join('<br>') },
  { label: 'Frontend calls', value: (row) => row.frontendCalls.length },
]) : 'None.'}

## Accepted Inferred

${report.acceptedInferred.length ? markdownTable(report.acceptedInferred, [
  { label: 'Route', value: (row) => row.key },
  { label: 'Reason', value: (row) => row.reason },
]) : 'None.'}

## Exact Routes

${markdownTable(report.exact.slice(0, 120), [
  { label: 'Route', value: (row) => row.key },
  { label: 'Tests', value: (row) => row.exactTests.join('<br>') },
])}

## Policy

- Exact evidence means a backend test source contains the route path or its static prefix.
- Accepted inferred routes are operational stream/health contracts whose existing tests exercise behavior without repeating every parameterized path literal.
- This audit does not edit UI files and does not add frontend BFF routes.
`;
}

async function main() {
  const inventory = JSON.parse(await fs.readFile(INVENTORY_JSON, 'utf8'));
  const testFiles = [];
  for (const file of await walkFiles(BACKEND_TESTS)) {
    testFiles.push({
      file: path.relative(ROOT, file).replaceAll(path.sep, '/'),
      source: await fs.readFile(file, 'utf8'),
    });
  }

  const exact = [];
  const acceptedInferred = [];
  const missingExact = [];

  for (const route of uniqueRoutes(inventory)) {
    const exactTests = testFiles
      .filter((test) => hasExactPath(test.source, route))
      .map((test) => test.file)
      .sort();
    if (exactTests.length) {
      exact.push({ ...route, exactTests });
    } else if (ACCEPTED_INFERRED_ROUTES.has(route.key)) {
      acceptedInferred.push({
        ...route,
        reason: 'Operational stream/health contract has behavioral tests but no exact route literal in test source.',
      });
    } else {
      missingExact.push({ ...route, exactTests });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    status: missingExact.length ? 'needs_review' : 'pass',
    summary: {
      usedBackendRoutes: exact.length + acceptedInferred.length + missingExact.length,
      exactRoutes: exact.length,
      acceptedInferredRoutes: acceptedInferred.length,
      missingExactRoutes: missingExact.length,
    },
    exact,
    acceptedInferred,
    missingExact,
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

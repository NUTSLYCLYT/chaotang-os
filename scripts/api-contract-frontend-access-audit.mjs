#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'frontend', 'src');
const OUT_JSON = path.join(ROOT, 'docs', 'api-contract-frontend-access-audit-2026-07-09.json');
const OUT_MD = path.join(ROOT, 'docs', 'api-contract-frontend-access-audit-2026-07-09.md');

const CALL_PATTERN =
  /\b(backendFetch|fetchLocalCourtApi|jiqunPost|fetchWithBasePath|fetch)\s*\(\s*([`'"])([^`'"]*\/api\/[^`'"]*)\2/g;

const ALLOWED_PREFIXES = [
  'frontend/src/lib/backend-api.ts',
  'frontend/src/lib/jiqun-api.ts',
  'frontend/src/lib/api/',
  'frontend/src/features/command-center/junjichu/api/',
  'frontend/src/lib/contracts/backend-openapi-2026-07-09.d.ts',
];

const REVIEW_PREFIXES = [
  'frontend/src/app/',
  'frontend/src/components/',
  'frontend/src/features/',
];

async function walk(dir, files = [], inaccessible = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    inaccessible.push({ path: path.relative(ROOT, dir).replaceAll('\\', '/'), error: error.code || String(error) });
    return { files, inaccessible };
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      await walk(full, files, inaccessible);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return { files, inaccessible };
}

function rel(file) {
  return path.relative(ROOT, file).replaceAll('\\', '/');
}

function layerOf(file) {
  if (file.includes('/src/app/')) return 'app';
  if (file.includes('/src/components/')) return 'shared-component';
  if (file.includes('/components/')) return 'feature-component';
  if (file.includes('/hooks/')) return 'hook';
  if (file.includes('/views/')) return 'view';
  if (file.includes('/api/')) return 'api-client';
  if (file.includes('/lib/api/')) return 'api-client';
  if (file.includes('/lib/')) return 'lib';
  return 'other';
}

function isAllowed(file) {
  return ALLOWED_PREFIXES.some((prefix) => file === prefix || file.startsWith(prefix));
}

function needsReview(file) {
  return REVIEW_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function lineNumber(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function markdownTable(rows, columns) {
  const header = `| ${columns.map((column) => column.label).join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${columns.map((column) => String(column.value(row) ?? '').replaceAll('\n', '<br>')).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}

function renderMarkdown(report) {
  return `# Frontend API Access Convergence Audit

| Field | Value |
| --- | --- |
| Generated at | ${report.generatedAt} |
| Status | ${report.status} |
| Files scanned | ${report.summary.filesScanned} |
| API call sites | ${report.summary.callSites} |
| Allowed transport/client calls | ${report.summary.allowedCallSites} |
| Review required call sites | ${report.summary.reviewRequiredCallSites} |
| Inaccessible paths | ${report.summary.inaccessiblePaths} |

## Calls By Layer

${markdownTable(report.byLayer, [
  { label: 'Layer', value: (row) => row.layer },
  { label: 'Calls', value: (row) => row.count },
])}

## Review Required

${report.reviewRequired.length ? markdownTable(report.reviewRequired, [
  { label: 'File', value: (row) => row.file },
  { label: 'Line', value: (row) => row.line },
  { label: 'Layer', value: (row) => row.layer },
  { label: 'Callee', value: (row) => row.callee },
  { label: 'Path', value: (row) => row.path },
  { label: 'Reason', value: (row) => row.reason },
]) : 'None.'}

## Inaccessible Paths

${report.inaccessible.length ? markdownTable(report.inaccessible, [
  { label: 'Path', value: (row) => row.path },
  { label: 'Error', value: (row) => row.error },
]) : 'None.'}

## Policy

- UI files must not gain new direct API calls during this implementation line.
- Existing direct calls listed here need migration to business clients/adapters after the UI workspace issue is resolved.
- This audit does not authorize editing UI layer files and does not add a frontend BFF.
`;
}

async function main() {
  const { files, inaccessible } = await walk(SRC);
  const callSites = [];
  for (const file of files) {
    const relative = rel(file);
    const text = await fs.readFile(file, 'utf8');
    for (const match of text.matchAll(CALL_PATTERN)) {
      const callee = match[1];
      const apiPath = match[3];
      const layer = layerOf(relative);
      const allowed = isAllowed(relative);
      const review = !allowed && needsReview(relative);
      callSites.push({
        file: relative,
        line: lineNumber(text, match.index || 0),
        layer,
        callee,
        path: apiPath,
        allowed,
        reviewRequired: review,
        reason: review ? 'API call is outside the transport/client allowlist.' : '',
      });
    }
  }

  const byLayerMap = new Map();
  for (const site of callSites) byLayerMap.set(site.layer, (byLayerMap.get(site.layer) || 0) + 1);
  const byLayer = [...byLayerMap.entries()]
    .map(([layer, count]) => ({ layer, count }))
    .sort((left, right) => left.layer.localeCompare(right.layer));
  const reviewRequired = callSites.filter((site) => site.reviewRequired);
  const report = {
    generatedAt: new Date().toISOString(),
    status: reviewRequired.length ? 'needs_migration' : 'pass',
    summary: {
      filesScanned: files.length,
      callSites: callSites.length,
      allowedCallSites: callSites.filter((site) => site.allowed).length,
      reviewRequiredCallSites: reviewRequired.length,
      inaccessiblePaths: inaccessible.length,
    },
    byLayer,
    reviewRequired,
    inaccessible,
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

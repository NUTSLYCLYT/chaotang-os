#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const INVENTORY_JSON = path.join(ROOT, 'docs', 'api-contract-inventory-2026-07-09.json');
const OUT_JSON = path.join(ROOT, 'docs', 'api-contract-source-label-audit-2026-07-09.json');
const OUT_MD = path.join(ROOT, 'docs', 'api-contract-source-label-audit-2026-07-09.md');

const EXCEPTION_RULES = [
  { pattern: /^POST \/api\/auth\//, category: 'auth', reason: 'Auth responses prove session state, not runtime facts.' },
  { pattern: /^GET \/api\/health$/, category: 'health', reason: 'Health telemetry is operational status, not page business data.' },
  { pattern: /^GET \/api\/runs\/stream\//, category: 'stream', reason: 'Stream/progress contracts use event/status semantics.' },
  { pattern: /^[A-Z]+ \/api\/court\/decision-judgment$/, category: 'feedback-telemetry', reason: 'Decision judgment endpoints record and summarize user feedback, not runtime business facts.' },
  { pattern: /^POST \/api\/metrics$/, category: 'telemetry-ingest', reason: 'Browser metrics ingestion does not return business facts.' },
];

const SOURCE_PATTERN = /\b(sourceLabel|source_label|source_mode|sourceMode)\b|["']source["']\s*:/;
const SOURCE_VALUE_PATTERN = /\b(LIVE_SWARM|LIVE|MIXED|FALLBACK|DEMO)\b/;

function routeKey(route) {
  return `${route.method} ${route.path}`;
}

function exceptionFor(key) {
  return EXCEPTION_RULES.find((rule) => rule.pattern.test(key)) || null;
}

function uniqueUsedRoutes(inventory) {
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
        file: route.file,
        line: route.line,
        frontendCalls: [],
      });
    }
    routes.get(key).frontendCalls.push(`${call.file}:${call.line}`);
  }
  return [...routes.values()].sort((left, right) => left.key.localeCompare(right.key));
}

async function routeBlock(route) {
  const file = path.join(ROOT, route.file);
  const text = await fs.readFile(file, 'utf8');
  const lines = text.split(/\r?\n/);
  let start = Math.max(0, Number(route.line || 1) - 1);
  let found = false;
  for (let i = start; i < Math.min(lines.length, start + 5); i += 1) {
    if (/^@router\.(get|post|put|patch|delete)\s*\(/.test(lines[i])) {
      start = i;
      found = true;
      break;
    }
  }
  for (let i = start; !found && i >= 0; i -= 1) {
    if (/^@router\.(get|post|put|patch|delete)\s*\(/.test(lines[i])) {
      start = i;
      found = true;
      break;
    }
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^@router\.(get|post|put|patch|delete)\s*\(/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

function markdownTable(rows, columns) {
  const header = `| ${columns.map((column) => column.label).join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${columns.map((column) => String(column.value(row) ?? '').replaceAll('\n', '<br>')).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}

function renderMarkdown(report) {
  return `# API Source Label Audit

| Field | Value |
| --- | --- |
| Generated at | ${report.generatedAt} |
| Status | ${report.status} |
| Used backend routes | ${report.summary.usedBackendRoutes} |
| Routes with source evidence | ${report.summary.routesWithSourceEvidence} |
| Legacy/non-business exceptions | ${report.summary.exceptionRoutes} |
| Review required routes | ${report.summary.reviewRequiredRoutes} |

## Review Required

${report.reviewRequired.length ? markdownTable(report.reviewRequired, [
  { label: 'Route', value: (row) => row.key },
  { label: 'File', value: (row) => `${row.file}:${row.line}` },
  { label: 'Frontend calls', value: (row) => row.frontendCalls.length },
  { label: 'Reason', value: (row) => row.reason },
]) : 'None.'}

## Exceptions

${report.exceptions.length ? markdownTable(report.exceptions, [
  { label: 'Route', value: (row) => row.key },
  { label: 'Category', value: (row) => row.category },
  { label: 'Reason', value: (row) => row.reason },
]) : 'None.'}

## Policy

- Runtime or business fact routes must expose source evidence through sourceLabel/source_label/source_mode/source fields or an adapter-owned equivalent.
- Auth, health, metrics ingestion and stream status routes may be documented exceptions.
- This audit does not change UI files and does not add frontend BFF routes.
`;
}

async function main() {
  const inventory = JSON.parse(await fs.readFile(INVENTORY_JSON, 'utf8'));
  const routes = uniqueUsedRoutes(inventory);
  const withEvidence = [];
  const exceptions = [];
  const reviewRequired = [];

  for (const route of routes) {
    const exception = exceptionFor(route.key);
    if (exception) {
      exceptions.push({ ...route, category: exception.category, reason: exception.reason });
      continue;
    }
    const block = await routeBlock(route);
    const hasSourceField = SOURCE_PATTERN.test(block);
    const hasSourceValue = SOURCE_VALUE_PATTERN.test(block);
    if (hasSourceField || hasSourceValue) {
      withEvidence.push({
        ...route,
        sourceField: hasSourceField,
        sourceValue: hasSourceValue,
      });
    } else {
      reviewRequired.push({
        ...route,
        reason: 'No sourceLabel/source_label/source_mode/source evidence found in the backend route block.',
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    status: reviewRequired.length ? 'needs_review' : 'pass',
    summary: {
      usedBackendRoutes: routes.length,
      routesWithSourceEvidence: withEvidence.length,
      exceptionRoutes: exceptions.length,
      reviewRequiredRoutes: reviewRequired.length,
    },
    withEvidence,
    exceptions,
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

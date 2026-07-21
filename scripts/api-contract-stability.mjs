#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATE = '2026-07-21';
const OUT_OPENAPI = path.join(ROOT, 'docs', `api-contract-openapi-${DATE}.json`);
const OUT_ROUTE_SNAPSHOT = path.join(ROOT, 'docs', `api-contract-route-snapshot-${DATE}.json`);
const OUT_TYPES = path.join(ROOT, 'frontend', 'src', 'lib', 'contracts', `backend-openapi-${DATE}.d.ts`);
const OUT_REPORT_JSON = path.join(ROOT, 'docs', `api-contract-stability-report-${DATE}.json`);
const OUT_REPORT_MD = path.join(ROOT, 'docs', `api-contract-stability-report-${DATE}.md`);

function normalizeMethod(method) {
  return method.toUpperCase();
}

function stableJson(value) {
  return `${JSON.stringify(sortObject(value), null, 2)}\n`;
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, sortObject(nested)])
  );
}

function exportOpenApi() {
  const code = [
    'import json',
    'import os',
    'os.environ.setdefault("FENGQUN_ENABLE_DOCS", "true")',
    'from web.main import app',
    'print(json.dumps(app.openapi(), ensure_ascii=False, sort_keys=True))',
  ].join('\n');
  const spawnOptions = {
    cwd: path.join(ROOT, 'backend'),
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    env: { ...process.env, FENGQUN_ENABLE_DOCS: 'true', PYTHONIOENCODING: 'utf-8' },
  };
  // 'python' isn't guaranteed on PATH (e.g. Ubuntu/WSL ship only 'python3'); try both so this
  // script works across the project's documented Windows + Ubuntu environments.
  let result = spawnSync('python3', ['-c', code], spawnOptions);
  if (result.error && result.error.code === 'ENOENT') {
    result = spawnSync('python', ['-c', code], spawnOptions);
  }
  if (result.status !== 0) {
    throw new Error(`OpenAPI export failed:\n${result.stderr || result.stdout || result.error}`);
  }
  return JSON.parse(result.stdout);
}

function schemaKind(schema) {
  if (!schema) return 'unknown';
  if (schema.$ref) return schema.$ref;
  if (schema.type) return schema.type;
  if (schema.anyOf) return `anyOf:${schema.anyOf.map(schemaKind).join('|')}`;
  if (schema.oneOf) return `oneOf:${schema.oneOf.map(schemaKind).join('|')}`;
  if (schema.allOf) return `allOf:${schema.allOf.map(schemaKind).join('|')}`;
  return 'object';
}

function responseSignature(operation) {
  const responses = operation.responses || {};
  return Object.fromEntries(
    Object.entries(responses)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([status, response]) => {
        const content = response?.content || {};
        const json = content['application/json'] || content['text/event-stream'] || Object.values(content)[0];
        return [status, schemaKind(json?.schema)];
      })
  );
}

function buildRouteSnapshot(openapi) {
  const routes = [];
  for (const [routePath, methods] of Object.entries(openapi.paths || {})) {
    for (const [method, operation] of Object.entries(methods || {})) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      routes.push({
        key: `${normalizeMethod(method)} ${routePath}`,
        method: normalizeMethod(method),
        path: routePath,
        operationId: operation.operationId || null,
        tags: operation.tags || [],
        requestBody: schemaKind(operation.requestBody?.content?.['application/json']?.schema),
        responses: responseSignature(operation),
      });
    }
  }
  routes.sort((left, right) => left.key.localeCompare(right.key));
  return {
    generatedAt: DATE,
    routeCount: routes.length,
    routes,
  };
}

function compareSnapshots(previous, current) {
  if (!previous) {
    return {
      mode: 'baseline_created',
      breaking: [],
      warnings: ['No previous route snapshot was found; current snapshot is the baseline for future diffs.'],
    };
  }
  const previousRoutes = new Map((previous.routes || []).map((route) => [route.key, route]));
  const currentRoutes = new Map((current.routes || []).map((route) => [route.key, route]));
  const breaking = [];
  const warnings = [];

  for (const [key, route] of previousRoutes) {
    const next = currentRoutes.get(key);
    if (!next) {
      breaking.push({ type: 'route_removed', key, previous: route });
      continue;
    }
    for (const [status, signature] of Object.entries(route.responses || {})) {
      if (!(status in (next.responses || {}))) {
        breaking.push({ type: 'response_status_removed', key, status });
      } else if (next.responses[status] !== signature) {
        breaking.push({
          type: 'response_schema_changed',
          key,
          status,
          previous: signature,
          current: next.responses[status],
        });
      }
    }
  }

  for (const [key] of currentRoutes) {
    if (!previousRoutes.has(key)) warnings.push({ type: 'route_added', key });
  }

  return { mode: 'diff_checked', breaking, warnings };
}

function tsTypeName(name) {
  return name.replace(/[^A-Za-z0-9_$]/g, '_').replace(/^(\d)/, '_$1');
}

function refName(ref) {
  return tsTypeName(ref.split('/').pop() || 'unknown');
}

function schemaToTs(schema) {
  if (!schema) return 'unknown';
  if (schema.$ref) return refName(schema.$ref);
  if (schema.anyOf) return schema.anyOf.map(schemaToTs).join(' | ');
  if (schema.oneOf) return schema.oneOf.map(schemaToTs).join(' | ');
  if (schema.allOf) return schema.allOf.map(schemaToTs).join(' & ');
  if (schema.enum) return schema.enum.map((item) => JSON.stringify(item)).join(' | ');
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (schema.type === 'array') return `${schemaToTs(schema.items)}[]`;
  if (schema.type === 'integer' || schema.type === 'number') return 'number';
  if (schema.type === 'string') return 'string';
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'null') return 'null';
  if (schema.type === 'object' || schema.properties || schema.additionalProperties) {
    const required = new Set(schema.required || []);
    const lines = Object.entries(schema.properties || {}).map(([key, child]) => {
      const optional = required.has(key) ? '' : '?';
      return `  ${JSON.stringify(key)}${optional}: ${schemaToTs(child)};`;
    });
    if (schema.additionalProperties && schema.additionalProperties !== true) {
      lines.push(`  [key: string]: ${schemaToTs(schema.additionalProperties)};`);
    } else if (schema.additionalProperties === true) {
      lines.push('  [key: string]: unknown;');
    }
    return lines.length ? `{\n${lines.join('\n')}\n}` : 'Record<string, unknown>';
  }
  return 'unknown';
}

function renderTypes(openapi, routeSnapshot) {
  const schemas = openapi.components?.schemas || {};
  const schemaLines = Object.entries(schemas)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, schema]) => `export type ${tsTypeName(name)} = ${schemaToTs(schema)};\n`);
  const routeLines = routeSnapshot.routes.map((route) => {
    const request = route.requestBody === 'unknown' ? 'unknown' : JSON.stringify(route.requestBody);
    return `  ${JSON.stringify(route.key)}: { method: ${JSON.stringify(route.method)}; path: ${JSON.stringify(route.path)}; requestBody: ${request}; responses: ${JSON.stringify(route.responses)} };`;
  });
  return [
    '// Generated by scripts/api-contract-stability.mjs.',
    '// Do not edit by hand. Regenerate after backend contract changes.',
    '',
    ...schemaLines,
    'export interface BackendApiRoutes {',
    ...routeLines,
    '}',
    '',
  ].join('\n');
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function markdownTable(rows, columns) {
  const header = `| ${columns.map((column) => column.label).join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${columns.map((column) => String(column.value(row) ?? '')).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}

function renderMarkdown(report) {
  return `# API Contract Stability Report

| Field | Value |
| --- | --- |
| Generated at | ${report.generatedAt} |
| Status | ${report.status} |
| Diff mode | ${report.diff.mode} |
| Route count | ${report.routeCount} |
| Breaking changes | ${report.diff.breaking.length} |
| Warnings | ${report.diff.warnings.length} |

## Artifacts

- \`docs/api-contract-openapi-${DATE}.json\`
- \`docs/api-contract-route-snapshot-${DATE}.json\`
- \`frontend/src/lib/contracts/backend-openapi-${DATE}.d.ts\`

## Breaking Changes

${report.diff.breaking.length ? markdownTable(report.diff.breaking, [
  { label: 'Type', value: (row) => row.type },
  { label: 'Key', value: (row) => row.key },
  { label: 'Status', value: (row) => row.status || '' },
]) : 'None.'}

## Warnings

${report.diff.warnings.length ? markdownTable(report.diff.warnings, [
  { label: 'Type', value: (row) => row.type || 'warning' },
  { label: 'Key', value: (row) => row.key || row },
]) : 'None.'}

## CI Policy

- Run \`node scripts/api-contract-stability.mjs\` after backend route or response model changes.
- A removed route, removed response status, or changed response schema signature is reported as breaking.
- The generated TypeScript declaration is a contract snapshot for frontend adapters; it is not UI code and must not be used to add a frontend BFF.
`;
}

async function main() {
  const previous = await readJsonIfExists(OUT_ROUTE_SNAPSHOT);
  const openapi = sortObject(exportOpenApi());
  const routeSnapshot = buildRouteSnapshot(openapi);
  const diff = compareSnapshots(previous, routeSnapshot);
  const report = {
    generatedAt: DATE,
    status: diff.breaking.length ? 'fail' : 'pass',
    routeCount: routeSnapshot.routeCount,
    artifacts: {
      openapi: path.relative(ROOT, OUT_OPENAPI),
      routeSnapshot: path.relative(ROOT, OUT_ROUTE_SNAPSHOT),
      tsTypes: path.relative(ROOT, OUT_TYPES),
    },
    diff,
  };

  await fs.mkdir(path.dirname(OUT_TYPES), { recursive: true });
  await fs.writeFile(OUT_OPENAPI, stableJson(openapi), 'utf8');
  await fs.writeFile(OUT_ROUTE_SNAPSHOT, `${JSON.stringify(routeSnapshot, null, 2)}\n`, 'utf8');
  await fs.writeFile(OUT_TYPES, renderTypes(openapi, routeSnapshot), 'utf8');
  await fs.writeFile(OUT_REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.writeFile(OUT_REPORT_MD, renderMarkdown(report), 'utf8');

  console.log(`Wrote ${path.relative(ROOT, OUT_OPENAPI)}`);
  console.log(`Wrote ${path.relative(ROOT, OUT_ROUTE_SNAPSHOT)}`);
  console.log(`Wrote ${path.relative(ROOT, OUT_TYPES)}`);
  console.log(`Wrote ${path.relative(ROOT, OUT_REPORT_JSON)}`);
  console.log(`Wrote ${path.relative(ROOT, OUT_REPORT_MD)}`);
  console.log(JSON.stringify({ status: report.status, routeCount: report.routeCount, diff: report.diff.mode }, null, 2));
  if (report.status !== 'pass') process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

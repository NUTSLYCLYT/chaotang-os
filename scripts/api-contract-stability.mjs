#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const DATE = '2026-07-21';
export const DEFAULT_BASE_REF = 'ed822255a452e8dd8dda8f86a180fd7c099b181e';
if (
  process.env.API_CONTRACT_BASE_REF
  && process.env.API_CONTRACT_BASE_REF !== DEFAULT_BASE_REF
) {
  throw new Error(
    `API_CONTRACT_BASE_REF cannot repin fixed baseline ${DEFAULT_BASE_REF}`,
  );
}
const BASE_REF = DEFAULT_BASE_REF;
if (!/^[0-9a-f]{40}$/.test(BASE_REF)) {
  throw new Error('API_CONTRACT_BASE_REF must be an exact 40-character commit SHA');
}
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

function exportOpenApi(projectRoot = ROOT, runtimeRoot = null) {
  const code = [
    'import json',
    'import os',
    'os.environ.setdefault("FENGQUN_ENABLE_DOCS", "true")',
    'from web.main import app',
    'print(json.dumps(app.openapi(), ensure_ascii=False, sort_keys=True))',
  ].join('\n');
  const spawnOptions = {
    cwd: path.join(projectRoot, 'backend'),
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    env: {
      ...process.env,
      DB_URL: 'sqlite://',
      FENGQUN_ENABLE_DOCS: 'true',
      FENGQUN_OUTBOX_POLLER: 'false',
      FENGQUN_SCHEMA_MODE: 'test',
      PYTHONIOENCODING: 'utf-8',
      ...(runtimeRoot
        ? {
            FENGQUN_DB_PATH: path.join(runtimeRoot, 'data', 'fengqun.db'),
            FENGQUN_RUNTIME_ROOT: runtimeRoot,
          }
        : {}),
    },
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

async function exportOpenApiAtRef(ref) {
  const tempRoot = await fs.mkdtemp(
    path.join(tmpdir(), 'chaotang-api-contract-base-'),
  );
  const sourceRoot = path.join(tempRoot, 'source');
  const archivePath = path.join(tempRoot, 'source.tar');
  const runtimeRoot = path.join(tempRoot, 'runtime');
  try {
    await fs.mkdir(sourceRoot, { recursive: true });
    await fs.mkdir(path.join(runtimeRoot, 'data'), { recursive: true });
    const archive = spawnSync(
      'git',
      ['archive', '--format=tar', '--output', archivePath, ref],
      { cwd: ROOT, encoding: 'utf8' },
    );
    if (archive.status !== 0) {
      throw new Error(
        `OpenAPI baseline archive failed for ${ref}:\n`
        + (archive.stderr || archive.stdout || archive.error),
      );
    }
    const extract = spawnSync(
      'tar',
      ['-xf', archivePath, '-C', sourceRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    if (extract.status !== 0) {
      throw new Error(
        `OpenAPI baseline extraction failed for ${ref}:\n`
        + (extract.stderr || extract.stdout || extract.error),
      );
    }
    return sortObject(exportOpenApi(sourceRoot, runtimeRoot));
  } finally {
    await fs.rm(tempRoot, { force: true, recursive: true });
  }
}

function schemaKind(schema) {
  if (!schema) return 'unknown';
  if (schema.$ref) return schema.$ref;
  return `inline:${JSON.stringify(sortObject(schema))}`;
}

function responseSignature(operation) {
  const responses = operation.responses || {};
  return Object.fromEntries(
    Object.entries(responses)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([status, response]) => {
        if (response?.$ref) return [status, schemaKind(response)];
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

function additiveOptionalProperties(previousSchema, currentSchema) {
  const previousProperties = previousSchema?.properties;
  const currentProperties = currentSchema?.properties;
  if (
    !previousProperties
    || !currentProperties
    || typeof previousProperties !== 'object'
    || typeof currentProperties !== 'object'
  ) {
    return null;
  }
  const previousKeys = new Set(Object.keys(previousProperties));
  const added = Object.keys(currentProperties)
    .filter((key) => !previousKeys.has(key))
    .sort();
  if (!added.length) return null;
  const currentRequired = new Set(currentSchema.required || []);
  if (added.some((key) => currentRequired.has(key))) return null;

  const normalizedCurrent = structuredClone(currentSchema);
  for (const key of added) delete normalizedCurrent.properties[key];
  return JSON.stringify(sortObject(previousSchema))
    === JSON.stringify(sortObject(normalizedCurrent))
    ? added
    : null;
}

function decodeJsonPointerSegment(value) {
  return value.replaceAll('~1', '/').replaceAll('~0', '~');
}

function resolveLocalRef(openapi, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) return null;
  let current = openapi;
  for (const segment of ref.slice(2).split('/').map(decodeJsonPointerSegment)) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return null;
    }
    current = current[segment];
  }
  return current;
}

function responseReachableComponents(openapi) {
  const reachable = new Set();
  const visitedRefs = new Set();

  function visit(value) {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== 'object') return;

    const ref = value.$ref;
    if (typeof ref === 'string') {
      if (ref.startsWith('#/components/schemas/')) {
        reachable.add(
          decodeJsonPointerSegment(
            ref.slice('#/components/schemas/'.length),
          ),
        );
      }
      if (!visitedRefs.has(ref)) {
        visitedRefs.add(ref);
        visit(resolveLocalRef(openapi, ref));
      }
    }
    for (const [key, nested] of Object.entries(value)) {
      if (key !== '$ref') visit(nested);
    }
  }

  for (const methods of Object.values(openapi.paths || {})) {
    for (const operation of Object.values(methods || {})) {
      if (!operation || typeof operation !== 'object') continue;
      visit(operation.responses || {});
    }
  }
  return reachable;
}

export function compareContracts(previousOpenApi, currentOpenApi) {
  const previousSnapshot = buildRouteSnapshot(previousOpenApi);
  const currentSnapshot = buildRouteSnapshot(currentOpenApi);
  const routeDiff = compareSnapshots(previousSnapshot, currentSnapshot);
  const breaking = [...routeDiff.breaking];
  const warnings = [...routeDiff.warnings];
  const previousSchemas = previousOpenApi.components?.schemas || {};
  const currentSchemas = currentOpenApi.components?.schemas || {};
  const previousResponses = previousOpenApi.components?.responses || {};
  const currentResponses = currentOpenApi.components?.responses || {};
  const previousResponseComponents = responseReachableComponents(previousOpenApi);

  for (const [name, schema] of Object.entries(previousSchemas)) {
    if (!(name in currentSchemas)) {
      breaking.push({
        type: 'component_schema_removed',
        key: name,
      });
    } else if (
      JSON.stringify(sortObject(schema))
      !== JSON.stringify(sortObject(currentSchemas[name]))
    ) {
      const added = additiveOptionalProperties(
        schema,
        currentSchemas[name],
      );
      if (added && !previousResponseComponents.has(name)) {
        warnings.push({
          type: 'component_optional_properties_added',
          key: name,
          properties: added,
        });
      } else {
        breaking.push({
          type: 'component_schema_changed',
          key: name,
        });
      }
    }
  }
  for (const name of Object.keys(currentSchemas).sort()) {
    if (!(name in previousSchemas)) {
      warnings.push({
        type: 'component_schema_added',
        key: name,
      });
    }
  }
  for (const [name, response] of Object.entries(previousResponses).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    if (!(name in currentResponses)) {
      breaking.push({
        type: 'component_response_removed',
        key: name,
      });
    } else if (
      JSON.stringify(sortObject(response))
      !== JSON.stringify(sortObject(currentResponses[name]))
    ) {
      breaking.push({
        type: 'component_response_changed',
        key: name,
      });
    }
  }
  for (const name of Object.keys(currentResponses).sort()) {
    if (!(name in previousResponses)) {
      warnings.push({
        type: 'component_response_added',
        key: name,
      });
    }
  }
  return {
    mode: 'fixed_ref_diff',
    breaking,
    warnings,
  };
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
  if (schema.type === 'array') return `(${schemaToTs(schema.items)})[]`;
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
| Baseline ref | ${report.baseline.ref} |
| Baseline source | ${report.baseline.source} |
| Baseline routes | ${report.baseline.routeCount} |
| Baseline schemas | ${report.baseline.schemaCount} |
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
- The baseline is generated from immutable Git ref \`${report.baseline.ref}\`; generated outputs are never reused as their own baseline.
- A removed route, removed response status, changed response schema signature, or changed/removed component schema is reported as breaking.
- The generated TypeScript declaration is a contract snapshot for frontend adapters; it is not UI code and must not be used to add a frontend BFF.
`;
}

async function main() {
  const openapi = sortObject(exportOpenApi());
  const baselineOpenApi = await exportOpenApiAtRef(BASE_REF);
  const routeSnapshot = buildRouteSnapshot(openapi);
  const baselineRouteSnapshot = buildRouteSnapshot(baselineOpenApi);
  const diff = compareContracts(baselineOpenApi, openapi);
  const report = {
    generatedAt: DATE,
    status: diff.breaking.length ? 'fail' : 'pass',
    routeCount: routeSnapshot.routeCount,
    baseline: {
      ref: BASE_REF,
      source: 'git_archive_generated_openapi',
      routeCount: baselineRouteSnapshot.routeCount,
      schemaCount: Object.keys(
        baselineOpenApi.components?.schemas || {},
      ).length,
    },
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

const invokedUrl = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;
if (import.meta.url === invokedUrl) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

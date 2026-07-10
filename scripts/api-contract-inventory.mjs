#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FRONTEND_SRC = path.join(ROOT, 'frontend', 'src');
const BACKEND_ROUTERS = path.join(ROOT, 'backend', 'web', 'routers');
const BACKEND_TESTS = path.join(ROOT, 'backend', 'tests');
const OUT_JSON = path.join(ROOT, 'docs', 'api-contract-inventory-2026-07-09.json');
const OUT_MD = path.join(ROOT, 'docs', 'api-contract-inventory-2026-07-09.md');

const FRONTEND_EXTENSIONS = new Set(['.ts', '.tsx']);
const BACKEND_EXTENSIONS = new Set(['.py']);

const API_CALL_PATTERNS = [
  { name: 'backendFetch', regex: /\bbackendFetch\s*\(\s*([`'"])([\s\S]*?)\1/g },
  { name: 'backendJson', regex: /\bbackendJson\s*<[^>]*>\s*\(\s*([`'"])([\s\S]*?)\1/g },
  { name: 'backendJson', regex: /\bbackendJson\s*\(\s*([`'"])([\s\S]*?)\1/g },
  { name: 'fetchLocalCourtApi', regex: /\bfetchLocalCourtApi\s*\(\s*([`'"])([\s\S]*?)\1/g },
  { name: 'jiqunPost', regex: /\bjiqunPost\s*<[^>]*>\s*\(\s*([`'"])([\s\S]*?)\1/g },
  { name: 'jiqunPost', regex: /\bjiqunPost\s*\(\s*([`'"])([\s\S]*?)\1/g },
  { name: 'jiqunFetcher', regex: /\bjiqunFetcher\s*<[^>]*>\s*\(\s*([`'"])([\s\S]*?)\1/g },
  { name: 'jiqunFetcher', regex: /\bjiqunFetcher\s*\(\s*([`'"])([\s\S]*?)\1/g },
  { name: 'fetch', regex: /\bfetch\s*\(\s*([`'"])([\s\S]*?)\1/g },
  { name: 'fetchWithBasePath', regex: /\bfetch\s*\(\s*withBasePath\s*\(\s*([`'"])([\s\S]*?)\1/g },
  { name: 'EventSource', regex: /\bnew\s+EventSource\s*\(\s*backendProxyUrl\s*\(\s*([`'"])([\s\S]*?)\1/g },
];

const ROUTE_DECORATOR = /@router\.(get|post|put|delete|patch)\s*\(\s*([rubfRUBF]*)([`'"])(.*?)\3/g;

const DOMAIN_OWNERS = {
  auth: 'backend/web/routers/auth.py',
  shangshufang: 'backend/web/routers/shangshufang.py',
  junjichu: 'backend/web/routers/court_compat.py + backend/web/routers/swarm_runs.py',
  dadian: 'backend/web/routers/dadian.py',
  liubu: 'backend/web/routers/chaotang.py + backend/web/routers/court_compat.py',
  hubu: 'backend/web/routers/hubu.py',
  bingbu: 'backend/web/routers/bingbu.py',
  xingbu: 'backend/web/routers/legal.py',
  swarm: 'backend/web/routers/swarm.py',
  governance: 'backend/web/routers/governance_compat.py',
  archive: 'backend/web/routers/chaotang.py + backend/web/routers/governance_compat.py',
  health: 'backend/web/routers/health.py',
  telemetry: 'backend/web/routers/metrics.py',
  orchestration: 'backend/web/routers/orchestration_compat.py',
  intel: 'backend/web/routers/orchestration_compat.py',
  manor: 'backend/web/routers/governance_compat.py',
  qintian: 'backend/web/routers/orchestration_compat.py',
  hanlin: 'backend/web/routers/orchestration_compat.py',
  taiyi: 'backend/web/routers/orchestration_compat.py',
  court_session: 'backend/web/routers/court_session.py',
  zhuangyuan: 'backend/web/routers/court_compat.py',
  unknown: 'backend/web/routers/* by matched route',
};

const CONTRACT_VALIDATION_COMMANDS = [
  'node scripts/api-contract-inventory.mjs',
  'node scripts/api-contract-boundary-audit.mjs',
  'cd frontend; npx --yes tsx --test src/lib/backend-api.nodetest.ts',
  'cd backend; python -m pytest -q tests/test_contract_alignment_p0.py tests/test_swarm_runs_api_contract.py',
];

const ALIAS_RULES = [
  {
    kind: 'prefix',
    legacyPrefix: '/api/court/chaotang/',
    targetPrefix: '/api/chaotang/',
    owner: 'backend/web/routers/chaotang.py',
    retireWhen: 'inventory has no /api/court/chaotang/* frontend callers',
  },
  {
    kind: 'exact',
    legacy: '/api/court/chaotang',
    target: '/api/chaotang',
    owner: 'backend/web/routers/chaotang.py',
    retireWhen: 'inventory has no /api/court/chaotang frontend caller',
  },
  {
    kind: 'prefix',
    legacyPrefix: '/api/court/shangshufang/',
    targetPrefix: '/api/shangshufang/',
    owner: 'backend/web/routers/shangshufang.py',
    retireWhen: 'inventory has no /api/court/shangshufang/* frontend callers',
  },
  {
    kind: 'exact',
    legacy: '/api/court/shangshufang',
    target: '/api/shangshufang',
    owner: 'backend/web/routers/shangshufang.py',
    retireWhen: 'inventory has no /api/court/shangshufang frontend caller',
  },
  {
    kind: 'exact',
    legacy: '/api/court/legal/overview',
    target: '/api/legal/overview',
    owner: 'backend/web/routers/legal.py',
    retireWhen: 'legal overview callers use /api/legal/overview directly',
  },
  {
    kind: 'exact',
    legacy: '/api/court/swarm/roster',
    target: '/api/swarm/roster',
    owner: 'backend/web/routers/swarm.py',
    retireWhen: 'swarm roster callers use /api/swarm/roster directly',
  },
  {
    kind: 'exact',
    legacy: '/api/court/court-session/latest',
    target: '/api/court-session/latest',
    owner: 'backend/web/routers/court_session.py',
    retireWhen: 'court session callers use /api/court-session/latest directly',
  },
  {
    kind: 'exact',
    legacy: '/api/court/chaotang/dept/finance/overview',
    target: '/api/chaotang/dept/finance/overview',
    owner: 'backend/web/routers/chaotang.py',
    retireWhen: 'department overview callers use canonical /api/chaotang/dept/* paths',
  },
  {
    kind: 'exact',
    legacy: '/api/court/hubu/overview',
    target: '/api/chaotang/dept/finance/overview',
    owner: 'backend/web/routers/chaotang.py',
    retireWhen: 'hubu overview callers use canonical /api/chaotang/dept/finance/overview',
  },
  {
    kind: 'exact',
    legacy: '/api/court/bingbu/overview',
    target: '/api/chaotang/dept/ops/overview',
    owner: 'backend/web/routers/chaotang.py',
    retireWhen: 'bingbu overview callers use canonical /api/chaotang/dept/ops/overview',
  },
  {
    kind: 'exact',
    legacy: '/api/court/libu/promo',
    target: '/api/chaotang/dept/market/overview',
    owner: 'backend/web/routers/chaotang.py',
    retireWhen: 'libu promo callers use canonical /api/chaotang/dept/market/overview',
  },
];

async function walkFiles(root, extensions) {
  const files = [];
  async function visit(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
      files.push({
        inaccessible: true,
        path: path.relative(ROOT, dir).replaceAll(path.sep, '/'),
        error: error.code || error.message,
      });
      return;
    }

    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '__pycache__') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (extensions.has(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }
  await visit(root);
  return files;
}

async function readText(file) {
  return fs.readFile(file, 'utf8');
}

function lineNumber(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function inferMethod(source, index) {
  const end = source.indexOf(');', index);
  const window = source.slice(index, end === -1 ? index + 260 : Math.min(end + 2, index + 360));
  const methodMatch = window.match(/\bmethod\s*:\s*([`'"])([A-Za-z]+)\1/);
  if (methodMatch) return methodMatch[2].toUpperCase();
  return 'GET';
}

function normalizeFrontendPath(callee, rawPath) {
  let value = rawPath.trim();
  value = value.replace(/\$\{[^}]+\}/g, '{param}');
  if (callee === 'jiqunPost' || callee === 'jiqunFetcher') {
    value = value.startsWith('/api/') ? value : `/api${value.startsWith('/') ? value : `/${value}`}`;
  }
  const apiAt = value.indexOf('/api/');
  if (apiAt > 0) value = value.slice(apiAt);
  return value;
}

function inferDomain(apiPath, filePath) {
  const combined = `${apiPath} ${filePath}`.toLowerCase();
  if (combined.includes('/api/auth/') || combined.includes('auth')) return 'auth';
  if (combined.includes('/api/metrics')) return 'telemetry';
  if (combined.includes('/api/health')) return 'health';
  if (combined.includes('court-session')) return 'court_session';
  if (combined.includes('shangshufang')) return 'shangshufang';
  if (combined.includes('junjichu') || combined.includes('command-center')) return 'junjichu';
  if (combined.includes('/api/court/backend/tasks/')) return 'junjichu';
  if (combined.includes('dadian')) return 'dadian';
  if (combined.includes('/api/court/orchestrate')) return 'junjichu';
  if (combined.includes('governance')) return 'governance';
  if (combined.includes('scribe') || combined.includes('shiguan') || combined.includes('ima-knowledge') || combined.includes('true-chain')) return 'archive';
  if (combined.includes('orchestration')) return 'orchestration';
  if (combined.includes('prompt')) return 'hanlin';
  if (combined.includes('qintian')) return 'qintian';
  if (combined.includes('/api/chat') || combined.includes('health/components/medical')) return 'taiyi';
  if (combined.includes('intel')) return 'intel';
  if (combined.includes('manor')) return 'manor';
  if (combined.includes('zhuangyuan')) return 'zhuangyuan';
  if (combined.includes('bureau') || combined.includes('dept') || combined.includes('liubu')) return 'liubu';
  if (combined.includes('hubu') || combined.includes('finance')) return 'hubu';
  if (combined.includes('bingbu') || combined.includes('quotation')) return 'bingbu';
  if (combined.includes('legal') || combined.includes('xingbu')) return 'xingbu';
  if (combined.includes('swarm')) return 'swarm';
  if (combined.includes('/api/court/decision-judgment')) return 'dadian';
  if (combined.includes('/api/chaotang/tasks') || combined.includes('/api/chaotang/decree')) return 'junjichu';
  return 'unknown';
}

function isLikelyFirstScreen(filePath) {
  return /\/app\/|page\.tsx$|use[A-Z].*\.ts$|hooks\//.test(filePath);
}

async function scanFrontendCalls() {
  const files = await walkFiles(FRONTEND_SRC, FRONTEND_EXTENSIONS);
  const calls = [];
  const inaccessible = files.filter((item) => item && item.inaccessible);

  for (const file of files.filter((item) => typeof item === 'string')) {
    const source = await readText(file);
    const rel = path.relative(ROOT, file).replaceAll(path.sep, '/');
    for (const pattern of API_CALL_PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match;
      while ((match = pattern.regex.exec(source))) {
        const rawPath = match[2];
        if (!rawPath || (!rawPath.includes('/api') && !rawPath.startsWith('/'))) continue;
        const apiPath = normalizeFrontendPath(pattern.name, rawPath);
        if (!apiPath.startsWith('/api')) continue;
        if (rel === 'frontend/src/lib/jiqun-api.ts' && apiPath === '/api{param}') continue;
        const method = inferMethod(source, match.index);
        calls.push({
          file: rel,
          line: lineNumber(source, match.index),
          callee: pattern.name,
          method,
          path: apiPath,
          domain: inferDomain(apiPath, rel),
          firstScreenDependency: isLikelyFirstScreen(rel),
          writeOperation: method !== 'GET',
        });
      }
    }
  }

  return { calls, inaccessible };
}

function routePatternToRegex(routePath) {
  const escaped = routePath
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\{[^}]+\\\}/g, '[^/]+');
  return new RegExp(`^${escaped}$`);
}

function combineRoute(prefix, suffix) {
  const left = prefix === '/' ? '' : prefix.replace(/\/$/, '');
  const right = suffix === '/' ? '' : suffix.replace(/^\//, '/');
  return `${left}${right || ''}` || '/';
}

async function listBackendTests() {
  const files = await walkFiles(BACKEND_TESTS, BACKEND_EXTENSIONS);
  const tests = [];
  for (const file of files.filter((item) => typeof item === 'string')) {
    tests.push({
      file: path.relative(ROOT, file).replaceAll(path.sep, '/'),
      source: await readText(file),
    });
  }
  return tests;
}

function routeHasAuth(source, decoratorEnd) {
  const nextDecorator = source.indexOf('\n@router.', decoratorEnd + 1);
  const block = source.slice(decoratorEnd, nextDecorator === -1 ? Math.min(source.length, decoratorEnd + 1200) : nextDecorator);
  return /Depends\s*\(\s*get_current_user|CurrentUser/.test(block);
}

function routeStaticPrefixes(routePath) {
  const parts = routePath.split('/');
  const prefixes = [];
  for (let end = parts.length; end >= 2; end -= 1) {
    const prefix = parts.slice(0, end).join('/');
    if (prefix.includes('{')) continue;
    if (prefix.length >= 8) prefixes.push(prefix);
  }
  return prefixes;
}

async function scanBackendRoutes(testFiles) {
  const files = await walkFiles(BACKEND_ROUTERS, BACKEND_EXTENSIONS);
  const routes = [];
  const inaccessible = files.filter((item) => item && item.inaccessible);

  for (const file of files.filter((item) => typeof item === 'string')) {
    const source = await readText(file);
    const rel = path.relative(ROOT, file).replaceAll(path.sep, '/');
    const routerName = path.basename(file, '.py');
    const prefixMatch = source.match(/APIRouter\s*\(\s*prefix\s*=\s*([rubfRUBF]*)([`'"])(.*?)\2/);
    const prefix = prefixMatch ? prefixMatch[3] : '';
    let match;
    ROUTE_DECORATOR.lastIndex = 0;
    while ((match = ROUTE_DECORATOR.exec(source))) {
      const method = match[1].toUpperCase();
      const suffix = match[4] || '';
      const fullPath = combineRoute(prefix, suffix);
      const relatedTests = testFiles.filter((test) => {
        const lowerFile = test.file.toLowerCase();
        const lowerSource = test.source.toLowerCase();
        const lastToken = fullPath.split('/').filter(Boolean).at(-1)?.replace(/[{}]/g, '').toLowerCase() || 'never-match';
        return (
          lowerFile.includes(routerName.toLowerCase()) ||
          lowerFile.includes(lastToken) ||
          routeStaticPrefixes(fullPath).some((prefix) => lowerSource.includes(prefix.toLowerCase()))
        );
      }).map((test) => test.file);
      routes.push({
        router: routerName,
        file: rel,
        line: lineNumber(source, match.index),
        method,
        path: fullPath,
        pathRegex: routePatternToRegex(fullPath).source,
        auth: routeHasAuth(source, match.index),
        envelope: /ok\s*\(|success/.test(source) ? 'success-data-error-or-ok-helper' : 'unknown',
        tests: relatedTests,
      });
    }
  }

  return { routes, inaccessible };
}

function applyKnownAlias(apiPath) {
  if (apiPath.startsWith('/api/court/chaotang/')) {
    return `/api/chaotang/${apiPath.slice('/api/court/chaotang/'.length)}`;
  }
  if (apiPath === '/api/court/chaotang') return '/api/chaotang';
  if (apiPath.startsWith('/api/court/shangshufang/')) {
    return `/api/shangshufang/${apiPath.slice('/api/court/shangshufang/'.length)}`;
  }
  if (apiPath === '/api/court/shangshufang') return '/api/shangshufang';
  const exact = new Map([
    ['/api/court/legal/overview', '/api/legal/overview'],
    ['/api/court/swarm/roster', '/api/swarm/roster'],
    ['/api/court/court-session/latest', '/api/court-session/latest'],
    ['/api/court/chaotang/dept/finance/overview', '/api/chaotang/dept/finance/overview'],
    ['/api/court/hubu/overview', '/api/chaotang/dept/finance/overview'],
    ['/api/court/bingbu/overview', '/api/chaotang/dept/ops/overview'],
    ['/api/court/libu/promo', '/api/chaotang/dept/market/overview'],
  ]);
  return exact.get(apiPath) || apiPath;
}

function aliasMetadata(apiPath, normalizedPath) {
  if (apiPath === normalizedPath) return null;
  const exact = ALIAS_RULES.find((rule) => rule.kind === 'exact' && rule.legacy === apiPath && rule.target === normalizedPath);
  if (exact) return {
    owner: exact.owner,
    retireWhen: exact.retireWhen,
    verification: CONTRACT_VALIDATION_COMMANDS,
  };
  const prefix = ALIAS_RULES.find((rule) => (
    rule.kind === 'prefix' &&
    apiPath.startsWith(rule.legacyPrefix) &&
    normalizedPath.startsWith(rule.targetPrefix)
  ));
  if (!prefix) return null;
  return {
    owner: prefix.owner,
    retireWhen: prefix.retireWhen,
    verification: CONTRACT_VALIDATION_COMMANDS,
  };
}

function contractOwner(call, route) {
  if (route?.file) return route.file;
  return DOMAIN_OWNERS[call.domain] || DOMAIN_OWNERS.unknown;
}

function findBackendRoute(call, routes, pathToMatch) {
  const comparablePath = pathToMatch.split('?')[0];
  return routes.find((route) => {
    if (route.method !== call.method) return false;
    return new RegExp(route.pathRegex).test(comparablePath);
  }) || null;
}

function classifyCall(call, routes) {
  const normalizedPath = applyKnownAlias(call.path);
  const directRoute = findBackendRoute(call, routes, call.path);
  const aliasRoute = normalizedPath === call.path ? null : findBackendRoute(call, routes, normalizedPath);
  const route = directRoute || aliasRoute;
  const owner = contractOwner(call, route);
  const alias = aliasMetadata(call.path, normalizedPath);

  if (!route) {
    return {
      ...call,
      normalizedPath,
      owner,
      alias,
      verification: CONTRACT_VALIDATION_COMMANDS,
      status: 'MISSING_BACKEND',
      backendRoute: null,
      notes: 'No matching backend route found by method/path scan.',
    };
  }
  if (aliasRoute && !directRoute) {
    return {
      ...call,
      normalizedPath,
      owner,
      alias,
      verification: CONTRACT_VALIDATION_COMMANDS,
      status: 'PATH_ALIAS',
      backendRoute: summarizeRoute(route),
      notes: 'Frontend path is mapped by existing transport alias.',
    };
  }
  if (!route.tests.length) {
    return {
      ...call,
      normalizedPath,
      owner,
      alias,
      verification: CONTRACT_VALIDATION_COMMANDS,
      status: 'SHAPE_DRIFT',
      backendRoute: summarizeRoute(route),
      notes: 'Route exists, but no related backend test was found by inventory scan.',
    };
  }
  return {
    ...call,
    normalizedPath,
    owner,
    alias,
    verification: CONTRACT_VALIDATION_COMMANDS,
    status: 'MATCHED',
    backendRoute: summarizeRoute(route),
    notes: 'Method/path matched and at least one related backend test was found.',
  };
}

function summarizeRoute(route) {
  return {
    method: route.method,
    path: route.path,
    router: route.router,
    file: route.file,
    line: route.line,
    auth: route.auth,
    envelope: route.envelope,
    tests: route.tests,
  };
}

function countBy(items, field) {
  return items.reduce((acc, item) => {
    const key = item[field] || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function markdownTable(rows, columns) {
  const header = `| ${columns.map((column) => column.label).join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${columns.map((column) => String(column.value(row) ?? '').replaceAll('\n', '<br>')).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}

function renderMarkdown(inventory) {
  const generatedAt = inventory.generatedAt;
  const summaryRows = Object.entries(inventory.summary.byStatus).map(([status, count]) => ({ status, count }));
  const p0Rows = inventory.frontendCalls
    .filter((call) => call.status !== 'MATCHED')
    .slice(0, 80);
  const routeRows = inventory.backendRoutes.slice(0, 80);

  return `# API Contract Inventory

| Field | Value |
| --- | --- |
| Generated at | ${generatedAt} |
| Frontend calls | ${inventory.summary.frontendCalls} |
| Backend routes | ${inventory.summary.backendRoutes} |
| Inaccessible paths | ${inventory.summary.inaccessiblePaths} |

## Status Summary

${markdownTable(summaryRows, [
  { label: 'Status', value: (row) => row.status },
  { label: 'Count', value: (row) => row.count },
])}

## Non-Matched Frontend Calls

These entries need follow-up in the contract alignment plan. This inventory does not change UI code and does not add frontend BFF routes.

${markdownTable(p0Rows, [
  { label: 'Status', value: (row) => row.status },
  { label: 'Method', value: (row) => row.method },
  { label: 'Path', value: (row) => row.path },
  { label: 'Normalized', value: (row) => row.normalizedPath },
  { label: 'Domain', value: (row) => row.domain },
  { label: 'Frontend', value: (row) => `${row.file}:${row.line}` },
  { label: 'Owner', value: (row) => row.owner },
  { label: 'Alias retire when', value: (row) => row.alias?.retireWhen || '' },
  { label: 'Backend', value: (row) => row.backendRoute ? `${row.backendRoute.router} ${row.backendRoute.path}` : '' },
  { label: 'Notes', value: (row) => row.notes },
])}

## Backend Route Sample

${markdownTable(routeRows, [
  { label: 'Method', value: (row) => row.method },
  { label: 'Path', value: (row) => row.path },
  { label: 'Router', value: (row) => row.router },
  { label: 'Auth', value: (row) => row.auth },
  { label: 'Tests', value: (row) => row.tests.length ? row.tests.join('<br>') : '' },
])}

## Inaccessible Paths

${inventory.inaccessiblePaths.length ? markdownTable(inventory.inaccessiblePaths, [
  { label: 'Path', value: (row) => row.path },
  { label: 'Error', value: (row) => row.error },
]) : 'None.'}

## Validation

\`\`\`powershell
node scripts/api-contract-inventory.mjs
node scripts/harness-doctor.mjs
\`\`\`
`;
}

async function main() {
  const testFiles = await listBackendTests();
  const [{ calls, inaccessible: frontendInaccessible }, { routes, inaccessible: backendInaccessible }] = await Promise.all([
    scanFrontendCalls(),
    scanBackendRoutes(testFiles),
  ]);

  const classifiedCalls = calls.map((call) => classifyCall(call, routes));
  const inaccessiblePaths = [...frontendInaccessible, ...backendInaccessible];
  const inventory = {
    schemaVersion: 'ApiContractInventoryV1',
    generatedAt: new Date().toISOString(),
    policy: {
      uiLayerFrozen: true,
      noNewFrontendBff: true,
      source: 'docs/frontend-backend-contract-alignment-plan-2026-07-09.md',
    },
    summary: {
      frontendCalls: classifiedCalls.length,
      backendRoutes: routes.length,
      inaccessiblePaths: inaccessiblePaths.length,
      byStatus: countBy(classifiedCalls, 'status'),
      byDomain: countBy(classifiedCalls, 'domain'),
    },
    frontendCalls: classifiedCalls,
    backendRoutes: routes.map(summarizeRoute),
    inaccessiblePaths,
  };

  await fs.writeFile(OUT_JSON, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
  await fs.writeFile(OUT_MD, renderMarkdown(inventory), 'utf8');
  console.log(`Wrote ${path.relative(ROOT, OUT_JSON)}`);
  console.log(`Wrote ${path.relative(ROOT, OUT_MD)}`);
  console.log(JSON.stringify(inventory.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

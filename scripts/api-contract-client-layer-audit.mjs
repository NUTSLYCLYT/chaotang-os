#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_JSON = path.join(ROOT, 'docs', 'api-contract-client-layer-audit-2026-07-09.json');
const OUT_MD = path.join(ROOT, 'docs', 'api-contract-client-layer-audit-2026-07-09.md');

const REQUIRED_CLIENTS = [
  {
    domain: 'dadian',
    file: 'frontend/src/features/dadian/api/index.ts',
    requiredPaths: [
      '/api/court/dadian/pulse',
      '/api/court/dadian/feed',
      '/api/court/decision-judgment',
    ],
    forbiddenPaths: [],
  },
  {
    domain: 'bureaus',
    file: 'frontend/src/features/bureaus/api/index.ts',
    requiredPaths: [
      '/api/chaotang/dept/',
      '/api/court/bureaus/',
      '/api/legal/verdict/from-text',
    ],
    forbiddenPaths: [],
  },
  {
    domain: 'shangshufang',
    file: 'frontend/src/features/shangshufang/api/index.ts',
    requiredPaths: [
      '/api/shangshufang/home',
      '/api/shangshufang/draft-edict',
      '/api/shangshufang/confirm-edict',
      '/api/shangshufang/tasks/',
      '/api/shangshufang/pack-swarm-loop',
      '/api/shangshufang/finance-reporting-loop',
      '/api/shangshufang/edict-return',
    ],
    forbiddenPaths: ['/api/court/shangshufang'],
  },
  {
    domain: 'junjichu',
    files: [
      'frontend/src/features/command-center/junjichu/api/swarm-runs.ts',
      'frontend/src/features/command-center/junjichu/api/governance.ts',
      'frontend/src/features/command-center/junjichu/api/archive.ts',
    ],
    requiredPaths: [
      '/api/swarm-runs',
      '/api/chaotang/decree/',
      '/api/chaotang/archive/search',
      '/api/chaotang/archive/knowledge/count',
      '/api/chaotang/archive/knowledge/feedback',
    ],
    forbiddenPaths: [],
  },
];

const FORBIDDEN_PATTERNS = [
  { code: 'FRONTEND_BFF_ROUTE_HANDLER', pattern: /\b(?:GET|POST|PUT|PATCH|DELETE)\s*\(/ },
  { code: 'NEXT_SERVER_ACTION', pattern: /['"]use server['"]/ },
  { code: 'RAW_FETCH_TO_API', pattern: /\bfetch\s*\(\s*[`'"]\/api\// },
];

async function readText(relativePath) {
  return fs.readFile(path.join(ROOT, relativePath), 'utf8');
}

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
  return `# API Contract Client Layer Audit

| Field | Value |
| --- | --- |
| Generated at | ${report.generatedAt} |
| Status | ${report.status} |
| Required clients | ${report.summary.requiredClients} |
| Complete clients | ${report.summary.completeClients} |
| Review required | ${report.summary.reviewRequired} |

## Clients

${markdownTable(report.clients, [
  { label: 'Domain', value: (row) => row.domain },
  { label: 'File', value: (row) => row.file },
  { label: 'Status', value: (row) => row.status },
  { label: 'Uses shared transport', value: (row) => row.usesBackendTransport },
  { label: 'Missing paths', value: (row) => row.missingPaths.join('<br>') },
  { label: 'Forbidden hits', value: (row) => row.forbiddenHits.join('<br>') },
])}

## Review Required

${report.reviewRequired.length ? markdownTable(report.reviewRequired, [
  { label: 'Domain', value: (row) => row.domain },
  { label: 'File', value: (row) => row.file },
  { label: 'Reason', value: (row) => row.reason },
]) : 'None.'}

## Policy

- These files are business API clients/adapters, not UI implementation files.
- New frontend BFF routes, route handlers and server actions remain forbidden.
- New clients must use backend-owned routes or documented transport aliases.
`;
}

async function main() {
  const reviewRequired = [];
  const clients = [];

  for (const client of REQUIRED_CLIENTS) {
    const files = client.files ?? [client.file];
    const existingFiles = [];
    const texts = [];
    for (const file of files) {
      if (await exists(file)) {
        existingFiles.push(file);
        texts.push(await readText(file));
      }
    }
    const fileExists = existingFiles.length === files.length;
    const text = texts.join('\n');
    const usesBackendTransport = text.includes('backendJson') || text.includes('fetchLocalCourtApi');
    const missingPaths = client.requiredPaths.filter((needle) => !text.includes(needle));
    const forbiddenHits = [];

    for (const needle of client.forbiddenPaths) {
      if (text.includes(needle)) forbiddenHits.push(needle);
    }
    for (const rule of FORBIDDEN_PATTERNS) {
      if (rule.pattern.test(text)) forbiddenHits.push(rule.code);
    }

    if (!fileExists) {
      const missingFiles = files.filter((file) => !existingFiles.includes(file));
      reviewRequired.push({ domain: client.domain, file: files.join(', '), reason: `Required business API client is missing: ${missingFiles.join(', ')}` });
    }
    if (fileExists && !usesBackendTransport) {
      reviewRequired.push({ domain: client.domain, file: files.join(', '), reason: 'Client does not use the shared backend transport.' });
    }
    for (const missingPath of missingPaths) {
      reviewRequired.push({ domain: client.domain, file: files.join(', '), reason: `Required backend path evidence is missing: ${missingPath}` });
    }
    for (const hit of forbiddenHits) {
      reviewRequired.push({ domain: client.domain, file: files.join(', '), reason: `Forbidden client-layer pattern found: ${hit}` });
    }

    clients.push({
      ...client,
      file: files.join(', '),
      exists: fileExists,
      usesBackendTransport,
      missingPaths,
      forbiddenHits,
      status: fileExists && usesBackendTransport && missingPaths.length === 0 && forbiddenHits.length === 0 ? 'complete' : 'needs_review',
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    status: reviewRequired.length ? 'needs_review' : 'pass',
    summary: {
      requiredClients: REQUIRED_CLIENTS.length,
      completeClients: clients.filter((client) => client.status === 'complete').length,
      reviewRequired: reviewRequired.length,
    },
    clients,
    reviewRequired,
    policy: {
      noUiLayerChanges: true,
      noFrontendBff: true,
      sharedTransport: 'frontend/src/lib/backend-api.ts',
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

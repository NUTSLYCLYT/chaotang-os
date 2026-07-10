#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_JSON = path.join(ROOT, 'docs', 'api-contract-boundary-audit-2026-07-09.json');
const OUT_MD = path.join(ROOT, 'docs', 'api-contract-boundary-audit-2026-07-09.md');

const KNOWN_WORKSPACE_ISSUES = new Set([
  'frontend/src/features/bingbu/components/bingbu-quotation-verdict-panel.tsx',
  'frontend/src/features/hubu/components/hubu-finance-preview-panel.tsx',
]);

function normalizePath(value) {
  return value.replaceAll('\\', '/');
}

function parsePorcelainZ(raw) {
  const items = raw.split('\0').filter(Boolean);
  const changes = [];
  for (let i = 0; i < items.length; i += 1) {
    const entry = items[i];
    const status = entry.slice(0, 2);
    const file = normalizePath(entry.slice(3));
    if (status.startsWith('R') || status.startsWith('C')) {
      const target = normalizePath(items[i + 1] || '');
      i += 1;
      changes.push({ status, file, target });
    } else {
      changes.push({ status, file });
    }
  }
  return changes;
}

function isUiLayer(file) {
  return (
    file.startsWith('frontend/src/app/') ||
    /(^|\/)frontend\/src\/features\/[^/]+\/components\//.test(file) ||
    /(^|\/)frontend\/src\/components\//.test(file)
  );
}

function isFrontendBff(file) {
  return file.startsWith('frontend/src/app/api/');
}

function classifyChange(change) {
  const paths = [change.file, change.target].filter(Boolean);
  const knownIssue = paths.some((file) => KNOWN_WORKSPACE_ISSUES.has(file));
  return {
    ...change,
    knownWorkspaceIssue: knownIssue,
    uiLayer: paths.some(isUiLayer),
    frontendBff: paths.some(isFrontendBff),
  };
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir, acc = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    acc.push({
      inaccessible: true,
      path: normalizePath(path.relative(ROOT, dir)),
      error: error.code || error.message,
    });
    return acc;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, acc);
    } else {
      acc.push(normalizePath(path.relative(ROOT, full)));
    }
  }
  return acc;
}

function markdownTable(rows, columns) {
  if (!rows.length) return 'None.';
  const header = `| ${columns.map((column) => column.label).join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${columns.map((column) => String(column.value(row) ?? '').replaceAll('\n', '<br>')).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}

function renderMarkdown(report) {
  return `# API Contract Boundary Audit

| Field | Value |
| --- | --- |
| Generated at | ${report.generatedAt} |
| Status | ${report.status} |
| Frontend BFF violations | ${report.summary.frontendBffViolations} |
| UI layer violations | ${report.summary.uiLayerViolations} |
| Known workspace UI issues | ${report.summary.knownWorkspaceUiIssues} |
| Inaccessible frontend paths | ${report.summary.inaccessibleFrontendPaths} |

## Findings

${markdownTable(report.findings, [
  { label: 'Severity', value: (row) => row.severity },
  { label: 'Code', value: (row) => row.code },
  { label: 'Path', value: (row) => row.path },
  { label: 'Details', value: (row) => row.details },
])}

## Changed Files

${markdownTable(report.changedFiles, [
  { label: 'Status', value: (row) => row.status },
  { label: 'Path', value: (row) => row.file },
  { label: 'UI', value: (row) => row.uiLayer },
  { label: 'BFF', value: (row) => row.frontendBff },
  { label: 'Known issue', value: (row) => row.knownWorkspaceIssue },
])}

## Policy

- This audit checks the implementation boundary for the frontend-backend contract alignment plan.
- It must not be used to prove browser UX quality.
- Known workspace UI issues are reported separately and do not authorize new UI edits.
- Missing backend capabilities must be implemented in backend routes or existing transport aliases, not new frontend BFF routes.
`;
}

async function main() {
  const rawStatus = execFileSync('git', ['status', '--porcelain=v1', '-z'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const changedFiles = parsePorcelainZ(rawStatus).map(classifyChange);
  const frontendFiles = await walk(path.join(ROOT, 'frontend', 'src'));
  const inaccessibleFrontendPaths = frontendFiles.filter((item) => typeof item === 'object' && item.inaccessible);

  const frontendBffViolations = changedFiles.filter((change) => change.frontendBff && !change.knownWorkspaceIssue);
  const uiLayerViolations = changedFiles.filter((change) => change.uiLayer && !change.knownWorkspaceIssue);
  const knownWorkspaceUiIssues = changedFiles.filter((change) => change.uiLayer && change.knownWorkspaceIssue);
  const appApiExists = await exists(path.join(ROOT, 'frontend', 'src', 'app', 'api'));

  const findings = [];
  if (frontendBffViolations.length) {
    for (const item of frontendBffViolations) {
      findings.push({
        severity: 'error',
        code: 'FRONTEND_BFF_CHANGED',
        path: item.file,
        details: 'Frontend BFF route changed or added under frontend/src/app/api.',
      });
    }
  }
  if (uiLayerViolations.length) {
    for (const item of uiLayerViolations) {
      findings.push({
        severity: 'error',
        code: 'UI_LAYER_CHANGED',
        path: item.file,
        details: 'UI layer path changed outside known workspace issues.',
      });
    }
  }
  if (appApiExists) {
    findings.push({
      severity: 'info',
      code: 'FRONTEND_APP_API_EXISTS',
      path: 'frontend/src/app/api',
      details: 'Existing frontend route handlers may exist; this audit only blocks changed paths.',
    });
  }
  for (const item of knownWorkspaceUiIssues) {
    findings.push({
      severity: 'warning',
      code: 'KNOWN_WORKSPACE_UI_ISSUE',
      path: item.file,
      details: 'Pre-existing deleted/permission-denied UI path is still present in git status.',
    });
  }
  for (const item of inaccessibleFrontendPaths) {
    findings.push({
      severity: 'warning',
      code: 'INACCESSIBLE_FRONTEND_PATH',
      path: item.path,
      details: item.error,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    status: frontendBffViolations.length || uiLayerViolations.length ? 'fail' : 'pass_with_warnings',
    policy: {
      uiLayerFrozen: true,
      noNewFrontendBff: true,
    },
    summary: {
      frontendBffViolations: frontendBffViolations.length,
      uiLayerViolations: uiLayerViolations.length,
      knownWorkspaceUiIssues: knownWorkspaceUiIssues.length,
      inaccessibleFrontendPaths: inaccessibleFrontendPaths.length,
    },
    findings,
    changedFiles,
  };

  await fs.writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.writeFile(OUT_MD, renderMarkdown(report), 'utf8');
  console.log(`Wrote ${path.relative(ROOT, OUT_JSON)}`);
  console.log(`Wrote ${path.relative(ROOT, OUT_MD)}`);
  console.log(JSON.stringify({
    status: report.status,
    ...report.summary,
  }, null, 2));
  if (report.status === 'fail') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const INVENTORY_JSON = path.join(ROOT, 'docs', 'api-contract-inventory-2026-07-09.json');
const TRANSPORT_FILE = 'frontend/src/lib/backend-api.ts';
const TRANSPORT_TEST = 'frontend/src/lib/backend-api.nodetest.ts';
const OUT_JSON = path.join(ROOT, 'docs', 'api-contract-alias-retirement-audit-2026-07-09.json');
const OUT_MD = path.join(ROOT, 'docs', 'api-contract-alias-retirement-audit-2026-07-09.md');

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

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

function aliasGroup(call) {
  if (call.path.startsWith('/api/court/shangshufang/')) return '/api/court/shangshufang/*';
  if (call.path.startsWith('/api/court/chaotang/')) return '/api/court/chaotang/*';
  return call.path;
}

function markdownTable(rows, columns) {
  const header = `| ${columns.map((column) => column.label).join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${columns.map((column) => String(column.value(row) ?? '').replaceAll('\n', '<br>')).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}

function renderMarkdown(report) {
  return `# API Alias Retirement Audit

| Field | Value |
| --- | --- |
| Generated at | ${report.generatedAt} |
| Status | ${report.status} |
| PATH_ALIAS calls | ${report.summary.pathAliasCalls} |
| Alias groups | ${report.summary.aliasGroups} |
| Tested groups | ${report.summary.testedGroups} |
| Review required | ${report.summary.reviewRequired} |

## Alias Groups

${markdownTable(report.groups, [
  { label: 'Group', value: (row) => row.group },
  { label: 'Status', value: (row) => row.status },
  { label: 'Owner', value: (row) => row.owner },
  { label: 'Retire when', value: (row) => row.retireWhen },
  { label: 'Calls', value: (row) => row.calls.length },
  { label: 'Transport test evidence', value: (row) => row.transportTestEvidence },
])}

## Review Required

${report.reviewRequired.length ? markdownTable(report.reviewRequired, [
  { label: 'Path', value: (row) => row.path },
  { label: 'Frontend', value: (row) => `${row.file}:${row.line}` },
  { label: 'Reason', value: (row) => row.reason },
]) : 'None.'}

## Policy

- PATH_ALIAS is allowed only as a temporary transport-layer compatibility rule.
- Every alias must have owner, canonical backend route, verification commands and a retirement condition.
- This audit does not edit UI files and does not add frontend BFF routes.
`;
}

async function main() {
  const inventory = await readJson(INVENTORY_JSON);
  const transportExists = await exists(TRANSPORT_FILE);
  const transportTestExists = await exists(TRANSPORT_TEST);
  const transportText = transportExists ? await readText(TRANSPORT_FILE) : '';
  const testText = transportTestExists ? await readText(TRANSPORT_TEST) : '';
  const pathAliases = (inventory.frontendCalls || []).filter((call) => call.status === 'PATH_ALIAS');
  const reviewRequired = [];

  const groups = new Map();
  for (const call of pathAliases) {
    const group = aliasGroup(call);
    if (!groups.has(group)) {
      groups.set(group, {
        group,
        owner: call.alias?.owner || call.owner || '',
        retireWhen: call.alias?.retireWhen || '',
        calls: [],
      });
    }
    groups.get(group).calls.push(call);

    if (!call.alias?.owner) {
      reviewRequired.push({ ...call, reason: 'PATH_ALIAS is missing alias.owner.' });
    }
    if (!call.alias?.retireWhen) {
      reviewRequired.push({ ...call, reason: 'PATH_ALIAS is missing alias.retireWhen.' });
    }
    if (!Array.isArray(call.alias?.verification) || call.alias.verification.length === 0) {
      reviewRequired.push({ ...call, reason: 'PATH_ALIAS is missing verification commands.' });
    }
    if (!call.backendRoute) {
      reviewRequired.push({ ...call, reason: 'PATH_ALIAS does not resolve to a backend route.' });
    }
    if (call.normalizedPath === call.path) {
      reviewRequired.push({ ...call, reason: 'PATH_ALIAS did not change the frontend path to a canonical backend path.' });
    }
  }

  const checkedGroups = [];
  for (const group of groups.values()) {
    const first = group.calls[0];
    const legacyNeedle = group.group.endsWith('/*') ? group.group.slice(0, -2) : group.group;
    const targetNeedle = first.normalizedPath.replace(/\{param\}/g, '');
    const transportHasRule = transportText.includes(legacyNeedle);
    const testHasLegacy = testText.includes(legacyNeedle);
    const testHasTarget = targetNeedle ? testText.includes(targetNeedle) || group.calls.some((call) => testText.includes(call.normalizedPath.split('{param}')[0])) : false;
    const ownerExists = group.owner ? await exists(group.owner) : false;

    if (!transportHasRule) {
      reviewRequired.push({ ...first, reason: `Alias group ${group.group} has no transport rule evidence in ${TRANSPORT_FILE}.` });
    }
    if (!testHasLegacy || !testHasTarget) {
      reviewRequired.push({ ...first, reason: `Alias group ${group.group} has no representative legacy-to-canonical transport test.` });
    }
    if (!ownerExists) {
      reviewRequired.push({ ...first, reason: `Alias owner ${group.owner || '(missing)'} does not exist.` });
    }

    checkedGroups.push({
      ...group,
      transportHasRule,
      ownerExists,
      transportTestEvidence: testHasLegacy && testHasTarget ? TRANSPORT_TEST : '',
      status: transportHasRule && testHasLegacy && testHasTarget && ownerExists ? 'complete' : 'needs_review',
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    status: reviewRequired.length ? 'needs_review' : 'pass',
    summary: {
      pathAliasCalls: pathAliases.length,
      aliasGroups: checkedGroups.length,
      testedGroups: checkedGroups.filter((group) => group.transportTestEvidence).length,
      reviewRequired: reviewRequired.length,
    },
    groups: checkedGroups.sort((left, right) => left.group.localeCompare(right.group)),
    reviewRequired,
    policy: {
      transportFile: TRANSPORT_FILE,
      transportTest: TRANSPORT_TEST,
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

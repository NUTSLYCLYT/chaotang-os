#!/usr/bin/env node

const DEFAULT_BASE_URL = 'http://127.0.0.1:3003/chaotang';
const BASE_URL = (process.env.DEPARTMENT_PAGE_VIEW_BASE_URL || process.env.CHAOTANG_BASE_URL || DEFAULT_BASE_URL)
  .replace(/\/$/, '');

const DEPARTMENTS = ['finance', 'gongbu', 'personnel', 'market', 'ops', 'legal'];
const FORBIDDEN_TOKENS = [
  'bureau-capabilities',
  'bureau-work-queue',
  'task_input',
  '/api/court/dept/',
  '/api/court/bureaus/',
];

const CHECK_ACTION = process.argv.includes('--with-action');

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function flattenSections(view) {
  return [
    ...(Array.isArray(view.leftRail) ? view.leftRail : []),
    ...(Array.isArray(view.rightRail) ? view.rightRail : []),
  ];
}

function hasSectionKind(view, kind) {
  return flattenSections(view).some((section) => section?.kind === kind);
}

function hasEvidenceOrIntegrity(view) {
  return hasSectionKind(view, 'evidence')
    || hasSectionKind(view, 'evidence_list')
    || hasSectionKind(view, 'integrity')
    || isObject(view.integrity);
}

function hasBlockedValue(view) {
  return hasSectionKind(view, 'blocked_value')
    || flattenSections(view).some((section) =>
      Array.isArray(section?.items) && section.items.some((item) => item?.tone === 'blocked_value'),
    );
}

function hasArchiveCommand(view) {
  return Array.isArray(view.commandBar) && view.commandBar.some((command) => command?.id === 'archive');
}

function hasOperationalCommand(view) {
  return Array.isArray(view.commandBar)
    && view.commandBar.some((command) => !String(command?.id || '').startsWith('handoff_') && command?.id !== 'archive');
}

function hasBureauEntrances(view, code) {
  const section = Array.isArray(view.leftRail)
    ? view.leftRail.find((item) => item?.id === 'bureau-entrances')
    : null;
  return Boolean(
    section
      && Array.isArray(section.items)
      && section.items.length > 0
      && section.items.every((item, index) =>
        item?.label
        && item?.body
        && item?.href === `/departments/${code}/bureau-${index + 1}`,
      ),
  );
}

function assertDepartmentView(code, view) {
  const problems = [];
  const serialized = JSON.stringify(view);

  if (!isObject(view)) problems.push('view is not an object');
  const actualCode = view.department?.code;
  if (actualCode !== code && !(code === 'gongbu' && actualCode === 'works')) {
    problems.push(`code mismatch: expected ${code}, got ${JSON.stringify(actualCode)}`);
  }
  if (!Array.isArray(view.leftRail) || view.leftRail.length === 0) problems.push('leftRail is empty');
  if (!Array.isArray(view.rightRail) || view.rightRail.length === 0) problems.push('rightRail is empty');
  if (!Array.isArray(view.commandBar) || view.commandBar.length < 4) problems.push('commandBar has fewer than 4 commands');
  if (!Array.isArray(view.mainEdict?.rows) || view.mainEdict.rows.length === 0) problems.push('mainEdict.rows is empty');
  if (!hasEvidenceOrIntegrity(view)) problems.push('missing evidence/integrity section');
  if (!hasBlockedValue(view)) problems.push('missing blocked_value item');
  if (!hasArchiveCommand(view)) problems.push('missing archive command');
  if (!hasOperationalCommand(view)) problems.push('missing operational command');
  if (!hasBureauEntrances(view, code)) problems.push('missing bureau entrances');

  for (const token of FORBIDDEN_TOKENS) {
    if (serialized.includes(token)) problems.push(`leaks forbidden token: ${token}`);
  }

  return problems;
}

async function getJson(url, init) {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.headers || {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { __raw: text };
  }
  return { response, body };
}

async function verifyPageView(code) {
  const url = `${BASE_URL}/api/court/departments/${code}/page-view`;
  const { response, body } = await getJson(url);
  const problems = [];

  if (response.status !== 200) problems.push(`HTTP ${response.status}`);
  if (!isObject(body) || body.success !== true) problems.push('response success is not true');
  if (!isObject(body?.data)) problems.push('response data is missing');

  if (isObject(body?.data)) {
    problems.push(...assertDepartmentView(code, body.data));
  }

  return {
    code,
    ok: problems.length === 0,
    problems,
    summary: isObject(body?.data)
      ? {
          mode: body.data.sourceMode || body.data.integrity?.mode || 'unknown',
          left: body.data.leftRail?.length ?? 0,
          right: body.data.rightRail?.length ?? 0,
          commands: body.data.commandBar?.length ?? 0,
          rows: body.data.mainEdict?.rows?.length ?? 0,
        }
      : null,
  };
}

async function verifyGongbuAction() {
  const url = `${BASE_URL}/api/court/departments/gongbu/actions`;
  const { response, body } = await getJson(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actionId: 'request_tests' }),
  });
  const problems = [];
  const serialized = JSON.stringify(body);

  if (response.status !== 200) problems.push(`HTTP ${response.status}`);
  if (!isObject(body) || body.success !== true) problems.push('action success is not true');
  if (!isObject(body?.data)) problems.push('action data is missing');
  for (const token of FORBIDDEN_TOKENS) {
    if (serialized.includes(token)) problems.push(`action leaks forbidden token: ${token}`);
  }

  return { code: 'gongbu action request_tests', ok: problems.length === 0, problems };
}

function printReport(results) {
  console.log('');
  console.log('================ Six Department Page View Verification ================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Scope: department-level pages only');
  console.log('-----------------------------------------------------------------------');

  for (const result of results) {
    if (result.ok) {
      const summary = result.summary
        ? `mode=${result.summary.mode} left=${result.summary.left} right=${result.summary.right} commands=${result.summary.commands} rows=${result.summary.rows}`
        : 'ok';
      console.log(`PASS ${result.code} ${summary}`);
    } else {
      console.log(`FAIL ${result.code}`);
      for (const problem of result.problems) console.log(`  - ${problem}`);
    }
  }

  const failed = results.filter((result) => !result.ok);
  console.log('-----------------------------------------------------------------------');
  console.log(`Result: ${failed.length === 0 ? 'PASS' : 'FAIL'} (${results.length - failed.length}/${results.length})`);
  console.log('=======================================================================');
  return failed.length === 0;
}

async function main() {
  const results = [];
  for (const code of DEPARTMENTS) {
    results.push(await verifyPageView(code));
  }
  if (CHECK_ACTION) {
    results.push(await verifyGongbuAction());
  }

  const ok = printReport(results);
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error('');
  console.error('FATAL verify-six-department-page-view failed');
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});

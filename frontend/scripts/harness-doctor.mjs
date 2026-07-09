#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const harness = join(root, '.harness');

const expectedChangeFiles = [
  'summary.md',
  'request_analysis/spec.md',
  'request_analysis/tasks.md',
  'request_analysis/review/spec_review_v1.md',
  'coding/coding_report_v1.md',
  'coding/review/code_review_v1.md',
  'unit_test/test_plan.md',
  'unit_test/review/test_review_v1.md',
  'e2e_test/e2e_plan.md',
  'e2e_test/e2e_summary.md',
  'ci_result/ci_summary.md',
  'deployment/preview_report.md',
];

const allowedChangeStatuses = new Set(['DRAFT', 'DELIVERED', 'ARCHIVED', 'CANCELLED']);
const allowedStageStatuses = new Set([
  'TODO',
  'DONE',
  'SKIPPED',
  'PARTIAL',
  'APPROVED',
  'PASSED',
  'CONFIRMED',
  'N/A',
  'AWAITING_REVIEW',
]);

let errors = 0;
let warnings = 0;

function ok(message) {
  console.log(`[ok] ${message}`);
}

function warn(message) {
  warnings += 1;
  console.warn(`[warn] ${message}`);
}

function error(message) {
  errors += 1;
  console.error(`[error] ${message}`);
}

async function readText(path) {
  return readFile(path, 'utf8');
}

function extractSummaryField(text, field) {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^\\|\\s*${escaped}\\s*\\|\\s*([^|]+?)\\s*\\|\\s*$`, 'im');
  return text.match(pattern)?.[1]?.trim() ?? null;
}

const required = [
  'AGENTS.md',
  'CLAUDE.md',
  'README.md',
  'docs/HARNESS-USAGE-GUIDE.md',
  'docs/AUTHORING-GUIDE.md',
  'scripts/harness-doctor.mjs',
  'scripts/new-change.mjs',
  'agents/frontend-owner.md',
  'rules/product-boundaries.md',
  'rules/project-structure.md',
  'rules/coding-standard.md',
  'rules/dev-workflow.md',
  'wiki/architecture.md',
  'wiki/domain-model.md',
  'wiki/api-contracts.md',
  'wiki/document-index.md',
  'wiki/release-operations.md',
  'mcp/servers.json',
  'templates/change-template/summary.md',
  'templates/change-template/request_analysis/spec.md',
  'templates/change-template/request_analysis/tasks.md',
  'skills/coding-skill/specs/01-app-route-spec.md',
  'skills/coding-skill/specs/02-feature-spec.md',
  'skills/coding-skill/specs/03-core-domain-spec.md',
  'skills/coding-skill/specs/04-lib-shared-spec.md',
  'skills/coding-skill/specs/05-styling-visual-spec.md',
];

for (const rel of required) {
  const isRootFile =
    rel === 'AGENTS.md' ||
    rel === 'CLAUDE.md' ||
    rel === 'README.md' ||
    rel.startsWith('docs/') ||
    rel.startsWith('scripts/');
  const abs = isRootFile ? join(root, rel) : join(harness, rel);
  const label = isRootFile ? rel : `.harness/${rel}`;
  if (existsSync(abs)) ok(`required: ${label}`);
  else error(`missing required file: ${label}`);
}

const entryPointExpectations = [
  ['AGENTS.md', '.harness/agents/frontend-owner.md'],
  ['CLAUDE.md', '.harness/agents/frontend-owner.md'],
  ['README.md', '.harness/'],
  ['docs/HARNESS-USAGE-GUIDE.md', '.harness/rules/dev-workflow.md'],
  ['docs/AUTHORING-GUIDE.md', '.harness/changes/'],
];

for (const [rel, needle] of entryPointExpectations) {
  const abs = join(root, rel);
  if (!existsSync(abs)) continue;
  const text = await readText(abs);
  if (text.includes(needle)) ok(`entrypoint: ${rel} -> ${needle}`);
  else error(`entrypoint ${rel}: missing reference to ${needle}`);
}

const expectedSkills = [
  'project-analysis',
  'request-analysis',
  'expert-reviewer',
  'coding-skill',
  'code-review',
  'unit-test-write',
  'e2e-test-write',
  'deploy-verify',
  'frontend-doctor',
];

for (const name of expectedSkills) {
  const skillFile = join(harness, 'skills', name, 'SKILL.md');
  if (!existsSync(skillFile)) {
    error(`skill missing SKILL.md: ${name}`);
    continue;
  }
  const text = await readText(skillFile);
  const frontmatter = text.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!frontmatter) {
    error(`skill ${name}: missing YAML frontmatter`);
    continue;
  }
  const frontmatterName = frontmatter[1].match(/^name:\s*(\S+)/m)?.[1];
  if (!frontmatterName) error(`skill ${name}: missing name`);
  else if (frontmatterName !== name) error(`skill ${name}: frontmatter name must match directory`);
  if (!/^description:\s*\S+/m.test(frontmatter[1])) error(`skill ${name}: missing description`);
  ok(`skill: ${name}`);
}

const mcpFile = join(harness, 'mcp', 'servers.json');
if (existsSync(mcpFile)) {
  try {
    const mcp = JSON.parse(await readText(mcpFile));
    if (!mcp || typeof mcp !== 'object' || Array.isArray(mcp)) {
      error('.harness/mcp/servers.json must be a JSON object');
    } else if (!mcp.servers || typeof mcp.servers !== 'object' || Array.isArray(mcp.servers)) {
      error('.harness/mcp/servers.json must contain object field "servers"');
    } else {
      ok('mcp: servers.json');
    }
  } catch (cause) {
    error(`.harness/mcp/servers.json invalid JSON: ${cause.message}`);
  }
}

const templateRoot = join(harness, 'templates', 'change-template');
if (existsSync(templateRoot)) {
  for (const rel of expectedChangeFiles) {
    const abs = join(templateRoot, rel);
    if (existsSync(abs)) ok(`template: ${rel}`);
    else error(`missing template file: .harness/templates/change-template/${rel}`);
  }
  const summaryTemplate = join(templateRoot, 'summary.md');
  if (existsSync(summaryTemplate)) {
    const text = await readText(summaryTemplate);
    for (const token of ['{{CHANGE_ID}}', '{{TYPE}}', '{{DATE}}']) {
      if (!text.includes(token)) error(`template summary.md missing token ${token}`);
    }
  }
}

const changeRoot = join(harness, 'changes');
if (existsSync(changeRoot)) {
  const entries = await readdir(changeRoot, { withFileTypes: true });
  for (const entry of entries.filter((item) => item.isDirectory())) {
    const summary = join(changeRoot, entry.name, 'summary.md');
    if (!existsSync(summary)) {
      error(`change ${entry.name}: missing summary.md`);
      continue;
    }

    const text = await readText(summary);
    const changeId = extractSummaryField(text, 'Change ID');
    const status = extractSummaryField(text, 'Status');
    const created = extractSummaryField(text, 'Created');
    if (changeId !== entry.name) error(`change ${entry.name}: summary Change ID mismatch (${changeId ?? 'missing'})`);
    if (!status || !allowedChangeStatuses.has(status)) {
      error(`change ${entry.name}: invalid Status (${status ?? 'missing'})`);
    }
    if (!created || !/^\d{8}$/.test(created)) error(`change ${entry.name}: Created must be YYYYMMDD`);

    for (const stageLine of text.matchAll(/^\|\s*\d+\s*\|\s*[^|]+\|\s*([^|]+?)\s*\|/gm)) {
      const stageStatus = stageLine[1].trim();
      if (!allowedStageStatuses.has(stageStatus)) {
        error(`change ${entry.name}: invalid stage status ${stageStatus}`);
      }
    }

    const todoCount = (text.match(/\bTODO\b/g) ?? []).length;
    const isDelivered = status === 'DELIVERED';
    const summaryStat = await stat(summary);
    const ageDays = (Date.now() - summaryStat.mtimeMs) / 86_400_000;
    if (todoCount > 0 && ageDays > 14) {
      warn(`change ${entry.name}: ${todoCount} TODO item(s), inactive ${ageDays.toFixed(0)}d`);
    }

    if (isDelivered) {
      for (const rel of expectedChangeFiles) {
        if (!existsSync(join(changeRoot, entry.name, rel))) {
          error(`change ${entry.name}: DELIVERED missing stage file ${rel}`);
        }
      }

      const placeholders = [];
      async function scanDeliveredChange(dir) {
        const items = await readdir(dir, { withFileTypes: true });
        for (const item of items) {
          const path = join(dir, item.name);
          if (item.isDirectory()) {
            await scanDeliveredChange(path);
            continue;
          }
          if (!item.name.endsWith('.md')) continue;
          const body = await readText(path);
          if (/\bTBD\b|\bPENDING\b|\{\{[A-Z_]+\}\}/.test(body)) {
            placeholders.push(path.replace(root, '').replace(/^[/\\]/, ''));
          }
        }
      }
      await scanDeliveredChange(join(changeRoot, entry.name));
      if (placeholders.length > 0) {
        error(`change ${entry.name}: DELIVERED but contains placeholders: ${placeholders.join(', ')}`);
      }
    }

    ok(`change: ${entry.name}`);
  }
}

const packageFile = join(root, 'package.json');
if (existsSync(packageFile)) {
  const pkg = JSON.parse(await readText(packageFile));
  if (pkg.scripts?.['harness:doctor'] !== 'node scripts/harness-doctor.mjs') {
    error('package.json script harness:doctor must run node scripts/harness-doctor.mjs');
  }
  if (pkg.scripts?.['harness:new-change'] !== 'node scripts/new-change.mjs') {
    error('package.json script harness:new-change must run node scripts/new-change.mjs');
  }
  if (!/\b3002\b/.test(pkg.scripts?.dev ?? '')) error('package.json script dev must bind port 3002');
  if (!/\b3050\b/.test(pkg.scripts?.start ?? '')) error('package.json script start must bind port 3050');
  if (/\b3001\b/.test(`${pkg.scripts?.dev ?? ''} ${pkg.scripts?.start ?? ''}`)) {
    error('package.json dev/start scripts must not bind forbidden port 3001');
  }
}

console.log('');
if (errors > 0) {
  console.error(`harness-doctor: ${errors} error(s), ${warnings} warning(s)`);
  process.exit(1);
}

console.log(`harness-doctor: 0 errors, ${warnings} warning(s)`);

#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const harness = join(root, '.harness');

let errors = 0;
let warnings = 0;

function ok(message) {
  console.log(`✓ ${message}`);
}

function warn(message) {
  warnings += 1;
  console.warn(`! ${message}`);
}

function error(message) {
  errors += 1;
  console.error(`✗ ${message}`);
}

const required = [
  'AGENTS.md',
  'CLAUDE.md',
  'README.md',
  'docs/HARNESS-USAGE-GUIDE.md',
  'docs/AUTHORING-GUIDE.md',
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
  const isRootFile = rel === 'AGENTS.md' || rel === 'CLAUDE.md' || rel === 'README.md' || rel.startsWith('docs/');
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
  const text = await readFile(abs, 'utf8');
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
  const text = await readFile(skillFile, 'utf8');
  const frontmatter = text.match(/^---\n([\s\S]+?)\n---/);
  if (!frontmatter) {
    error(`skill ${name}: missing YAML frontmatter`);
    continue;
  }
  if (!/^name:\s*\S+/m.test(frontmatter[1])) error(`skill ${name}: missing name`);
  if (!/^description:\s*\S+/m.test(frontmatter[1])) {
    error(`skill ${name}: missing description`);
  }
  ok(`skill: ${name}`);
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
    const text = await readFile(summary, 'utf8');
    const todoCount = (text.match(/\bTODO\b/g) ?? []).length;
    const isDelivered = /\|\s*Status\s*\|\s*DELIVERED\s*\|/i.test(text);
    const summaryStat = await stat(summary);
    const ageDays = (Date.now() - summaryStat.mtimeMs) / 86_400_000;
    if (todoCount > 0 && ageDays > 14) {
      warn(`change ${entry.name}: ${todoCount} TODO item(s), inactive ${ageDays.toFixed(0)}d`);
    }
    if (isDelivered) {
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
          const body = await readFile(path, 'utf8');
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
  const pkg = JSON.parse(await readFile(packageFile, 'utf8'));
  if (!pkg.scripts?.['harness:doctor']) warn('package.json missing script harness:doctor');
  if (!pkg.scripts?.['harness:new-change']) warn('package.json missing script harness:new-change');
}

console.log('');
if (errors > 0) {
  console.error(`harness-doctor: ${errors} error(s), ${warnings} warning(s)`);
  process.exit(1);
}

console.log(`harness-doctor: 0 errors, ${warnings} warning(s)`);

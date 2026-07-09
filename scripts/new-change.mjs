#!/usr/bin/env node
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const harness = join(root, '.harness');

const [, , rawType, ...nameParts] = process.argv;
const type = rawType ?? 'chore';
const rawName = nameParts.join(' ');

if (!rawName.trim()) {
  console.error('Usage: node scripts/new-change.mjs <type> <short name>');
  console.error('Example: node scripts/new-change.mjs chore project-harness');
  process.exit(1);
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function yyyymmdd(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

const date = yyyymmdd(new Date());
const changeId = `${slugify(type)}-${slugify(rawName)}-${date}`;
const template = join(harness, 'templates', 'change-template');
const target = join(harness, 'changes', changeId);

if (!existsSync(template)) {
  console.error(`Missing template: ${template}`);
  process.exit(1);
}

if (existsSync(target)) {
  console.error(`Change already exists: .harness/changes/${changeId}`);
  process.exit(1);
}

await mkdir(dirname(target), { recursive: true });
await cp(template, target, { recursive: true });

async function renderFile(rel) {
  const file = join(target, rel);
  if (!existsSync(file)) return;
  const text = await readFile(file, 'utf8');
  await writeFile(
    file,
    text
      .replaceAll('{{CHANGE_ID}}', changeId)
      .replaceAll('{{TYPE}}', type)
      .replaceAll('{{DATE}}', date),
    'utf8',
  );
}

await Promise.all([
  renderFile('summary.md'),
  renderFile('request_analysis/spec.md'),
  renderFile('request_analysis/tasks.md'),
  renderFile('ci_result/ci_summary.md'),
]);

console.log(`Created .harness/changes/${changeId}`);

#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ignoredDirs = new Set(['.git', '.next', 'node_modules', 'coverage', 'test-results', 'playwright-report']);
const ignoredFiles = new Set([path.normalize('scripts/guard-domain-boundary.mjs')]);

const forbiddenContent = [
  'vam_sync',
  'vam_sjb',
  'VAM_',
  'GLNZ',
  'SJB',
  'VAM Studio',
  'VAM_Studio',
  'VamBox',
  'VAM_STUDIO_URL',
];

const forbiddenName = [/vam/i, /glnz/i, /sjb/i];
const textExtensions = new Set([
  '.css',
  '.csv',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.mts',
  '.py',
  '.sh',
  '.ts',
  '.tsx',
  '.txt',
  '.yml',
  '.yaml',
]);

const findings = [];

function relative(filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function shouldIgnore(rel) {
  const normalized = path.normalize(rel);
  if (ignoredFiles.has(normalized)) return true;
  return rel.split('/').some((part) => ignoredDirs.has(part));
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const filePath = path.join(dir, entry);
    const rel = relative(filePath);
    if (shouldIgnore(rel)) continue;

    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      if (forbiddenName.some((pattern) => pattern.test(entry))) {
        findings.push(`${rel}: forbidden VAM-related directory name`);
      }
      walk(filePath);
      continue;
    }

    if (!stats.isFile()) continue;

    if (forbiddenName.some((pattern) => pattern.test(entry))) {
      findings.push(`${rel}: forbidden VAM-related file name`);
    }

    if (!textExtensions.has(path.extname(entry))) continue;

    const text = readFileSync(filePath, 'utf8');
    for (const token of forbiddenContent) {
      if (text.includes(token)) {
        findings.push(`${rel}: forbidden content token ${JSON.stringify(token)}`);
      }
    }
  }
}

walk(root);

if (findings.length > 0) {
  console.error('Frontend domain boundary guard failed. VAM artifacts must live in D:/AI/VAM_Character_Studio.');
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log('Frontend domain boundary guard passed: no VAM artifacts found.');

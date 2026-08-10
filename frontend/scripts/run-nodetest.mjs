#!/usr/bin/env node
// Runs node:test suites by profile name. The glob patterns live here, not as
// literal quoted strings in package.json scripts — knip's script parser
// (dist/binaries/bash-parser.js) extracts any file-glob-looking argument from
// package.json script text unconditionally (not gated by any "<plugin>": false
// toggle) and registers it as an entry, which made every *.nodetest.ts/*.itest.ts
// file under these globs look "reachable" to knip.production-reachability.json
// regardless of whether anything in src/app actually imports it.
import { globSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const PROFILES = {
  node: { patterns: ['src/**/*.nodetest.ts', 'src/**/*.itest.ts'], runner: 'tsx' },
  core: { patterns: ['src/core/courtos/**/*.nodetest.ts'], runner: 'tsx' },
  evals: { patterns: ['src/core/courtos/evals/*.nodetest.ts'], runner: 'tsx' },
  'mvp-api': { patterns: ['src/core/courtos/persistence/*.nodetest.ts'], runner: 'tsx' },
};

const profileName = process.argv[2];
const profile = PROFILES[profileName];
if (!profile) {
  console.error(`Usage: node scripts/run-nodetest.mjs <${Object.keys(PROFILES).join('|')}>`);
  process.exit(1);
}

const files = profile.patterns.flatMap((pattern) => globSync(pattern));
if (files.length === 0) {
  console.error(`No files matched for profile "${profileName}": ${profile.patterns.join(', ')}`);
  process.exit(1);
}

const result =
  profile.runner === 'tsx'
    ? spawnSync('npx', ['--yes', 'tsx', '--test', ...files], { stdio: 'inherit' })
    : spawnSync('node', ['--experimental-strip-types', '--test', ...files], { stdio: 'inherit' });

process.exit(result.status ?? 1);

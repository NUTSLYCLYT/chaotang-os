#!/usr/bin/env node
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  executionAuthorityScenePackV1CommandResult,
  loadExecutionAuthorityScenePackV1,
} from './lib/execution-authority-scene-pack-v1.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);

const modes = args.filter((arg) => ['--status', '--check', '--authorize'].includes(arg));
const mode = modes[0] ?? '--authorize';

let workPackage;
const extraArguments = [];
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (['--status', '--check', '--authorize'].includes(arg)) continue;
  if (arg === '--work-package') {
    workPackage = args[index + 1];
    index += 1;
    continue;
  }
  extraArguments.push(arg);
}

if (modes.length > 1 || extraArguments.length > 0) {
  console.error(
    'Usage: node scripts/execution-authority-scene-pack-v1.mjs --status|--check|--authorize [--work-package SCENE-PACK-V1]',
  );
  process.exit(64);
}

const loaded = await loadExecutionAuthorityScenePackV1(root);
const result = executionAuthorityScenePackV1CommandResult(loaded, mode, { workPackage });
console.log(JSON.stringify(result.output, null, 2));
process.exitCode = result.exitCode;

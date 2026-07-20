#!/usr/bin/env node
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  executionAuthorityCommandResult,
  loadExecutionAuthority,
} from './lib/execution-authority.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const mode = process.argv[2] ?? '--status';

if (!['--status', '--check', '--authorize'].includes(mode)) {
  console.error('Usage: node scripts/execution-authority.mjs --status|--check|--authorize');
  process.exit(64);
}

const loaded = await loadExecutionAuthority(root);
const result = executionAuthorityCommandResult(loaded, mode);
console.log(JSON.stringify(result.output, null, 2));
process.exit(result.exitCode);

#!/usr/bin/env node
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  executeExecutionAuthorityV2Command,
} from './lib/execution-authority-v2.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);

const modes = args.filter((arg) => ['--status', '--check', '--authorize'].includes(arg));
const mode = modes[0] ?? '--authorize';

let workPackage;
let realCustomerData = false;
const extraArguments = [];
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (['--status', '--check', '--authorize'].includes(arg)) continue;
  if (arg === '--work-package') {
    workPackage = args[index + 1];
    index += 1;
    continue;
  }
  if (arg === '--real-customer-data') {
    realCustomerData = true;
    continue;
  }
  extraArguments.push(arg);
}

if (modes.length > 1 || extraArguments.length > 0) {
  console.error(
    'Usage: node scripts/execution-authority-v2.mjs --status|--check|--authorize [--work-package <R0-Wxx>] [--real-customer-data]',
  );
  process.exit(64);
}

const result = await executeExecutionAuthorityV2Command(root, mode, extraArguments, {
  workPackage,
  realCustomerData,
});
console.log(JSON.stringify(result.output, null, 2));
process.exit(result.exitCode);

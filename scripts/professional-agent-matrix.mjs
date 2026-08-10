#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validateProfessionalAgentSchema,
  validateProfessionalAgentProvenance,
  verifyProfessionalAgentMatrix,
} from './lib/professional-agent-matrix.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, '.harness/manifest/professional-agent-asset-matrix.v1.json');
const schemaPath = join(root, '.harness/contracts/professional-agent-asset-matrix.v1.schema.json');
const convergencePath = join(root, '.harness/manifest/ext-branch-convergence.v1.json');
const schemaCheckerPath = join(root, 'scripts/professional_agent_matrix_schema_check.py');
const command = process.argv[2];

if (!['--check', '--print'].includes(command)) {
  console.log(JSON.stringify({ decision: 'STOP', reason: 'UNSUPPORTED_COMMAND' }));
  process.exitCode = 64;
} else {
  try {
    const [matrix, schema, convergence] = await Promise.all([
      readFile(manifestPath, 'utf8').then(JSON.parse),
      readFile(schemaPath, 'utf8').then(JSON.parse),
      readFile(convergencePath, 'utf8').then(JSON.parse),
    ]);
    const errors = [
      ...validateProfessionalAgentSchema(schema),
      ...validateProfessionalAgentProvenance(matrix, convergence),
      ...await verifyProfessionalAgentMatrix(matrix, root),
    ];
    const schemaResult = spawnSync(
      process.env.PYTHON3 || 'python3',
      [schemaCheckerPath, schemaPath, manifestPath],
      { cwd: root, encoding: 'utf8' },
    );
    if (schemaResult.status !== 0) {
      errors.push(`Draft 2020-12 validation failed: ${(schemaResult.stdout || schemaResult.stderr).trim()}`);
    }
    if (errors.length > 0) {
      console.log(JSON.stringify({ decision: 'FAIL', errors }, null, 2));
      process.exitCode = 1;
    } else if (command === '--print') {
      console.log(JSON.stringify(matrix, null, 2));
    } else {
      console.log(JSON.stringify({
        decision: 'PASS',
        matrixId: matrix.matrixId,
        canonicalOwner: matrix.canonicalOwner,
        assetCount: matrix.assets.length,
        verifiedAssets: matrix.assets.filter((asset) => asset.coverageStatus === 'VERIFIED').length,
        partialAssets: matrix.assets.filter((asset) => asset.coverageStatus === 'PARTIAL').length,
        inventoryCounts: Object.fromEntries(
          matrix.inventoryAssertions.map((assertion) => [assertion.id, assertion.expectedCount]),
        ),
      }));
    }
  } catch (error) {
    console.log(JSON.stringify({ decision: 'FAIL', reason: 'INVALID_MATRIX', detail: error.message }));
    process.exitCode = 1;
  }
}

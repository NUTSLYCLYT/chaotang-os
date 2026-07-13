#!/usr/bin/env node
import { generateKeyPairSync } from 'node:crypto';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { fingerprint } from './lib/release-evidence-ledger.mjs';
import { loadReleaseEvidenceTrust, releaseEvidencePaths } from './lib/release-evidence-gate.mjs';
import { verifyEvidenceLedger } from './lib/release-evidence-ledger.mjs';

function args(values) { const output = { _: [] }; for (let i = 0; i < values.length; i += 1) { const value = values[i]; if (!value.startsWith('--')) output._.push(value); else { const key = value.slice(2); if (!key || output[key] !== undefined || !values[i + 1] || values[i + 1].startsWith('--')) throw new Error(`invalid or duplicate --${key}`); output[key] = values[++i]; } } return output; }
const input = args(process.argv.slice(2)), command = input._[0], paths = releaseEvidencePaths(process.cwd());

if (command === 'provision-local') {
  if (input._.length !== 1 || Object.keys(input).some(key => !['_'].includes(key))) throw new Error('provision-local accepts no arguments');
  const pair = generateKeyPairSync('ed25519'), privatePem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), publicPem = pair.publicKey.export({ type: 'spki', format: 'pem' });
  mkdirSync(dirname(paths.localPrivateKeyPath), { recursive: true, mode: 0o700 });
  writeFileSync(paths.localPrivateKeyPath, privatePem, { mode: 0o600, flag: 'wx' }); chmodSync(paths.localPrivateKeyPath, 0o600);
  console.log(JSON.stringify({ schema_version: 1, key_id: 'chaotang-release-evidence-local-20260713', provider: 'local-protected-ed25519', public_key_pem: publicPem, public_key_fingerprint: fingerprint(publicPem), authority_mode: 'local-private-key', independent: false }, null, 2));
} else if (command === 'verify') {
  const trust = loadReleaseEvidenceTrust(process.cwd());
  const verified = verifyEvidenceLedger({ dbPath: paths.databasePath, anchorPath: paths.anchorPath, trust });
  console.log(JSON.stringify(verified, null, 2)); if (!verified.readyEligible) process.exitCode = 2;
} else throw new Error('usage: release-evidence.mjs provision-local | verify');

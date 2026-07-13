#!/usr/bin/env node
import { readFileSync, statSync } from 'node:fs';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

import { executeBreakGlass, loadBreakGlassTrust, verifyBreakGlassTicket } from './lib/recovery-control.mjs';

function args(raw) { const out = {}; for (let index = 0; index < raw.length; index += 1) if (raw[index].startsWith('--')) out[raw[index].slice(2)] = raw[++index]; return out; }
function readTicket(path) {
  const stat = statSync(path); if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600) throw new Error('ticket file must be owner-only mode 0600');
  return JSON.parse(readFileSync(path, 'utf8'));
}
export async function main(raw = process.argv.slice(2)) {
  const [command, ...rest] = raw, flags = args(rest), root = realpathSync(flags.cwd ?? process.cwd());
  if (!flags['ticket-file']) throw new Error('--ticket-file is required');
  const ticket = readTicket(flags['ticket-file']), trust = loadBreakGlassTrust(root), commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (command === 'verify') return verifyBreakGlassTicket({ ticket, trust, expectedCommit: commit, expectedReleaseId: flags.release ?? ticket.release_id });
  if (command !== 'execute') throw new Error('usage: harness-recovery.mjs verify|execute --ticket-file <0600-json> [--release id]');
  if (!flags.actor || !flags.reason || !flags.evidence || !flags.key) throw new Error('execute requires --actor --reason --evidence --key');
  if (flags.key !== ticket.operation?.resource_key) throw new Error('--key must equal the signed ticket operation resource');
  return executeBreakGlass({ ticket, expectedReleaseId: flags.release ?? ticket.release_id, actor: flags.actor, reason: flags.reason, evidence: flags.evidence }, { cwd: root });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(`STOP/${error.message}`); process.exitCode = 1; });

#!/usr/bin/env node
import { readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { portSocketOwners } from '../../scripts/lib/resource-lock.mjs';
import { resolveControlPlanePaths } from '../../scripts/lib/control-plane-db.mjs';
import { readAndVerifyBuildManifest } from '../../scripts/lib/release-evidence-ledger.mjs';

function within(path, root) { const rel = relative(root, path); return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)); }
function procIdentity(pid) {
  const stat = readFileSync(`/proc/${pid}/stat`, 'utf8'), tail = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
  return { pid: Number(pid), pgid: Number(tail[2]), start_ticks: Number(tail[19]), cwd: realpathSync(`/proc/${pid}/cwd`), exe: realpathSync(`/proc/${pid}/exe`), argv: readFileSync(`/proc/${pid}/cmdline`).toString().split('\0').filter(Boolean) };
}

/** Legacy classifier retained for callers while the strict identity gate is adopted. */
export function classifyProductionListenerOwnership(listener) {
  return listener && listener.sameRepo === false ? ['foreign_prod_3050'] : [];
}

export function inspectProductionRuntime(options = {}) {
  const adapter = process.env.NODE_ENV === 'test' && process.env.CHAOTANG_CONTROL_PLANE_TEST_ADAPTER === '1' && options.testAdapter === true;
  if ((options.port || options.runtimeRecord || options.buildRoot) && !adapter) throw new Error('runtime identity path/port overrides require explicit test adapter');
  const cwd = realpathSync(options.cwd ?? resolve(import.meta.dirname, '../..'));
  const defaults = resolveControlPlanePaths(cwd), port = options.port ?? 3050;
  const buildRoot = realpathSync(options.buildRoot ?? join(cwd, 'frontend', 'builds'));
  const runtimeRecord = options.runtimeRecord ?? join(defaults.runtimeDir, 'frontend-production-runtime.json');
  const owners = portSocketOwners(port);
  if (owners.length !== 1 || !owners[0].pid || !owners[0].inode) throw new Error(`STOP/runtime_identity_mismatch: expected one socket inode owner on ${port}`);
  let record; try { record = JSON.parse(readFileSync(runtimeRecord, 'utf8')); } catch { throw new Error('STOP/runtime_identity_mismatch: runtime record unreadable'); }
  const owner = owners[0], actual = procIdentity(owner.pid);
  if (owner.pgid !== actual.pgid || owner.start_ticks !== actual.start_ticks) throw new Error('STOP/runtime_identity_mismatch: socket owner process identity changed');
  if (actual.exe !== realpathSync(process.execPath) || !actual.argv.some(value => /(?:^|[/\\])next(?:\.js)?$|next[/\\]dist[/\\]bin[/\\]next/.test(value)) || !actual.argv.includes('start')) throw new Error('STOP/runtime_identity_mismatch: listener is not the expected Next production process');
  if (record.pid !== owner.pid || record.pgid !== actual.pgid || record.start_ticks !== actual.start_ticks || realpathSync(record.cwd) !== actual.cwd) throw new Error('STOP/runtime_identity_mismatch: recorded process is not socket owner');
  if (!within(actual.cwd, buildRoot) || actual.cwd === buildRoot) throw new Error('STOP/runtime_identity_mismatch: listener cwd is not a concrete immutable build directory');
  if (realpathSync(record.release_root) !== actual.cwd || realpathSync(record.runtime_dir) !== join(actual.cwd, 'next')) throw new Error('STOP/runtime_identity_mismatch: runtime build directory record mismatch');
  const build = readAndVerifyBuildManifest(actual.cwd, { cwd, requireHead: true });
  const confirmedOwners = portSocketOwners(port), confirmed = confirmedOwners.length === 1 ? confirmedOwners[0] : null;
  if (!confirmed || confirmed.pid !== owner.pid || confirmed.inode !== owner.inode || confirmed.pgid !== actual.pgid || confirmed.start_ticks !== actual.start_ticks) throw new Error('STOP/runtime_identity_mismatch: socket owner changed during artifact verification');
  return {
    schemaVersion: 1,
    releaseId: build.manifest.release_id,
    commit: build.manifest.commit,
    tree: build.manifest.tree,
    buildId: build.buildId,
    artifactDigest: `sha256:${build.artifact.digest}`,
    buildCommand: [...build.manifest.command],
    buildEnvironment: { ...build.manifest.env },
    dirtyTracked: build.provenance.dirtyTracked,
    releaseRoot: actual.cwd,
    runtimeDir: join(actual.cwd, 'next'),
    listener: { port, socketInode: owner.inode, fd: owner.fd, pid: owner.pid },
    process: actual,
  };
}

const invoked = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invoked) {
  try { console.log(JSON.stringify(inspectProductionRuntime(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 2; }
}

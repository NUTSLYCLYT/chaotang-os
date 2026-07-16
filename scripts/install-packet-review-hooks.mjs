#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {chmod, copyFile, lstat, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';

const DISPATCHER_MARKER = '# chaotang-pre-push-dispatcher-v1';
const TARGET_MARKER = '# chaotang-packet-review-local-feedback-v1';
const ASSET_MARKER = 'chaotang-packet-review-local-feedback-assets-v1\n';
const ASSET_DIR_NAME = 'chaotang-packet-review-local-feedback-v1';

async function pathStat(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw error;
  }
}

async function readManagedFile(path, marker, label) {
  const stat = await pathStat(path);
  if (!stat) return undefined;
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${label} is not a managed regular file`);
  }
  const current = await readFile(path, 'utf8');
  if (!current.split(/\r?\n/).includes(marker)) {
    throw new Error(`${label} does not contain the exact management marker`);
  }
  return current;
}

async function assertManagedAssetDirectory(path) {
  const stat = await pathStat(path);
  if (!stat) return false;
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error('verifier snapshot is not a managed directory');
  }
  const markerPath = join(path, '.managed');
  const markerStat = await pathStat(markerPath);
  if (!markerStat?.isFile() || markerStat.isSymbolicLink() || await readFile(markerPath, 'utf8') !== ASSET_MARKER) {
    throw new Error('verifier snapshot does not contain the exact management marker');
  }
  return true;
}

function runGit(args, cwd = process.cwd()) {
  return spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const rootResult = runGit(['rev-parse', '--show-toplevel']);
if (rootResult.status !== 0 || !rootResult.stdout.trim()) {
  console.error('[packet-review-hooks] not a Git worktree; STOP.');
  process.exit(1);
}
const root = rootResult.stdout.trim();
const hooksResult = runGit(['rev-parse', '--path-format=absolute', '--git-path', 'hooks'], root);
if (hooksResult.status !== 0 || !hooksResult.stdout.trim()) {
  console.error('[packet-review-hooks] cannot resolve hooks directory; STOP.');
  process.exit(1);
}

const hooks = hooksResult.stdout.trim();
const dispatcher = join(hooks, 'pre-push');
const dispatcherDir = join(hooks, 'pre-push.d');
const target = join(dispatcherDir, 'chaotang-packet-review');
const assetDir = join(hooks, ASSET_DIR_NAME);
const sourceCli = join(root, 'scripts', 'packet-review-pre-push.mjs');
const sourceVerifier = join(root, 'scripts', 'lib', 'packet-review-local-feedback.mjs');

if (process.argv.includes('--uninstall')) {
  try {
    const managedTarget = await readManagedFile(target, TARGET_MARKER, 'packet-review subhook');
    const managedAssets = await assertManagedAssetDirectory(assetDir);
    if (managedTarget) await rm(target, {force: true});
    if (managedAssets) await rm(assetDir, {recursive: true, force: true});
  } catch (error) {
    console.error(`[packet-review-hooks] ${error.message}; nothing was removed. STOP.`);
    process.exit(1);
  }
  const remaining = existsSync(dispatcherDir) ? await readdir(dispatcherDir) : [];
  if (remaining.length === 0 && await pathStat(dispatcher)) {
    try {
      if (await readManagedFile(dispatcher, DISPATCHER_MARKER, 'pre-push dispatcher')) {
        await rm(dispatcher, {force: true});
      }
    } catch (error) {
      console.error(`[packet-review-hooks] ${error.message}; dispatcher was preserved.`);
    }
  }
  console.log('[packet-review-hooks] managed local feedback subhook and snapshot removed; other hooks preserved.');
  process.exit(0);
}

if (!existsSync(sourceCli) || !existsSync(sourceVerifier)) {
  console.error('[packet-review-hooks] repository verifier sources are missing; STOP.');
  process.exit(1);
}

await mkdir(dispatcherDir, {recursive: true});
const dispatcherStat = await pathStat(dispatcher);
if (dispatcherStat) {
  let current;
  try {
    current = await readManagedFile(dispatcher, DISPATCHER_MARKER, 'pre-push dispatcher');
  } catch (error) {
    console.error(`[packet-review-hooks] ${error.message}; it was not overwritten. STOP.`);
    process.exit(1);
  }
  if (!current) {
    console.error('[packet-review-hooks] existing pre-push is not the Chaotang dispatcher; it was not overwritten. STOP.');
    process.exit(1);
  }
}
try {
  await readManagedFile(target, TARGET_MARKER, 'packet-review subhook');
  await assertManagedAssetDirectory(assetDir);
} catch (error) {
  console.error(`[packet-review-hooks] ${error.message}; it was not overwritten. STOP.`);
  process.exit(1);
}

if (!dispatcherStat) {
  await writeFile(dispatcher, `#!/bin/sh
${DISPATCHER_MARKER}
set -e
input_file=$(mktemp "${'${TMPDIR:-/tmp}'}/chaotang-pre-push.XXXXXX")
trap 'rm -f "$input_file"' 0 HUP INT TERM
cat > "$input_file"
for hook in "$(dirname "$0")/pre-push.d"/*; do
  [ -x "$hook" ] && "$hook" "$@" < "$input_file"
done
`, {mode: 0o755});
  await chmod(dispatcher, 0o755);
}

await mkdir(join(assetDir, 'lib'), {recursive: true});
await copyFile(sourceCli, join(assetDir, 'packet-review-pre-push.mjs'));
await copyFile(sourceVerifier, join(assetDir, 'lib', 'packet-review-local-feedback.mjs'));
await writeFile(join(assetDir, '.managed'), ASSET_MARKER, {mode: 0o600});

await writeFile(target, `#!/bin/sh
${TARGET_MARKER}
# LOCAL_FEEDBACK_ONLY: bypassable with git push --no-verify; not a security boundary.
set -e
hook_root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
exec node "$hook_root/${ASSET_DIR_NAME}/packet-review-pre-push.mjs" "$@"
`, {mode: 0o755});
await chmod(target, 0o755);

console.log(`[packet-review-hooks] installed ${target}`);
console.log('[packet-review-hooks] LOCAL_FEEDBACK_ONLY; external required check is not configured.');

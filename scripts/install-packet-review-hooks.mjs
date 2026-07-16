#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {chmod, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';

const DISPATCHER_MARKER = '# chaotang-pre-push-dispatcher-v1';
const TARGET_MARKER = '# chaotang-packet-review-local-feedback-v1';
const ASSET_MARKER = 'chaotang-packet-review-local-feedback-assets-v2\n';
const ASSET_DIR_NAME = 'chaotang-packet-review-local-feedback-v1';
const BUNDLE_PATTERN = /^bundle-[0-9a-f]{64}$/;

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
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) {
    throw new Error(`${label} is not a singly linked managed regular file`);
  }
  const current = await readFile(path, 'utf8');
  if (!current.split(/\r?\n/).includes(marker)) {
    throw new Error(`${label} does not contain the exact management marker`);
  }
  return current;
}

function assertExactEntries(actual, expected, label) {
  const actualSorted = [...actual].sort();
  const expectedSorted = [...expected].sort();
  if (JSON.stringify(actualSorted) !== JSON.stringify(expectedSorted)) {
    throw new Error(`${label} contents do not match the managed layout`);
  }
}

async function assertManagedRegularFile(path, label) {
  const stat = await pathStat(path);
  if (!stat?.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) {
    throw new Error(`${label} is not a singly linked managed regular file`);
  }
  return stat;
}

function bundleName(cli, core) {
  const digest = createHash('sha256')
    .update('packet-review-cli\0')
    .update(cli)
    .update('\0packet-review-core\0')
    .update(core)
    .digest('hex');
  return `bundle-${digest}`;
}

async function assertManagedBundle(path, expectedName) {
  const stat = await pathStat(path);
  if (!stat?.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`verifier ${expectedName} is not a managed directory`);
  }
  assertExactEntries(await readdir(path), ['lib', 'packet-review-pre-push.mjs'], `verifier ${expectedName}`);
  const cliPath = join(path, 'packet-review-pre-push.mjs');
  const corePath = join(path, 'lib', 'packet-review-local-feedback.mjs');
  await assertManagedRegularFile(cliPath, `verifier ${expectedName} CLI`);
  const lib = join(path, 'lib');
  const libStat = await pathStat(lib);
  if (!libStat?.isDirectory() || libStat.isSymbolicLink()) {
    throw new Error(`verifier ${expectedName} lib is not a managed directory`);
  }
  assertExactEntries(await readdir(lib), ['packet-review-local-feedback.mjs'], `verifier ${expectedName} lib`);
  await assertManagedRegularFile(corePath, `verifier ${expectedName} core`);
  const actualName = bundleName(await readFile(cliPath), await readFile(corePath));
  if (actualName !== expectedName) throw new Error(`verifier ${expectedName} content digest does not match its name`);
}

async function assertManagedAssetDirectory(path) {
  const stat = await pathStat(path);
  if (!stat) return false;
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error('verifier snapshot is not a managed directory');
  }
  assertExactEntries(await readdir(path), ['.managed', 'bundles', 'current'], 'verifier snapshot');
  const markerPath = join(path, '.managed');
  await assertManagedRegularFile(markerPath, 'verifier snapshot marker');
  if (await readFile(markerPath, 'utf8') !== ASSET_MARKER) {
    throw new Error('verifier snapshot does not contain the exact management marker');
  }
  const currentPath = join(path, 'current');
  await assertManagedRegularFile(currentPath, 'verifier snapshot current pointer');
  const currentBytes = await readFile(currentPath, 'utf8');
  if (!/^bundle-[0-9a-f]{64}\n$/.test(currentBytes)) {
    throw new Error('verifier snapshot current pointer is invalid');
  }
  const current = currentBytes.trim();
  const bundles = join(path, 'bundles');
  const bundlesStat = await pathStat(bundles);
  if (!bundlesStat?.isDirectory() || bundlesStat.isSymbolicLink()) {
    throw new Error('verifier snapshot bundles is not a managed directory');
  }
  const entries = (await readdir(bundles)).sort();
  if (entries.length === 0 || entries.some(entry => !BUNDLE_PATTERN.test(entry))) {
    throw new Error('verifier snapshot bundles contain an unmanaged entry');
  }
  for (const entry of entries) await assertManagedBundle(join(bundles, entry), entry);
  if (!entries.includes(current)) throw new Error('verifier snapshot current bundle is missing');
  return {current, bundles: entries};
}

async function createImmutableBundle({hooks, bundlesDir, cli, core}) {
  const name = bundleName(cli, core);
  const destination = join(bundlesDir, name);
  if (await pathStat(destination)) {
    await assertManagedBundle(destination, name);
    return name;
  }
  const staging = await mkdtemp(join(hooks, `.${ASSET_DIR_NAME}.bundle-next-`));
  let moved = false;
  try {
    await mkdir(join(staging, 'lib'));
    await writeFile(join(staging, 'packet-review-pre-push.mjs'), cli);
    await writeFile(join(staging, 'lib', 'packet-review-local-feedback.mjs'), core);
    await assertManagedBundle(staging, name);
    await rename(staging, destination);
    moved = true;
  } finally {
    if (!moved) await rm(staging, {recursive: true, force: true});
  }
  return name;
}

async function atomicWriteFile(destination, content, mode, temporaryRoot) {
  const temporary = join(temporaryRoot, `.chaotang-packet-review-file-next-${randomUUID()}`);
  try {
    await writeFile(temporary, content, {mode});
    await chmod(temporary, mode);
    await rename(temporary, destination);
  } finally {
    await rm(temporary, {force: true});
  }
}

async function installManagedAssetBundle({hooks, assetDir, existing, cli, core}) {
  if (!existing) {
    const staging = await mkdtemp(join(hooks, `.${ASSET_DIR_NAME}.root-next-`));
    let moved = false;
    try {
      const bundlesDir = join(staging, 'bundles');
      await mkdir(bundlesDir);
      const current = await createImmutableBundle({hooks, bundlesDir, cli, core});
      await writeFile(join(staging, 'current'), `${current}\n`, {mode: 0o600});
      await writeFile(join(staging, '.managed'), ASSET_MARKER, {mode: 0o600});
      await assertManagedAssetDirectory(staging);
      await rename(staging, assetDir);
      moved = true;
    } finally {
      if (!moved) await rm(staging, {recursive: true, force: true});
    }
    return;
  }

  const current = await createImmutableBundle({
    hooks,
    bundlesDir: join(assetDir, 'bundles'),
    cli,
    core,
  });
  if (current !== existing.current) {
    await atomicWriteFile(join(assetDir, 'current'), `${current}\n`, 0o600, hooks);
  }
  await assertManagedAssetDirectory(assetDir);
}

async function readSourceFile(path, label) {
  const stat = await pathStat(path);
  if (!stat?.isFile() || stat.isSymbolicLink()) throw new Error(`${label} is not a regular source file`);
  return readFile(path);
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

let sourceCliBytes;
let sourceVerifierBytes;
try {
  sourceCliBytes = await readSourceFile(sourceCli, 'repository verifier CLI');
  sourceVerifierBytes = await readSourceFile(sourceVerifier, 'repository verifier core');
} catch (error) {
  console.error(`[packet-review-hooks] ${error.message}; STOP.`);
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
let managedAssets;
try {
  await readManagedFile(target, TARGET_MARKER, 'packet-review subhook');
  managedAssets = await assertManagedAssetDirectory(assetDir);
} catch (error) {
  console.error(`[packet-review-hooks] ${error.message}; it was not overwritten. STOP.`);
  process.exit(1);
}

if (!dispatcherStat) {
  await atomicWriteFile(dispatcher, `#!/bin/sh
${DISPATCHER_MARKER}
set -e
input_file=$(mktemp "${'${TMPDIR:-/tmp}'}/chaotang-pre-push.XXXXXX")
trap 'rm -f "$input_file"' 0 HUP INT TERM
cat > "$input_file"
for hook in "$(dirname "$0")/pre-push.d"/*; do
  [ -x "$hook" ] && "$hook" "$@" < "$input_file"
done
`, 0o755, hooks);
}

await installManagedAssetBundle({
  hooks,
  assetDir,
  existing: managedAssets,
  cli: sourceCliBytes,
  core: sourceVerifierBytes,
});

await atomicWriteFile(target, `#!/bin/sh
${TARGET_MARKER}
# LOCAL_FEEDBACK_ONLY: bypassable with git push --no-verify; not a security boundary.
set -e
hook_root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
asset_root="$hook_root/${ASSET_DIR_NAME}"
bundle=$(cat "$asset_root/current")
exec node "$asset_root/bundles/$bundle/packet-review-pre-push.mjs" "$@"
`, 0o755, hooks);

console.log(`[packet-review-hooks] installed ${target}`);
console.log('[packet-review-hooks] LOCAL_FEEDBACK_ONLY; external required check is not configured.');

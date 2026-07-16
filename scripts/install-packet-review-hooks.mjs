#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {chmod, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';

const DISPATCHER_MARKER = '# chaotang-pre-push-dispatcher-v1';
const TARGET_MARKER = '# chaotang-packet-review-local-feedback-v1';

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

if (process.argv.includes('--uninstall')) {
  if (existsSync(target)) await rm(target, {force: true});
  const remaining = existsSync(dispatcherDir) ? await readdir(dispatcherDir) : [];
  if (existsSync(dispatcher)) {
    const current = await readFile(dispatcher, 'utf8');
    if (current.includes(DISPATCHER_MARKER) && remaining.length === 0) await rm(dispatcher, {force: true});
  }
  console.log('[packet-review-hooks] local feedback subhook removed; other hooks preserved.');
  process.exit(0);
}

if (!existsSync(join(root, 'scripts', 'packet-review-pre-push.mjs'))) {
  console.error('[packet-review-hooks] repository CLI scripts/packet-review-pre-push.mjs is missing; STOP.');
  process.exit(1);
}

await mkdir(dispatcherDir, {recursive: true});
if (existsSync(dispatcher)) {
  const current = await readFile(dispatcher, 'utf8');
  if (!current.includes(DISPATCHER_MARKER)) {
    console.error('[packet-review-hooks] existing pre-push is not the Chaotang dispatcher; it was not overwritten. STOP.');
    process.exit(1);
  }
}
if (existsSync(target)) {
  const current = await readFile(target, 'utf8');
  if (!current.includes(TARGET_MARKER)) {
    console.error('[packet-review-hooks] existing packet-review subhook is unmanaged; it was not overwritten. STOP.');
    process.exit(1);
  }
}

if (!existsSync(dispatcher)) {
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

await writeFile(target, `#!/bin/sh
${TARGET_MARKER}
# LOCAL_FEEDBACK_ONLY: bypassable with git push --no-verify; not a security boundary.
set -e
root=$(git rev-parse --show-toplevel)
exec node "$root/scripts/packet-review-pre-push.mjs" "$@"
`, {mode: 0o755});
await chmod(target, 0o755);

console.log(`[packet-review-hooks] installed ${target}`);
console.log('[packet-review-hooks] LOCAL_FEEDBACK_ONLY; external required check is not configured.');

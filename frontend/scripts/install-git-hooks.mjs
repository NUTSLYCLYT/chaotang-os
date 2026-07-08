#!/usr/bin/env node
import { chmod, copyFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const gitRoot = spawnSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
});

if (gitRoot.status !== 0) {
  console.log('[install-git-hooks] not a git worktree, skipped.');
  process.exit(0);
}

const root = gitRoot.stdout.trim();
const sourceDir = join(root, 'scripts', 'git-hooks');
const targetDir = join(root, '.git', 'hooks');

if (!existsSync(sourceDir) || !existsSync(join(root, '.git'))) {
  console.log('[install-git-hooks] hook source or .git missing, skipped.');
  process.exit(0);
}

await mkdir(targetDir, { recursive: true });

const hooks = await readdir(sourceDir);
for (const hook of hooks) {
  const source = join(sourceDir, hook);
  const target = join(targetDir, hook);
  await copyFile(source, target);
  await chmod(target, 0o755);
}

console.log(`[install-git-hooks] installed: ${hooks.join(' ')}`);

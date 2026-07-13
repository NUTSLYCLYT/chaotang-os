#!/usr/bin/env node
import { chmod, copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
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
// 2026-07-12 修复：monorepo 合并前这个脚本本来就在仓库根、`scripts/git-hooks` 也在
// 仓库根，路径是对的；合并后这个脚本(和它要装的 hooks)都搬进了 frontend/ 下，这一行
// 没跟着改——`<repo-root>/scripts/git-hooks` 从来不存在，`existsSync` 检查静默跳过
// 安装，导致这个仓库的 git hooks(冲突标记守卫等)自合并那天起就从没真正装进
// .git/hooks/ 成功跑过一次。
const sourceDir = join(root, 'frontend', 'scripts', 'git-hooks');
const gitHooks = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-path', 'hooks'], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
});
if (gitHooks.status !== 0 || !gitHooks.stdout.trim()) {
  console.error('[install-git-hooks] cannot resolve hooks directory.');
  process.exit(1);
}
const targetDir = gitHooks.stdout.trim();
const dispatcher = join(targetDir, 'pre-commit');
const dispatcherDir = join(targetDir, 'pre-commit.d');
const marker = '# chaotang-hook-dispatcher-v1';

if (!existsSync(sourceDir)) {
  console.log('[install-git-hooks] hook source missing, skipped.');
  process.exit(0);
}

await mkdir(dispatcherDir, { recursive: true });

if (existsSync(dispatcher)) {
  const current = await readFile(dispatcher, 'utf8');
  if (!current.includes(marker)) {
    const managedSource = await readFile(join(sourceDir, 'pre-commit'), 'utf8');
    if (current !== managedSource) {
      console.error('[install-git-hooks] existing pre-commit is not the Chaotang dispatcher; STOP.');
      process.exit(1);
    }
  }
}

if (!existsSync(dispatcher) || !(await readFile(dispatcher, 'utf8')).includes(marker)) {
  await writeFile(dispatcher, `#!/bin/sh\n${marker}\nset -e\nfor hook in "$(dirname "$0")/pre-commit.d"/*; do [ -x "$hook" ] && "$hook"; done\n`, { mode: 0o755 });
  await chmod(dispatcher, 0o755);
}

const hooks = await readdir(sourceDir);
for (const hook of hooks) {
  const source = join(sourceDir, hook);
  const target = hook === 'pre-commit' ? join(dispatcherDir, 'chaotang-frontend') : join(targetDir, hook);
  await copyFile(source, target);
  await chmod(target, 0o755);
}

console.log(`[install-git-hooks] installed: ${hooks.join(' ')}`);

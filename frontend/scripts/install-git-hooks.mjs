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
// 2026-07-12 修复：monorepo 合并前这个脚本本来就在仓库根、`scripts/git-hooks` 也在
// 仓库根，路径是对的；合并后这个脚本(和它要装的 hooks)都搬进了 frontend/ 下，这一行
// 没跟着改——`<repo-root>/scripts/git-hooks` 从来不存在，`existsSync` 检查静默跳过
// 安装，导致这个仓库的 git hooks(冲突标记守卫等)自合并那天起就从没真正装进
// .git/hooks/ 成功跑过一次。
const sourceDir = join(root, 'frontend', 'scripts', 'git-hooks');
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

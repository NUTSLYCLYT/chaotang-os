#!/usr/bin/env node
/**
 * guard:dockerignore (2026-06-25 · 渗透审计 C2 红队回归 · 把"镜像不烘真数据/密钥"钉成 CI 硬门)。
 *
 * Dockerfile `COPY . .` + 无/残缺 .dockerignore → 把 data/*.local.json(真业务数据)、.env*(密钥)、
 * .git(全历史)烘进镜像层。一次镜像交接=泄密(国防客户不可容忍)。
 * 本 guard 断言 .dockerignore 覆盖这些必排除项;谁删了保护 → CI 红。
 *
 * 默认即阻断(exit 1):安全护栏不 warn-only。docker 装了的环境另可在 build 后 grep 镜像层兜底(见注)。
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(process.cwd(), '.dockerignore');

// 必须被排除的敏感项(渗透 C2):真数据 / 密钥 / git 历史 / 依赖。
const REQUIRED = [
  { name: '真数据快照', any: ['data', '*.local.json'] },
  { name: '密钥', any: ['.env', '.env.*', '.env*'] },
  { name: 'git 历史', any: ['.git'] },
  { name: 'node_modules', any: ['node_modules'] },
];

if (!existsSync(FILE)) {
  console.log('❌ guard:dockerignore — 缺 .dockerignore!`COPY . .` 会把真数据/密钥/git历史烘进镜像(渗透 C2)。');
  process.exit(1);
}

const lines = readFileSync(FILE, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));
const set = new Set(lines);

const missing = REQUIRED.filter((r) => !r.any.some((p) => set.has(p)));

if (missing.length === 0) {
  console.log('✅ guard:dockerignore — 真数据/密钥/git历史/依赖 均在排除项,镜像不烘敏感物(渗透 C2 已堵)。');
  process.exit(0);
}

console.log('❌ guard:dockerignore — .dockerignore 缺关键排除项(镜像会烘进敏感物·渗透 C2):');
for (const m of missing) console.log(`  ❗ 缺「${m.name}」(应含其一: ${m.any.join(' / ')})`);
console.log('（docker 装了的环境另建议 build 后: docker run img sh -c "ls /app/data; cat /app/.env*" 应为空。）');
process.exit(1);

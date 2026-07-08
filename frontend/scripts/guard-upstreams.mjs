#!/usr/bin/env node
/**
 * guard:upstreams (2026-06-24 · 融合地基 · 把"上游单一真相源"纪律变 CI)。
 *
 * 扫 src/ 里 `upstreams.ts` 之外的：
 *   ① 裸上游 env 读(process.env.{JIQUN_API_URL,JIQUN_BASE_URL,COURTOS_API_URL,INTERNAL_API_URL,
 *      LEGAL_AGENT_BASE_URL,OPENAI_BASE_URL}) —— 应改 import from '@/lib/upstreams'。
 *   ② 裸上游端口字面量(:8081 / :4000 / :18003 / :3000/api) —— 同。
 *
 * 默认 warn-only(exit 0):列出迁移面,不阻断既有蔓延。UPSTREAMS_STRICT=1 → 有命中即 exit 1(升阻断门)。
 * 与 guard:realdata / guard:honesty 同一招:把纪律钉成可见数字,逐步收敛。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const ALLOW = join(SRC, 'lib', 'upstreams.ts'); // 唯一真相源,豁免

const ENV_RE = /process\.env\.(JIQUN_API_URL|JIQUN_BASE_URL|COURTOS_API_URL|INTERNAL_API_URL|LEGAL_AGENT_BASE_URL|OPENAI_BASE_URL)\b/;
const PORT_RE = /(?:localhost|127\.0\.0\.1):(?:8081|4000|18003)\b|:3000\/api/;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const hits = [];
for (const file of walk(SRC)) {
  if (file === ALLOW) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return; // 跳注释
    const env = ENV_RE.exec(line);
    const port = PORT_RE.exec(line);
    if (env) hits.push({ file: relative(ROOT, file), line: i + 1, kind: 'env', hit: env[1] });
    else if (port) hits.push({ file: relative(ROOT, file), line: i + 1, kind: 'port', hit: port[0] });
  });
}

const strict = process.env.UPSTREAMS_STRICT === '1';
if (hits.length === 0) {
  console.log('✅ guard:upstreams — 无裸上游引用:所有上游 URL 都经 @/lib/upstreams 单一真相源。');
  process.exit(0);
}

const byFile = new Map();
for (const h of hits) byFile.set(h.file, (byFile.get(h.file) ?? 0) + 1);
console.log(`${strict ? '❌' : '⚠️ '} guard:upstreams — ${hits.length} 处裸上游引用,分布 ${byFile.size} 文件(应迁 @/lib/upstreams):`);
for (const h of hits.slice(0, 40)) {
  console.log(`  ${h.file}:${h.line}  [${h.kind}] ${h.hit}`);
}
if (hits.length > 40) console.log(`  …还有 ${hits.length - 40} 处`);
console.log('（融合地基:这是 courtos 遗物拆除 + 上游收口的迁移面。逐文件 import from @/lib/upstreams,courtos 调用一律经 courtosFetch。）');
process.exit(strict ? 1 : 0);

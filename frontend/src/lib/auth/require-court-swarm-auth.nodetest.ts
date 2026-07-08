/**
 * 防回归门(2026-07-06 独立会审 CRITICAL 修复的锁)。
 *
 * schneier:任何调 dispatchDeptToSwarm(内注 admin token 打后端蜂群)的 route,
 * 都必须先过 requireCourtSwarmAuth——否则匿名可烧钱 + admin 提权。把这条钉成源码 tripwire,
 * 下个人新加 dept 派发 route 忘了装锁,CI 当场红。御史 chaotang-censor.sh 3e 节有同款巡查。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

test('每个调 dispatchDeptToSwarm 的 route 都过 requireCourtSwarmAuth 守门', () => {
  // 只认 app/**/route.ts(真 HTTP 入口);page.tsx 等注释引用不算派发点。
  const out = execSync(
    "grep -rl dispatchDeptToSwarm src/app --include=route.ts 2>/dev/null || true",
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  const routes = out.split('\n').map((s: string) => s.trim()).filter(Boolean);
  assert.ok(routes.length >= 4, `预期至少 4 个 dept 派发 route,实测 ${routes.length}——grep 可能坏了`);
  const naked = routes.filter((f: string) => !readFileSync(f, 'utf8').includes('requireCourtSwarmAuth'));
  assert.deepEqual(naked, [], `以下 route 调蜂群却没装守门(匿名烧钱+admin提权风险):\n${naked.join('\n')}`);
});

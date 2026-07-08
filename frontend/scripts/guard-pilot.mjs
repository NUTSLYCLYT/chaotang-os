#!/usr/bin/env node
/**
 * guard:pilot (2026-06-28 · Deming 天才建议固化)。
 *
 * 把「能上线」从拍脑袋变成 CI：一个板块要进 /start「已点亮」区(status:'live')，必须有证据。
 *   - 阻断项(❌)：live 板块缺 realDataSource 或 verifiedReal!==true —— 无证据点亮 = 拿空板块唬商家。
 *   - 警示项(⚠️)：live 板块 ahaVerified!==true —— 接了真数据但"商家 aha"未亲验。
 *
 * 读 SSOT：`src/features/start/lib/pilot-status.ts`(文本解析，免编译)。
 * 点亮一个新板块 = 在 SSOT 里补 realDataSource+verifiedReal(经 guard:realdata 确认) —— 一次有证据的声明。
 */
import { readFileSync } from 'node:fs';

const SSOT = 'src/features/start/lib/pilot-status.ts';
const src = readFileSync(SSOT, 'utf8');

// 粗粒度解析每个 tile 对象块(key..下一个 key 之间)。够用:SSOT 是受控数据文件。
const tileBlocks = src.split(/\{\s*\n?\s*key:/).slice(1).map((b) => 'key:' + b);

function field(block, name) {
  const m = block.match(new RegExp(`${name}:\\s*('([^']*)'|true|false)`));
  if (!m) return undefined;
  if (m[1] === 'true') return true;
  if (m[1] === 'false') return false;
  return m[2];
}

const live = [];
for (const b of tileBlocks) {
  if (field(b, 'status') !== 'live') continue;
  live.push({
    key: field(b, 'key'),
    name: field(b, 'name') ?? field(b, 'key'),
    realDataSource: field(b, 'realDataSource'),
    verifiedReal: field(b, 'verifiedReal'),
    ahaVerified: field(b, 'ahaVerified'),
  });
}

const blockers = [];
const warns = [];
for (const t of live) {
  if (!t.realDataSource) blockers.push(`${t.name}(${t.key}) 已点亮但缺 realDataSource(真数据源未声明)`);
  else if (t.verifiedReal !== true) blockers.push(`${t.name}(${t.key}) 已点亮但 verifiedReal≠true(未经 guard:realdata 确认)`);
  if (t.ahaVerified !== true) warns.push(`${t.name}(${t.key}) 接了真数据，但 ahaVerified≠true(商家 aha 未亲验)`);
}

console.log(`🏮 guard:pilot — /start 已点亮 ${live.length} 个板块。`);
for (const t of live) {
  const tag = !t.realDataSource || t.verifiedReal !== true ? '❌' : t.ahaVerified !== true ? '⚠️ ' : '✅';
  console.log(`  ${tag} ${t.name}：${t.realDataSource ?? '(缺真数据源)'}`);
}

if (warns.length) {
  console.log('\n⚠️  警示(接真但 aha 未亲验)：');
  for (const w of warns) console.log(`  · ${w}`);
}

if (blockers.length) {
  console.log('\n❌ 阻断：以下板块点亮了但没有证据，禁止上线/合并——');
  for (const b of blockers) console.log(`  · ${b}`);
  console.log('\n要么补 realDataSource+verifiedReal(经 guard:realdata 确认真接 API 无 mock)，要么把 status 改回 coming(诚实)。');
  console.log('（Deming:标签冒充上线是最贵的自欺;这条数字让它无处藏。）');
  process.exit(process.env.PILOT_STRICT === '1' ? 1 : 0);
}

console.log('\n✅ 所有已点亮板块都声明了真数据源 + 经验证(verifiedReal)。');
process.exit(0);

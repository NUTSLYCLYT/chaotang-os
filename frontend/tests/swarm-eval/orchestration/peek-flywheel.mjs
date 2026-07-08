#!/usr/bin/env node
/**
 * peek-flywheel.mjs —— 一句命令偷看飞轮脑子里学到了什么 + 在不在转（测试仪表盘）。
 *
 * 用法：
 *   node tests/swarm-eval/orchestration/peek-flywheel.mjs            # 看 dev 文件库
 *   LEDGER_DB_URL=libsql://... TURSO_AUTH_TOKEN=... node ...peek...  # 看 prod/staging 的真库
 *
 * Charity Majors：测试全程开着它——counts 不涨 = 飞轮空转了，立刻停下查。
 */
import { createClient } from '@libsql/client';

const ENV = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
const url = process.env.LEDGER_DB_URL || process.env.TURSO_DB_URL || `file:./.chaotang-ledger-${ENV}.db`;
const db = createClient(url.startsWith('file:') ? { url } : { url, authToken: process.env.TURSO_AUTH_TOKEN });

const cnt = async (t) => { try { const { rows } = await db.execute('SELECT COUNT(*) n FROM ' + t); return Number(rows[0].n); } catch { return 'NA(表不存在)'; } };
const safe = async (sql) => { try { return (await db.execute(sql)).rows; } catch { return []; } };

console.log(`\n📊 飞轮仪表盘  ·  库: ${url.startsWith('file:') ? url : url.replace(/\/\/.*@/, '//***@')}`);
console.log('─'.repeat(60));
const bd = await cnt('boss_decisions'), bp = await cnt('boss_preferences'), cf = await cnt('conflict_field'), ad = await cnt('agent_decisions');
console.log(`决策台账 agent_decisions : ${ad}`);
console.log(`编排决策 boss_decisions  : ${bd}`);
console.log(`学到偏好 boss_preferences: ${bp}`);
console.log(`浓度场   conflict_field  : ${cf}`);

const reach = typeof bd === 'number';
const turning = reach && bd > 0;
console.log('\n' + (!reach ? '🔴 库不可达 —— 飞轮没在工作（测 prod 务必先接可写 Turso）'
  : !turning ? '🟡 库可达但 0 决策 —— 还没真实编排/签字（空转，待第一次真拍板）'
  : '🟢 飞轮在转。'));

if (turning) {
  console.log('\n👑 老板偏好（飞轮学到的）:');
  for (const p of await safe('SELECT edge,dept,count FROM boss_preferences ORDER BY count DESC'))
    console.log(`   ${p.edge} → 陛下选 ${p.dept} ${p.count} 次`);
  console.log('\n🐜 浓度场（反复冲突的真断层，浓度降序）:');
  for (const f of await safe('SELECT edge,round(strength,2) s FROM conflict_field ORDER BY strength DESC LIMIT 8'))
    console.log(`   ${f.edge} 浓度=${f.s}`);
  console.log('\n🔗 最近编排决策（哈希链）:');
  for (const d of await safe('SELECT id,escalated,outcome,chosen_dept,substr(hash,1,12) h FROM boss_decisions ORDER BY id DESC LIMIT 6'))
    console.log(`   #${d.id} 伏候圣裁=${d.escalated ? '是' : '否'} 拍板=${d.outcome || '未签'}${d.chosen_dept ? '(选' + d.chosen_dept + ')' : ''} hash=${d.h}…`);
  // 飞轮三问之③：可见的健康数字
  const signed = (await safe("SELECT COUNT(*) n FROM boss_decisions WHERE outcome IS NOT NULL AND outcome!=''"))[0]?.n ?? 0;
  console.log(`\n📈 flywheel_health: 回写率 ${signed}/${bd}（已签字/总编排）· 学到偏好边 ${bp} 条`);
}
console.log('');

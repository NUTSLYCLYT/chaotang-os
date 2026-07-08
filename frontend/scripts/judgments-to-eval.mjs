#!/usr/bin/env node
/**
 * 波1 周末量结果(2026-06-25 · 把真 judgment 变 eval 数字)。
 *
 * 读 data/decision-judgments.local.json(自用时点的👍/👎+一句) → 出波1三数:
 *   ① 帮到率 ② 判错样本(👎+哪不对,下一轮改的料) ③ 样本量(够20没)。
 * 这就是 panel 说的"真样本锚点"——把构造效度的 eval 钉上真实使用。
 *
 * 用法:node scripts/judgments-to-eval.mjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let items = [];
try {
  items = JSON.parse(readFileSync(join(process.cwd(), 'data', 'decision-judgments.local.json'), 'utf8'));
} catch {
  console.log('暂无真 judgment(data/decision-judgments.local.json 不存在)。先去上书房/大殿用起来,点👍/👎。');
  process.exit(0);
}

const n = items.length;
const helpful = items.filter((j) => j.helpful).length;
const rate = n ? Math.round((helpful / n) * 100) : 0;

console.log('═══ 波1 · 决策质量真样本 ═══');
console.log(`样本量: ${n} 条 ${n >= 20 ? '✅(够波1判据)' : `⏳(还差 ${20 - n} 条到 20)`}`);
console.log(`帮到率: ${rate}% ${rate >= 70 ? '✅(≥70 过判据)' : '⚠️(<70 未过)'}  [${helpful}👍 / ${n - helpful}👎]`);

const bad = items.filter((j) => !j.helpful && j.note);
if (bad.length) {
  console.log(`\n👎 判错样本(${bad.length} 条·下一轮改的料):`);
  for (const b of bad.slice(-15)) {
    console.log(`  · ${b.question.slice(0, 36)} → ${b.note}`);
  }
}

console.log('\n波1 判据回顾: 帮到率≥70% · 样本≥20 · 0假LIVE · loop 0崩 · 你愿继续用。');
console.log('过了 → 进波2(种子客户/安全渗透/jiqun点火);没过 → 看👎样本改,再用一周。');

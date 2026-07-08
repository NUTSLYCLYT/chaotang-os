#!/usr/bin/env node
/**
 * gate.mjs —— 严口径放行闸（大神会审 #1+#2，把"营销数字"换成"能力数字"）。
 *   #1 Karpathy：accuracy<4 一票否决（不看华丽辞藻友好的加权均分）。
 *   #2 number-verifier：数字接地率（grounded/total）必须 100%（有无依据数字即不放行）。
 * 用法：node gate.mjs   （读 scores/ 与 results/）
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const read = async (d, f) => JSON.parse(await readFile(join(HERE, d, f), 'utf8'));

const sf = (await readdir(join(HERE, 'scores'))).filter((f) => f.endsWith('.json'));
let wsum = 0, accPass = 0, groundPass = 0, both = 0;
const fails = [];
for (const f of sf) {
  const s = await read('scores', f);
  let g = null; try { g = await read('results', f); } catch {}
  const acc = s.dims.accuracy;
  const rate = g?.grounding?.rate ?? 1;
  wsum += s.weightedAvg;
  const accOk = acc >= 4, gOk = rate >= 1;
  if (accOk) accPass++; if (gOk) groundPass++; if (accOk && gOk) both++;
  if (!accOk || !gOk) fails.push(`${f.replace('__deep.json', '')}  acc=${acc}${accOk ? '' : '✗'} 接地=${(rate * 100).toFixed(0)}%${gOk ? '' : '✗'}`);
}
const n = sf.length;
console.log(`样本 ${n} 个`);
console.log(`加权均分(旧·营销口径):        ${(wsum / n).toFixed(2)}  🟢"好用"`);
console.log(`#1 accuracy≥4 一票否决 通过:  ${accPass}/${n}  = ${(accPass / n * 100).toFixed(0)}%`);
console.log(`#2 数字接地=100% 通过:        ${groundPass}/${n}  = ${(groundPass / n * 100).toFixed(0)}%`);
console.log(`严口径(两者都过) 真·放行率:   ${both}/${n}  = ${(both / n * 100).toFixed(0)}%  ← 能力数字`);
if (fails.length) { console.log('\n未过严口径（先修，不准放行）：'); fails.forEach((x) => console.log('  ✗', x)); }

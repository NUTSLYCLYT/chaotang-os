/**
 * 门下封驳红线 · 回归断言（源码 tripwire）
 *
 * 史脉：确定性门下闸 menxia-gate.ts 于 2026-06-28 清理退役（knip 零引用，已入 dev/_attic），
 * 门下语义演进为三省管线里的 LLM 驳议（court-pipeline.ts 阶段3）。红线本体没变，只是搬了家：
 *   1. fail-closed：门下 LLM 失败必须保守判「再议」，绝不放行；
 *   2. 非「准」不落地：尚书省执行只在 verdict === '准' 时发生；
 *   3. 门下是一枚印，不是笔不是秤：MenxiaReview 产出禁带 score / draft 字段。
 * 御史 chaotang-censor.sh 3e 节的治理红线哨兵与本测试互为表里（哨兵天天巡，本测试进 CI）。
 * 若本测试挡路：先确认你不是在弱化上述任一红线，再同步更新哨兵与本文件。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string): string => readFileSync(join(process.cwd(), rel), 'utf8');

test('门下 fail-closed：LLM 失败保守判再议，绝不放行', () => {
  const src = read('src/lib/orchestration/court-pipeline.ts');
  assert.match(src, /保守判再议/, 'court-pipeline 门下 catch 分支的保守再议兜底被移除');
  assert.match(src, /绝不放行/, 'court-pipeline 门下 fail-closed 注释红线被移除');
});

test('非「准」不落地：尚书省执行以 verdict === 准 为唯一闸', () => {
  const src = read('src/lib/orchestration/court-pipeline.ts');
  assert.match(src, /menxia\.verdict === '准'/, '尚书省落地不再以门下「准」为闸');
});

test('门下是印不是笔：MenxiaReview 禁带 score / draft 字段', () => {
  const src = read('src/features/governance/lib/three-chamber-engine.ts');
  const m = src.match(/export interface MenxiaReview \{[\s\S]*?\n\}/);
  if (!m) assert.fail('three-chamber-engine 里找不到 MenxiaReview interface');
  const block = m[0];
  assert.doesNotMatch(block, /\bscore\b/i, 'MenxiaReview 出现 score —— 门下退化成秤（那是军机处）');
  assert.doesNotMatch(block, /\bdraft\b/i, 'MenxiaReview 出现 draft —— 门下退化成笔（那是中书省）');
});

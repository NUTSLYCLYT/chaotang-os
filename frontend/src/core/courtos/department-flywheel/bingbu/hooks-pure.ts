// src/core/courtos/department-flywheel/bingbu/hooks-pure.ts
// 纯逻辑：selectCandidates + passesThreshold。无 @/ 值导入 → 可在 node --experimental-strip-types 下运行。
import type { SourceTask } from '../types.ts';
import { BINGBU_KEYWORDS } from './config.ts';

/** 从主库任务里筛兵部销售语义候选（关键词匹配）。 */
export function selectCandidates(tasks: SourceTask[]): SourceTask[] {
  return tasks.filter((t) => BINGBU_KEYWORDS.some((k) => `${t.title} ${t.command}`.includes(k)));
}

/**
 * 阈值门：比 selectCandidates 更严——关键词命中数 ≥2 才放行。
 * selectCandidates 只要求 ≥1（宽筛候选）；passesThreshold 要求 ≥2（明确商机语境）。
 * 两道闸真正递进，防止 selectCandidates 的候选 100% 穿透阈值门造成刷屏。
 */
export function passesThreshold(task: SourceTask): boolean {
  const text = `${task.title} ${task.command}`;
  const hitCount = BINGBU_KEYWORDS.filter((k) => text.includes(k)).length;
  return hitCount >= 2;
}

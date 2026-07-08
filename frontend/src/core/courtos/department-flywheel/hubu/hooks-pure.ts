// src/core/courtos/department-flywheel/hubu/hooks-pure.ts
// 纯逻辑：selectCandidates + passesThreshold。无 @/ 值导入 → 可在 node --experimental-strip-types 下运行。
import type { SourceTask } from '../types.ts';
import { HUBU_KEYWORDS, HUBU_MIN_BUDGET_YUAN } from './config.ts';

/** 本地 parseWan 副本（来自 hubu-engines，避免 @/ 值导入）。"80万" → 800000(元)；不可解析 → null。 */
function parseWan(s: string | null | undefined): number | null {
  if (!s) return null;
  const wan = s.match(/([\d.]+)\s*万/);
  if (wan) return Math.round(parseFloat(wan[1]) * 10000);
  const bare = s.trim().match(/^([\d.]+)$/);
  const n = bare ? parseFloat(bare[1]) : NaN;
  return Number.isFinite(n) ? n : null;
}

function extractBudget(text: string): string {
  return text.match(/([\d.]+\s*万)/)?.[1] ?? '—';
}

/** 从主库任务里筛户部语义候选（关键词匹配）。 */
export function selectCandidates(tasks: SourceTask[]): SourceTask[] {
  return tasks.filter((t) => HUBU_KEYWORDS.some((k) => `${t.title} ${t.command}`.includes(k)));
}

/** 阈值门：金额 ≥ 50万(HUBU_MIN_BUDGET_YUAN) 才放行。 */
export function passesThreshold(task: SourceTask): boolean {
  const budget = parseWan(extractBudget(task.command));
  return budget !== null && budget >= HUBU_MIN_BUDGET_YUAN;
}

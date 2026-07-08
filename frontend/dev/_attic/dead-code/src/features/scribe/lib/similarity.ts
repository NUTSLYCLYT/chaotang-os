/**
 * 朝堂 OS V2 · 史馆 · 相似案例召回
 *
 * 从 scribe/page.tsx 抽出的原始算法：
 *   score = agent 重叠数 + (taskType 相同 ? 2 : 0)
 *
 * 纯函数。未来语义检索作为独立实现，这里是 fallback。
 */

import type { Task } from '@/types/task';

export interface SimilarCase {
  task: Task;
  score: number;
}

export function findSimilarCases(selected: Task, pool: Task[], limit = 4): SimilarCase[] {
  const selectedAgents = new Set(selected.plan?.assignedAgents ?? []);
  const selectedType = selected.plan?.taskType;

  return pool
    .filter((t) => t.id !== selected.id)
    .map<SimilarCase>((task) => {
      const overlap = (task.plan?.assignedAgents ?? []).filter((a) =>
        selectedAgents.has(a),
      ).length;
      const typeMatch = task.plan?.taskType === selectedType ? 2 : 0;
      return { task, score: overlap + typeMatch };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

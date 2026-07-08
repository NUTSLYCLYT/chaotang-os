/**
 * 朝堂 OS V2 · 史馆 · 检索逻辑
 *
 * 纯函数，无副作用，易测试。未来服务端检索接入时作为 fallback。
 */

import type { AgentCode } from '@/types/agent';
import type { Task, TaskStatus, TaskType } from '@/types/task';

/** 史馆纳入范围的任务状态 */
export const ARCHIVE_STATUSES: TaskStatus[] = ['archived', 'reviewed', 'report_ready'];

export interface ScribeSearchFilter {
  /** 全文关键词（title + description + rawCommand + retrospective 文本） */
  keyword?: string;
  /** 任务类型多选 */
  taskTypes?: TaskType[];
  /** 参与部门多选（命中其一即算） */
  agents?: AgentCode[];
  /** 归档子状态多选 */
  statuses?: TaskStatus[];
  /** 是否只看有复盘的 */
  hasRetrospective?: boolean;
}

/** 过滤后是否存在任何非默认筛选条件 */
export function isFilterActive(f: ScribeSearchFilter): boolean {
  return Boolean(
    (f.keyword && f.keyword.trim().length > 0) ||
      (f.taskTypes && f.taskTypes.length > 0) ||
      (f.agents && f.agents.length > 0) ||
      (f.statuses && f.statuses.length > 0) ||
      f.hasRetrospective,
  );
}

/** 提取 task 的可检索文本（全部转小写以支持 .includes） */
function extractSearchableText(task: Task): string {
  const parts: string[] = [task.title, task.rawCommand];
  if (task.description) parts.push(task.description);
  if (task.plan?.intent) parts.push(task.plan.intent);
  const retro = task.retrospective;
  if (retro) {
    parts.push(...retro.successes, ...retro.failures, ...retro.lessons);
    if (retro.playbook) parts.push(retro.playbook);
  }
  return parts.join(' ').toLowerCase();
}

/**
 * 检索归档任务。
 *
 * 约定：
 * - 先用 ARCHIVE_STATUSES 过滤（只有归档/审阅/待批示进入史馆）
 * - 再按 filter 逐条收窄
 * - keyword 走 .includes()（中文 OK，无需分词）
 * - 空 filter = 返回所有归档任务
 */
export function searchArchive(tasks: Task[], filter: ScribeSearchFilter): Task[] {
  const base = tasks.filter((t) => ARCHIVE_STATUSES.includes(t.status));

  if (!isFilterActive(filter)) return base;

  const keyword = filter.keyword?.trim().toLowerCase() ?? '';

  return base.filter((task) => {
    // keyword
    if (keyword && !extractSearchableText(task).includes(keyword)) {
      return false;
    }
    // taskTypes
    if (filter.taskTypes && filter.taskTypes.length > 0) {
      const t = task.plan?.taskType;
      if (!t || !filter.taskTypes.includes(t)) return false;
    }
    // agents
    if (filter.agents && filter.agents.length > 0) {
      const assigned = task.plan?.assignedAgents ?? [];
      const hit = filter.agents.some((a) => assigned.includes(a));
      if (!hit) return false;
    }
    // statuses
    if (filter.statuses && filter.statuses.length > 0) {
      if (!filter.statuses.includes(task.status)) return false;
    }
    // hasRetrospective
    if (filter.hasRetrospective && !task.retrospective) return false;

    return true;
  });
}

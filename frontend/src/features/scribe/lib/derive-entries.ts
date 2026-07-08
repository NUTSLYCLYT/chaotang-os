/**
 * 从 Task[] + AgentRun[] 派生史馆记忆条目。
 *
 * 后端暂无独立的 memory 表，每个任务的生命周期事件（创建、计划、分派、
 * 运行、报告、批示、归档）都转换为一条可索引的 MemoryEntry。
 */

import { AGENT_META } from '@/types/agent';
import type { Task } from '@/types/task';
import type { AgentRun } from '@/types/agent';
import { agentStateInPlainWords, taskTypeInPlainWords } from '@/features/throne/lib/plain-language';

export type MemorySource = 'task' | 'plan' | 'agent' | 'review' | 'archive';

export interface MemoryEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  timestamp: string;
  source: MemorySource;
  headline: string;
  body?: string;
  accent?: string;
  department?: string;
}

const SOURCE_LABEL: Record<MemorySource, string> = {
  task: '任务创建',
  plan: '丞相筹划',
  agent: 'Agent 执行',
  review: '御批',
  archive: '归档',
};

export function sourceLabel(s: MemorySource): string {
  return SOURCE_LABEL[s];
}

export function deriveEntries(tasks: Task[], runs: AgentRun[]): MemoryEntry[] {
  const entries: MemoryEntry[] = [];

  for (const task of tasks) {
    // Task created
    entries.push({
      id: `${task.id}::created`,
      taskId: task.id,
      taskTitle: task.title,
      timestamp: task.createdAt,
      source: 'task',
      headline: `下达新旨 · ${task.title}`,
      body: task.rawCommand,
      accent: '#6BA0FF',
    });

    // Plan drafted
    if (task.plan) {
      entries.push({
        id: `${task.id}::plan`,
        taskId: task.id,
        taskTitle: task.title,
        timestamp: task.plan.createdAt,
        source: 'plan',
        headline: `丞相筹划 · ${taskTypeInPlainWords(task.plan.taskType)}`,
        body: task.plan.intent,
        accent: '#F0C66A',
      });
    }

    // Agent runs attached to this task
    const taskRuns = runs.filter((r) => r.taskId === task.id);
    for (const run of taskRuns) {
      const meta = AGENT_META[run.agentCode];
      entries.push({
        id: `${task.id}::run::${run.id}`,
        taskId: task.id,
        taskTitle: task.title,
        timestamp: run.startedAt ?? task.updatedAt,
        source: 'agent',
        headline: `${meta.nameCn} · ${agentStateInPlainWords(run.state)}`,
        body: run.latestSummary ?? run.currentTaskTitle ?? '—',
        accent: meta.color,
        department: meta.nameCn,
      });
    }

    // Reviewed / archived state
    if (task.status === 'reviewed' || task.status === 'archived') {
      entries.push({
        id: `${task.id}::review`,
        taskId: task.id,
        taskTitle: task.title,
        timestamp: task.updatedAt,
        source: 'review',
        headline: '御批 · 准奏',
        accent: '#3DD68C',
      });
    }
    if (task.status === 'archived') {
      entries.push({
        id: `${task.id}::archive`,
        taskId: task.id,
        taskTitle: task.title,
        timestamp: task.updatedAt,
        source: 'archive',
        headline: '归档入史',
        accent: '#6A7299',
      });
    }
  }

  // Reverse chronological
  entries.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  return entries;
}

/* ==========================================================================
   Fuzzy search — token subsequence scorer
   ========================================================================== */

export function fuzzyScore(haystack: string, needle: string): number {
  if (!needle) return 1;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (h.includes(n)) return 2;
  // subsequence match
  let hi = 0;
  let matched = 0;
  for (let ni = 0; ni < n.length; ni++) {
    const c = n[ni];
    if (!c) continue;
    const idx = h.indexOf(c, hi);
    if (idx < 0) return 0;
    hi = idx + 1;
    matched++;
  }
  return matched / n.length;
}

export function filterEntries(
  entries: MemoryEntry[],
  query: string,
  sources: Set<MemorySource>,
): MemoryEntry[] {
  const q = query.trim();
  const filtered = entries.filter((e) => sources.has(e.source));
  if (!q) return filtered;
  return filtered
    .map((e) => ({
      e,
      score: Math.max(
        fuzzyScore(e.headline, q),
        fuzzyScore(e.body ?? '', q),
        fuzzyScore(e.taskTitle, q),
      ),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.e);
}

/* ==========================================================================
   Day grouping
   ========================================================================== */

export interface DayGroup {
  dayKey: string;
  dayLabel: string;
  entries: MemoryEntry[];
}

export function groupByDay(entries: MemoryEntry[]): DayGroup[] {
  const groups = new Map<string, MemoryEntry[]>();
  for (const e of entries) {
    const d = new Date(e.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  return Array.from(groups.entries()).map(([dayKey, items]) => {
    const first = items[0];
    const d = first ? new Date(first.timestamp) : new Date();
    const dayLabel = d.toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
    return { dayKey, dayLabel, entries: items };
  });
}

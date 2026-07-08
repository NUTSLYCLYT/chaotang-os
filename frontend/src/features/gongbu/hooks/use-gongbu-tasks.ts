'use client';

/**
 * 工部 · 建设任务数据（M1）。读真实主库/后端 tasks 当决策队列数据源。
 * 数据源：GET /api/court/backend/tasks（jiqun 持久化 / primary DB）。
 */
import useSWR from 'swr';

import type { GongbuTask } from '@/features/gongbu/lib/gongbu-engines';

const BASE_PATH = (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_BASE_PATH) ?? '';

function normalize(t: Record<string, unknown>): GongbuTask {
  const s = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
  return {
    id: s(t.id, s(t.taskId)),
    taskId: s(t.taskId, s(t.id)),
    title: s(t.title, s(t.rawCommand, '未命名任务')),
    description: s(t.description),
    rawCommand: s(t.rawCommand),
    status: s(t.status, 'submitted'),
    progressPct: typeof t.progressPct === 'number' ? t.progressPct : 0,
    createdAt: s(t.createdAt),
    updatedAt: s(t.updatedAt),
  };
}

async function fetchGongbuTasks(): Promise<{ tasks: GongbuTask[]; source: string }> {
  const res = await fetch(`${BASE_PATH}/api/court/backend/tasks?limit=50`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`gongbu/tasks: ${res.status}`);
  const json = (await res.json()) as { success?: boolean; data?: unknown[]; source?: string };
  const raw = Array.isArray(json?.data) ? json.data : [];
  return { tasks: raw.map((t) => normalize(t as Record<string, unknown>)), source: json?.source ?? 'backend' };
}

export function useGongbuTasks() {
  const { data, error, isLoading, mutate } = useSWR<{ tasks: GongbuTask[]; source: string }, Error>(
    'gongbu-tasks',
    fetchGongbuTasks,
    { refreshInterval: 60_000, revalidateOnFocus: true, dedupingInterval: 30_000 },
  );
  return { tasks: data?.tasks ?? [], source: data?.source ?? null, isLoading, error, mutate };
}

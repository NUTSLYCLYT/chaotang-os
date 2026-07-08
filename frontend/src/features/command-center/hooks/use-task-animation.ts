'use client';

import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store/app-store';
import type { TaskStatus } from '@/types/task';
import { API_MODE } from '@/lib/api/client';

/**
 * Mock-mode task state machine.
 * After a task is created, advances its status through the standard lifecycle
 * with realistic timing so demo visitors see "it's working" feedback.
 *
 * Timings (ms from task creation):
 *   1200  submitted → assigned
 *   2000  assigned  → running
 *   5000  running   → aggregating
 *   7200  aggregating → report_ready
 */

const TIMELINE: Array<{ delayMs: number; status: TaskStatus; toastMsg?: string }> = [
  { delayMs: 1200, status: 'assigned',     toastMsg: '任务已分配律师庄园' },
  { delayMs: 2000, status: 'running',      toastMsg: '律师庄园分析中' },
  { delayMs: 5000, status: 'aggregating',  toastMsg: '正在汇总研判' },
  { delayMs: 7200, status: 'report_ready', toastMsg: '研判完成 · 呈报已备好' },
];

export function useTaskAnimation() {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const cancel = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const animate = useCallback(
    (taskId: string) => {
      if (API_MODE !== 'mock') return;

      cancel();

      TIMELINE.forEach(({ delayMs, status, toastMsg }) => {
        const t = setTimeout(() => {
          const store = useAppStore.getState();
          const task = store.tasks.find((t) => t.id === taskId);
          if (!task) return;
          store.updateTask(taskId, {
            status,
            updatedAt: new Date().toISOString(),
          });
          if (toastMsg) toast(toastMsg);
        }, delayMs);
        timers.current.push(t);
      });
    },
    [cancel],
  );

  return { animate, cancel };
}

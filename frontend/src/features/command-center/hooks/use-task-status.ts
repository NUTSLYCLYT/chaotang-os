'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store/app-store';
import { API_MODE } from '@/lib/api/client';
import { subscribeTaskSSE } from '@/lib/api/adapters/task-events-sse';
import { pollTaskStatus } from '@/lib/api/adapters/task-events-poll';
import type { TaskStatus } from '@/types/task';

const STATUS_TOAST_MESSAGES: Partial<Record<TaskStatus, string>> = {
  assigned:     '任务已分配律师庄园',
  running:      '律师庄园分析中',
  aggregating:  '正在汇总研判',
  report_ready: '研判完成 · 呈报已备好',
  failed:       '庄园暂时无响应，任务已保存到复盘台',
};

export function useTaskStatus(taskId: string | null) {
  const updateTask = useAppStore((s) => s.updateTask);
  const notifiedStatuses = useRef(new Set<string>());

  useEffect(() => {
    if (!taskId || API_MODE === 'mock') return;

    notifiedStatuses.current.clear();

    const handleEvent = ({ status }: { taskId: string; status: TaskStatus; ts: string }) => {
      updateTask(taskId, { status });

      const key = `${taskId}:${status}`;
      if (!notifiedStatuses.current.has(key)) {
        notifiedStatuses.current.add(key);
        const msg = STATUS_TOAST_MESSAGES[status];
        if (msg) toast(msg);
      }
    };

    let unsubSSE: (() => void) | null = null;
    let unsubPoll: (() => void) | null = null;
    let sseFailed = false;

    try {
      unsubSSE = subscribeTaskSSE(taskId, handleEvent);
    } catch {
      sseFailed = true;
    }

    if (sseFailed) {
      unsubPoll = pollTaskStatus(taskId, handleEvent);
    }

    return () => {
      unsubSSE?.();
      unsubPoll?.();
    };
  }, [taskId, updateTask]);
}

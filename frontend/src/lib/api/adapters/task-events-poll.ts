import type { TaskStatus } from '@/types/task';
import type { TaskEventCallback } from './task-events-sse';
import { withBasePath } from '@/lib/base-path';

const POLL_INTERVAL_MS = 3000;
const MAX_NO_CHANGE_POLLS = 30;

const TERMINAL_STATUSES = new Set<TaskStatus>(['report_ready', 'reviewed', 'archived', 'failed']);

export function pollTaskStatus(taskId: string, onEvent: TaskEventCallback): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastStatus: TaskStatus | null = null;
  let noChangePollCount = 0;
  let stopped = false;

  const poll = async () => {
    if (stopped) return;
    try {
      // 读真实任务状态（原 /api/tasks/[id] 是永远返回 status:'planning' 的假数据路由，已删）。
      // 真实路由形状较富且分支多，故防御式取 status：取不到就当"无变化"，绝不伪造事件。
      const res = await fetch(withBasePath(`/api/court/backend/tasks/${taskId}`));
      if (res.ok) {
        const data = (await res.json()) as {
          id?: string;
          status?: unknown;
          updatedAt?: string;
          updated_at?: string;
        };
        const status = typeof data.status === 'string' ? (data.status as TaskStatus) : null;
        if (status && status !== lastStatus) {
          lastStatus = status;
          noChangePollCount = 0;
          onEvent({
            taskId: data.id ?? taskId,
            status,
            ts: data.updatedAt ?? data.updated_at ?? new Date().toISOString(),
          });
        } else {
          noChangePollCount++;
        }

        if ((status && TERMINAL_STATUSES.has(status)) || noChangePollCount >= MAX_NO_CHANGE_POLLS) {
          stopped = true;
          return;
        }
      }
    } catch {
      // network error — keep polling
    }
    if (!stopped) {
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }
  };

  timer = setTimeout(poll, POLL_INTERVAL_MS);

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

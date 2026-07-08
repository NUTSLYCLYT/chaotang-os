import type { TaskStatus } from '@/types/task';
import { withBasePath } from '@/lib/base-path';

export interface TaskStatusEvent {
  taskId: string;
  status: TaskStatus;
  ts: string;
}

export type TaskEventCallback = (event: TaskStatusEvent) => void;

export function subscribeTaskSSE(taskId: string, onEvent: TaskEventCallback): () => void {
  let es: EventSource | null = null;
  let lastEventId = '';
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectCount = 0;
  const MAX_RECONNECTS_PER_30S = 2;
  let reconnectWindowStart = Date.now();

  const connect = () => {
    const url = withBasePath(`/api/tasks/${taskId}/events${lastEventId ? `?lastEventId=${lastEventId}` : ''}`);
    es = new EventSource(url);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string) as TaskStatusEvent;
        lastEventId = e.lastEventId ?? lastEventId;
        onEvent(data);
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      es?.close();
      es = null;

      const now = Date.now();
      if (now - reconnectWindowStart > 30_000) {
        reconnectCount = 0;
        reconnectWindowStart = now;
      }

      if (reconnectCount < MAX_RECONNECTS_PER_30S) {
        reconnectCount++;
        reconnectTimer = setTimeout(connect, 5000);
      }
    };
  };

  connect();

  return () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    es?.close();
  };
}

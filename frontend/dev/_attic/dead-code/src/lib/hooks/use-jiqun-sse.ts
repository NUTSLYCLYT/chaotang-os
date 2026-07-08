'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

/** Jiqun SSE 事件 — 跟 follow_jiqun_ui types/index.ts SSEEvent 一致 */
export interface JiqunSSEEvent {
  type: string;
  step?: number;
  total?: number;
  name?: string;
  status?: string;
  elapsed?: number;
  run_id?: string;
  message?: string;
  task_id?: string;
  /** 后端 step 事件没直接给 step_id，需要走 step_index → flow.steps[index].id 自行映射 */
  [key: string]: unknown;
}

export type JiqunSSEStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'done';

export interface UseJiqunSSEResult {
  events: JiqunSSEEvent[];
  status: JiqunSSEStatus;
  /** step_index (1-based) → status */
  stepStatusByIndex: Record<number, string>;
  clear: () => void;
}

/**
 * 消费 /jiqun/api/runs/stream/:task_id SSE 流。
 * basePath 用 NEXT_PUBLIC_BASE_PATH 拼前缀（prod 在 /chaotang 下）
 * taskId 为 null 时 idle，不开连接。
 */
export function useJiqunSSE(taskId: string | null): UseJiqunSSEResult {
  const [events, setEvents] = useState<JiqunSSEEvent[]>([]);
  const [status, setStatus] = useState<JiqunSSEStatus>('idle');
  const [stepStatusByIndex, setStepStatus] = useState<Record<number, string>>({});
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!taskId) {
      setStatus('idle');
      return;
    }

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    const url = `${basePath}/jiqun/api/runs/stream/${taskId}`;

    esRef.current?.close();
    setStatus('connecting');
    setEvents([]);
    setStepStatus({});

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setStatus('connected');

    es.onmessage = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data as string) as JiqunSSEEvent;
        if (parsed.type === 'heartbeat') return;
        setEvents(prev => [...prev, parsed]);

        // step 状态累加
        if ((parsed.type === 'step' || parsed.type === 'step_start' || parsed.type === 'step_save') && typeof parsed.step === 'number') {
          const idx = parsed.step;
          // step_start 只标 running；其他事件用 status 字段
          const newStatus = parsed.type === 'step_start'
            ? 'running'
            : (typeof parsed.status === 'string' ? parsed.status : 'running');
          setStepStatus(prev => ({ ...prev, [idx]: newStatus }));
        }

        if (parsed.type === 'done') {
          setStatus('done');
          es.close();
        } else if (parsed.type === 'error') {
          setStatus('error');
          es.close();
        }
      } catch {
        // 非 JSON 消息忽略
      }
    };

    es.onerror = () => {
      setStatus(s => (s === 'done' ? 'done' : 'error'));
      es.close();
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [taskId]);

  const clear = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setEvents([]);
    setStepStatus({});
    setStatus('idle');
  }, []);

  return { events, status, stepStatusByIndex, clear };
}

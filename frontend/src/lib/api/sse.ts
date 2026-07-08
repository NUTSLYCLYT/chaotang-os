/**
 * 朝堂 OS V2 · SSE 事件流客户端
 *
 * 对接 V1 /api/events/stream（Server-Sent Events）
 * 用途：real 模式下，把 V1 后端的实时事件推入 V2 store，
 *      让 /overview 和 /command-center 能看到真实任务的实时进度
 */

import { API_MODE } from './client';
import { withBasePath } from '@/lib/base-path';

export interface V1Event {
  id: string;
  taskId: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface SseSubscription {
  close: () => void;
}

/**
 * 订阅 V1 全局事件流
 *
 * 仅在 API_MODE=real/hybrid 时真实连接；mock 模式下返回空订阅
 */
export function subscribeToEventStream(
  onEvent: (event: V1Event) => void,
  options: { onError?: (err: Event) => void; onOpen?: () => void } = {},
): SseSubscription {
  // mock 模式不连接
  if (API_MODE === 'mock') {
    return { close: () => undefined };
  }

  // 浏览器环境才有 EventSource
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return { close: () => undefined };
  }

  let source: EventSource | null = null;

  try {
    source = new EventSource(withBasePath('/api/court/events/stream'));

    source.onopen = () => {
      options.onOpen?.();
    };

    source.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as V1Event;
        onEvent(parsed);
      } catch {
        // 静默忽略解析失败
      }
    };

    source.onerror = (err) => {
      options.onError?.(err);
      // EventSource 会自动重连，无需手动处理
    };
  } catch {
    // 连接失败返回空订阅
    return { close: () => undefined };
  }

  return {
    close: () => {
      source?.close();
      source = null;
    },
  };
}

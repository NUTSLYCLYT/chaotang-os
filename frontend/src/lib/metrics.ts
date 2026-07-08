/**
 * 前端事件埋点工具
 *
 * 在 mock 模式下仅 console.debug，在 real 模式下 POST 到 /api/metrics。
 * 每个关键路径节点调用 trackEvent，后端/监控栈从这里收 Prometheus 指标。
 */

const IS_REAL = process.env.NEXT_PUBLIC_API_MODE === 'real';

export type MetricEvent =
  | { name: 'command_submitted'; taskId: string; domain: string }
  | { name: 'manor_response_received'; taskId: string; domain: string; durationMs: number }
  | { name: 'report_rendered'; taskId: string; domain: string; durationMs: number }
  | { name: 'task_failed'; taskId: string; domain: string; reason: string }
  | { name: 'page_load'; route: string; durationMs: number };

export function trackEvent(event: MetricEvent): void {
  if (!IS_REAL) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.debug('[metrics]', event.name, event);
    }
    return;
  }

  // Fire-and-forget — metrics loss is acceptable
  fetch('/api/metrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...event, ts: Date.now() }),
    keepalive: true,
  }).catch(() => undefined);
}

export function measureAsync<T>(
  eventBuilder: (durationMs: number, result: T) => MetricEvent,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  return fn().then((result) => {
    trackEvent(eventBuilder(Math.round(performance.now() - start), result));
    return result;
  });
}

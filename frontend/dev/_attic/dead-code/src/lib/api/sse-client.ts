/**
 * SSE 客户端 adapter（phase 6 newmod-005）
 *
 * EventSource 不能带 Authorization header（浏览器规范限制），所以我们用
 * fetch + ReadableStream 自己解析 text/event-stream 协议。这样可以照常
 * 把 JWT 放进 Authorization。
 *
 * 用法：
 *   const stop = subscribeManorStream(
 *     { domain: 'legal', situation: '合同纠纷...' },
 *     event => console.log(event),
 *   );
 *   // 用户取消时调用 stop()
 */

export interface SseEvent {
  type: string;
  [key: string]: unknown;
}

export interface SseSubscriptionOptions {
  onEvent: (event: SseEvent) => void;
  onError?: (err: unknown) => void;
  onOpen?: () => void;
  signal?: AbortSignal;
}

/**
 * 通用 SSE fetch（带 token）。
 * url 可以是绝对或相对（next.js dev rewrites 会代理 /api/v1/* 到 NestJS）。
 */
export async function fetchSseStream(
  url: string,
  init: RequestInit = {},
  opts: SseSubscriptionOptions,
): Promise<void> {
  const ac = init.signal ? null : new AbortController();
  const signal = init.signal ?? ac?.signal;

  try {
    const response = await fetch(url, {
      ...init,
      signal,
      headers: {
        Accept: 'text/event-stream',
        ...init.headers,
      },
    });

    if (!response.ok || !response.body) {
      opts.onError?.(new Error(`SSE upstream ${response.status}`));
      return;
    }

    opts.onOpen?.();

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE message terminator = blank line. 兼容 \n\n 和 \r\n\r\n。
      // 取两个 indexOf 的较小正值（短路求值会先匹配更晚的 \n\n 漏吞前面
      // 的 \r\n\r\n 消息，所以这里显式比较）。
      while (true) {
        const lf = buffer.indexOf('\n\n');
        const crlf = buffer.indexOf('\r\n\r\n');
        if (lf < 0 && crlf < 0) break;
        let separatorIdx: number;
        let separatorLen: number;
        if (crlf >= 0 && (lf < 0 || crlf < lf)) {
          separatorIdx = crlf;
          separatorLen = 4;
        } else {
          separatorIdx = lf;
          separatorLen = 2;
        }
        const rawMessage = buffer.slice(0, separatorIdx);
        buffer = buffer.slice(separatorIdx + separatorLen);
        const dataLine = rawMessage.split('\n').find(line => line.startsWith('data:'));
        if (!dataLine) continue;
        const payload = dataLine.replace(/^data:\s*/, '').trim();
        if (!payload) continue;
        try {
          const event = JSON.parse(payload) as SseEvent;
          opts.onEvent(event);
        } catch (err) {
          opts.onError?.(err);
        }
      }
    }
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') return;
    opts.onError?.(err);
  }
}

/**
 * 订阅 Manor analyze 流（newmod-005）。
 * 返回 stop() 用于提前终止。
 */
export function subscribeManorStream(
  params: { domain: string; situation: string; token?: string },
  onEvent: (event: SseEvent) => void,
): () => void {
  const ac = new AbortController();
  const url = `/api/v1/manor/analyze-stream?domain=${encodeURIComponent(params.domain)}&situation=${encodeURIComponent(
    params.situation,
  )}`;

  void fetchSseStream(
    url,
    {
      method: 'GET',
      signal: ac.signal,
      headers: params.token ? { Authorization: `Bearer ${params.token}` } : undefined,
    },
    {
      onEvent,
      onError: err => {
        if ((err as { name?: string }).name !== 'AbortError') {
          console.error('[manor-sse] error:', err);
        }
      },
    },
  );

  return () => ac.abort();
}

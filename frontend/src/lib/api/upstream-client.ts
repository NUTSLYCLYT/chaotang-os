/**
 * 朝堂 OS · 上游 HTTP 统一客户端
 *
 * 所有 BFF route 通过本模块调用 legal-agent / hermes / openharness 等上游。
 *
 * 设计约束：
 *   - 统一 timeout / retry / abort / trace_id
 *   - 统一 stderr JSON log · 字段 ts,reqId,route,upstream_ms,status
 *   - 5xx 重试一次，4xx 不重试直接返回
 *   - upstream 挂了抛 UpstreamError · BFF 层决定降级策略（fallback mock）
 *   - 所有对外响应加 X-Request-Id + X-Upstream(live|fallback|down)
 *
 * 不关心数据结构 · 不做 schema 校验（那是 BFF 层的事）
 */

import { logger } from '@/lib/logger';

export const UPSTREAM_LEGAL_AGENT =
  process.env.LEGAL_AGENT_URL ??
  process.env.LEGAL_AGENT_BASE_URL ??
  'http://127.0.0.1:18003';

export const DEFAULT_TIMEOUT_MS = 15_000;
export const STREAM_TIMEOUT_MS = 60_000;
export const HEALTH_TIMEOUT_MS = 3_000;

export class UpstreamError extends Error {
  constructor(
    message: string,
    public status: number,
    public upstream: string,
    public detail?: unknown,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

export interface CallUpstreamOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  timeoutMs?: number;
  /** 上限 1 次重试 · 5xx 触发 */
  retry?: boolean;
  /** 调用者给的追踪 ID · 会透传给上游 */
  requestId?: string;
  /** 额外 header */
  headers?: Record<string, string>;
  /** 可选取消信号 · 调用方断开时一并 abort */
  signal?: AbortSignal;
}

export interface CallUpstreamResult<T> {
  data: T;
  upstreamMs: number;
  attempt: number;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 合并两个 AbortSignal（任一触发即 abort） */
function anySignal(...signals: Array<AbortSignal | undefined>): AbortSignal {
  const c = new AbortController();
  for (const s of signals) {
    if (!s) continue;
    if (s.aborted) {
      c.abort();
      return c.signal;
    }
    s.addEventListener('abort', () => c.abort(), { once: true });
  }
  return c.signal;
}

/**
 * 发起上游调用 · JSON 进 JSON 出
 */
export async function callUpstream<T = unknown>(
  path: string,
  opts: CallUpstreamOptions = {},
): Promise<CallUpstreamResult<T>> {
  const method = opts.method ?? 'GET';
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const reqId = opts.requestId ?? crypto.randomUUID();
  const base = UPSTREAM_LEGAL_AGENT.replace(/\/$/, '');
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const maxAttempts = opts.retry === false ? 1 : 2;
  const log = logger.child({ requestId: reqId });

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const signal = anySignal(controller.signal, opts.signal);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': reqId,
          'Accept': 'application/json',
          ...opts.headers,
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal,
      });
      clearTimeout(timer);

      const upstreamMs = Date.now() - started;

      // 4xx · 客户端错误 · 不重试
      if (res.status >= 400 && res.status < 500) {
        const text = await res.text().catch(() => '');
        log.warn('upstream 4xx', { status: res.status, upstreamMs, bodyHead: text.slice(0, 200) });
        throw new UpstreamError(
          `upstream ${method} ${path} → ${res.status}`,
          res.status,
          url,
          text,
        );
      }

      // 5xx · 可重试
      if (!res.ok) {
        log.warn('upstream 5xx', { status: res.status, upstreamMs, attempt });
        lastError = new UpstreamError(
          `upstream ${method} ${path} → ${res.status}`,
          res.status,
          url,
        );
        if (attempt < maxAttempts) {
          await sleep(100 * attempt);
          continue;
        }
        throw lastError;
      }

      const data = (await res.json()) as T;
      log.info('upstream ok', { status: res.status, upstreamMs, attempt });
      return { data, upstreamMs, attempt };
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof UpstreamError) throw err;

      const upstreamMs = Date.now() - started;
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      log.warn('upstream error', {
        attempt,
        upstreamMs,
        aborted,
        err: err instanceof Error ? err.message : String(err),
      });
      lastError = err;

      // 连接错误 · 超时 · 重试一次
      if (attempt < maxAttempts) {
        await sleep(100 * attempt);
        continue;
      }

      throw new UpstreamError(
        `upstream ${method} ${path} unreachable: ${
          err instanceof Error ? err.message : String(err)
        }`,
        0,
        url,
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new UpstreamError('unknown upstream failure', 0, url);
}

/**
 * 发起上游流式调用 · 返回原始 Response · 由调用方处理 ReadableStream
 *
 * 与 callUpstream 的差异：
 *   - 不读 body · 不解析 JSON · 把 SSE/chunked 交给调用方
 *   - 不自动重试（流式重试语义复杂）
 */
export async function callUpstreamStream(
  path: string,
  opts: CallUpstreamOptions = {},
): Promise<{ response: Response; upstream: string; requestId: string }> {
  const method = opts.method ?? 'POST';
  const timeout = opts.timeoutMs ?? STREAM_TIMEOUT_MS;
  const reqId = opts.requestId ?? crypto.randomUUID();
  const base = UPSTREAM_LEGAL_AGENT.replace(/\/$/, '');
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const log = logger.child({ requestId: reqId });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const signal = anySignal(controller.signal, opts.signal);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'X-Request-Id': reqId,
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal,
    });

    if (!response.ok || !response.body) {
      clearTimeout(timer);
      const text = await response.text().catch(() => '');
      log.warn('upstream stream non-200', { status: response.status, bodyHead: text.slice(0, 200) });
      throw new UpstreamError(
        `upstream stream ${method} ${path} → ${response.status}`,
        response.status,
        url,
        text,
      );
    }

    log.info('upstream stream open', { status: response.status });
    // 注：timer 由调用方在 stream 关闭后负责清理（通过 signal）
    // 这里不能 clearTimeout 因为 stream 还在走
    response.body.getReader;
    return { response, upstream: url, requestId: reqId };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof UpstreamError) throw err;
    throw new UpstreamError(
      `upstream stream ${method} ${path} unreachable: ${
        err instanceof Error ? err.message : String(err)
      }`,
      0,
      url,
    );
  }
}

/** 上游探活 · /health · 带短超时 · 永远不抛 */
export async function probeUpstream(): Promise<{ ok: boolean; latencyMs: number }> {
  const started = Date.now();
  try {
    const res = await fetch(`${UPSTREAM_LEGAL_AGENT}/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    return { ok: res.ok, latencyMs: Date.now() - started };
  } catch {
    return { ok: false, latencyMs: Date.now() - started };
  }
}

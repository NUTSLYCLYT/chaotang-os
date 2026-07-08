/**
 * 朝堂 OS · 统一异步状态契约
 *
 * 来源：court-console/apps/web-v2/src/types/async-state.ts
 * 目标位置：apps/web/lib/contracts/async-state.ts
 *
 * 所有关键页面必须支持 loading / empty / error / locked / ready 五态。
 * 与现有 apps/web/components/DataState.tsx 兼容（A 已有简化版本）。
 */

export type LockReason = 'permission' | 'plan' | 'feature_flag' | 'maintenance' | 'deprecated';

export interface AsyncIdle {
  status: 'idle';
}

export interface AsyncLoading {
  status: 'loading';
  /** 0-100 */
  progress?: number;
  /** 加载提示 */
  hint?: string;
}

export interface AsyncError {
  status: 'error';
  message: string;
  code?: string;
  retryable?: boolean;
  cause?: unknown;
}

export interface AsyncEmpty {
  status: 'empty';
  title: string;
  description?: string;
}

export interface AsyncReady<T> {
  status: 'ready';
  data: T;
  /** 锁定态（有数据但因权限/订阅/特性开关被锁） */
  locked?: {
    reason: LockReason;
    message: string;
  };
  /** Unix timestamp（ms） */
  fetchedAt?: number;
}

export type AsyncState<T> = AsyncIdle | AsyncLoading | AsyncError | AsyncEmpty | AsyncReady<T>;

/* ==========================================================================
   Constructors
   ========================================================================== */

export const asyncIdle = (): AsyncIdle => ({ status: 'idle' });

export const asyncLoading = (opts?: { progress?: number; hint?: string }): AsyncLoading => ({
  status: 'loading',
  ...(opts?.progress !== undefined ? { progress: opts.progress } : {}),
  ...(opts?.hint ? { hint: opts.hint } : {}),
});

export const asyncError = (
  message: string,
  opts?: { code?: string; retryable?: boolean; cause?: unknown },
): AsyncError => ({
  status: 'error',
  message,
  ...(opts?.code ? { code: opts.code } : {}),
  ...(opts?.retryable !== undefined ? { retryable: opts.retryable } : {}),
  ...(opts?.cause !== undefined ? { cause: opts.cause } : {}),
});

export const asyncEmpty = (title: string, description?: string): AsyncEmpty => ({
  status: 'empty',
  title,
  ...(description ? { description } : {}),
});

export const asyncReady = <T>(
  data: T,
  opts?: { locked?: AsyncReady<T>['locked']; fetchedAt?: number },
): AsyncReady<T> => ({
  status: 'ready',
  data,
  ...(opts?.locked ? { locked: opts.locked } : {}),
  ...(opts?.fetchedAt !== undefined ? { fetchedAt: opts.fetchedAt } : { fetchedAt: Date.now() }),
});

/* ==========================================================================
   Type guards
   ========================================================================== */

export const isReady = <T>(s: AsyncState<T>): s is AsyncReady<T> => s.status === 'ready';
export const isLoading = <T>(s: AsyncState<T>): s is AsyncLoading => s.status === 'loading';
export const isError = <T>(s: AsyncState<T>): s is AsyncError => s.status === 'error';
export const isEmpty = <T>(s: AsyncState<T>): s is AsyncEmpty => s.status === 'empty';
export const isLocked = <T>(s: AsyncState<T>): s is AsyncReady<T> => s.status === 'ready' && s.locked !== undefined;

/* ==========================================================================
   Promise 组合器
   ========================================================================== */

export interface FromPromiseOptions<T> {
  isEmpty?: (data: T) => boolean;
  emptyTitle?: string;
  toErrorMessage?: (err: unknown) => string;
}

export async function fromPromise<T>(
  promise: Promise<T>,
  options: FromPromiseOptions<T> = {},
): Promise<AsyncReady<T> | AsyncEmpty | AsyncError> {
  try {
    const data = await promise;
    if (options.isEmpty?.(data)) {
      return asyncEmpty(options.emptyTitle ?? '暂无数据');
    }
    return asyncReady(data);
  } catch (err) {
    const message = options.toErrorMessage?.(err) ?? (err instanceof Error ? err.message : '加载失败');
    return asyncError(message, { cause: err, retryable: true });
  }
}

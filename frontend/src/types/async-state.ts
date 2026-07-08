/**
 * 朝堂 OS V2 · 统一异步状态契约 (AsyncState)
 *
 * 借鉴 Agent Kingdom OS 规划文档的核心约束：
 *   "所有关键页面和区块必须支持 loading / empty / error / locked"
 *   "所有关键状态必须统一，不能各模块自行发明状态"
 *
 * 本文件为 web-v2 提供**唯一合法**的异步数据状态表示。
 * 配合 <StateSwitch> 组件，保证全局视觉与行为一致。
 */

export type LockReason =
  | 'permission'
  | 'plan'
  | 'feature_flag'
  | 'maintenance'
  | 'deprecated';

export interface AsyncIdle {
  status: 'idle';
}

export interface AsyncLoading {
  status: 'loading';
  progress?: number;
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
  locked?: {
    reason: LockReason;
    message: string;
  };
  fetchedAt?: number;
}

export type AsyncState<T> =
  | AsyncIdle
  | AsyncLoading
  | AsyncError
  | AsyncEmpty
  | AsyncReady<T>;

// ─── 构造器 ───────────────────────────────────────────────

export const asyncIdle = (): AsyncIdle => ({ status: 'idle' });

export const asyncLoading = (opts?: { progress?: number; hint?: string }): AsyncLoading => ({
  status: 'loading',
  ...(opts?.progress !== undefined && { progress: opts.progress }),
  ...(opts?.hint !== undefined && { hint: opts.hint }),
});

export const asyncError = (
  message: string,
  opts?: { code?: string; retryable?: boolean; cause?: unknown },
): AsyncError => ({
  status: 'error',
  message,
  ...(opts?.code !== undefined && { code: opts.code }),
  ...(opts?.retryable !== undefined && { retryable: opts.retryable }),
  ...(opts?.cause !== undefined && { cause: opts.cause }),
});

export const asyncEmpty = (title: string, description?: string): AsyncEmpty => ({
  status: 'empty',
  title,
  ...(description !== undefined && { description }),
});

export const asyncReady = <T>(
  data: T,
  opts?: { locked?: AsyncReady<T>['locked']; fetchedAt?: number },
): AsyncReady<T> => ({
  status: 'ready',
  data,
  ...(opts?.locked !== undefined && { locked: opts.locked }),
  ...(opts?.fetchedAt !== undefined && { fetchedAt: opts.fetchedAt }),
});

// ─── 类型守卫 ─────────────────────────────────────────────

export const isReady = <T>(s: AsyncState<T>): s is AsyncReady<T> => s.status === 'ready';
export const isLoading = <T>(s: AsyncState<T>): s is AsyncLoading => s.status === 'loading';
export const isError = <T>(s: AsyncState<T>): s is AsyncError => s.status === 'error';
export const isEmpty = <T>(s: AsyncState<T>): s is AsyncEmpty => s.status === 'empty';
export const isLocked = <T>(s: AsyncState<T>): s is AsyncReady<T> =>
  s.status === 'ready' && s.locked !== undefined;

// ─── Promise → AsyncState 组合器 ─────────────────────────

export interface FromPromiseOptions<T> {
  isEmpty?: (data: T) => boolean;
  emptyTitle?: string;
  toErrorMessage?: (err: unknown) => string;
}

const defaultIsEmpty = <T>(data: T): boolean => {
  if (data == null) return true;
  if (Array.isArray(data) && data.length === 0) return true;
  return false;
};

const defaultErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  return '未知错误';
};

export async function fromPromise<T>(
  promise: Promise<T>,
  options: FromPromiseOptions<T> = {},
): Promise<AsyncReady<T> | AsyncEmpty | AsyncError> {
  const {
    isEmpty = defaultIsEmpty,
    emptyTitle = '暂无数据',
    toErrorMessage = defaultErrorMessage,
  } = options;
  try {
    const data = await promise;
    if (isEmpty(data)) return asyncEmpty(emptyTitle);
    return asyncReady(data, { fetchedAt: Date.now() });
  } catch (err: unknown) {
    return asyncError(toErrorMessage(err), { retryable: true, cause: err });
  }
}

/**
 * 朝堂 OS V2 · StateSwitch
 *
 * 统一消费 AsyncState<T> 的渲染开关，保证所有页面的
 * loading / empty / error / locked 视觉与交互一致。
 */

'use client';

import type { ReactNode } from 'react';
import type { AsyncState, LockReason } from '@/types/async-state';

export interface StateSwitchProps<T> {
  state: AsyncState<T>;
  children: (data: T) => ReactNode;
  onRetry?: () => void;
  loadingFallback?: ReactNode;
  emptyAction?: ReactNode;
  minHeight?: number | string;
  className?: string;
}

const LOCK_LABEL: Record<LockReason, string> = {
  permission: '权限受限',
  plan: '套餐受限',
  feature_flag: '灰度未开放',
  maintenance: '维护中',
  deprecated: '已下线',
};

export function StateSwitch<T>({
  state,
  children,
  onRetry,
  loadingFallback,
  emptyAction,
  minHeight = 160,
  className = '',
}: StateSwitchProps<T>) {
  const containerStyle = { minHeight };

  if (state.status === 'idle') {
    return (
      <div
        className={`flex items-center justify-center text-sm text-white/40 ${className}`}
        style={containerStyle}
      >
        正在载入朝堂态势…
      </div>
    );
  }

  if (state.status === 'loading') {
    if (loadingFallback) {
      return (
        <div className={className} style={containerStyle}>
          {loadingFallback}
        </div>
      );
    }
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 ${className}`}
        style={containerStyle}
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-transparent"
          style={{
            borderTopColor: 'rgba(240, 198, 106, 0.9)',
            borderRightColor: 'rgba(240, 198, 106, 0.3)',
          }}
          aria-label="载入中"
        />
        <div className="text-xs uppercase tracking-widest text-white/50">
          {state.hint ?? '载入中'}
        </div>
        {state.progress !== undefined && (
          <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full transition-all"
              style={{
                width: `${Math.round(state.progress * 100)}%`,
                background:
                  'linear-gradient(90deg, rgba(240,198,106,0.9), rgba(240,198,106,0.4))',
              }}
            />
          </div>
        )}
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 px-4 text-center ${className}`}
        style={containerStyle}
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.45)',
          }}
        >
          <span className="text-lg" style={{ color: 'rgba(244, 63, 94, 0.9)' }}>
            !
          </span>
        </div>
        <div className="text-sm text-white/85">{state.message}</div>
        {state.code && (
          <div className="text-[10px] tracking-wider text-white/35">#{state.code}</div>
        )}
        {onRetry && state.retryable !== false && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 rounded-md px-3 py-1.5 text-xs font-medium transition hover:brightness-110"
            style={{
              background: 'rgba(240, 198, 106, 0.12)',
              border: '1px solid rgba(240, 198, 106, 0.5)',
              color: 'rgba(240, 198, 106, 0.95)',
            }}
          >
            重新加载
          </button>
        )}
      </div>
    );
  }

  if (state.status === 'empty') {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 px-4 text-center ${className}`}
        style={containerStyle}
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{
            background: 'rgba(107, 160, 255, 0.08)',
            border: '1px dashed rgba(107, 160, 255, 0.35)',
          }}
        >
          <span className="text-base text-white/50">∅</span>
        </div>
        <div className="text-sm text-white/80">{state.title}</div>
        {state.description && (
          <div className="max-w-xs text-xs text-white/45">{state.description}</div>
        )}
        {emptyAction && <div className="mt-2">{emptyAction}</div>}
      </div>
    );
  }

  // state.status === 'ready'
  if (state.locked) {
    return (
      <div className={`relative ${className}`}>
        <div
          className="mb-3 flex items-center justify-between rounded-md px-3 py-2 text-xs"
          style={{
            background: 'rgba(240, 198, 106, 0.08)',
            border: '1px solid rgba(240, 198, 106, 0.35)',
            color: 'rgba(240, 198, 106, 0.95)',
          }}
          role="status"
        >
          <span className="flex items-center gap-2">
            <span className="font-semibold tracking-wide">
              {LOCK_LABEL[state.locked.reason]}
            </span>
            <span className="text-white/70">{state.locked.message}</span>
          </span>
        </div>
        <div aria-disabled className="pointer-events-none opacity-60 [filter:saturate(0.7)]">
          {children(state.data)}
        </div>
      </div>
    );
  }

  return <div className={className}>{children(state.data)}</div>;
}

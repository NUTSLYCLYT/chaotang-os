'use client';

/**
 * 钦天监 · 新能源信号观察(2026-07-04)
 *
 * 本仓无后台 cron(定时任务归后端 jiqun，前端不建第二套 runtime)——用"渲染即检查"替代：
 * 户部/工部工作台挂载时读 useIntelSignals()，筛出电池/新能源相关信号(复用 price-forecast.ts
 * 的 filterNewEnergySignals，单一关键词表)，按 firstSeenAt 取最近几条，排除本浏览器已关闭过的。
 *
 * "已读"机制判断:全仓搜索未找到既有的通用"已读/已关闭"记录模式(仅有 layout 里的一次性
 * FIRST_DECREE_FLAG 引导标记，非按 id 的通用 dismiss registry)。诚实 MVP：用 localStorage
 * 按 signal id 记忆已关闭——只在本浏览器生效，不跨设备/不写后端，足够"别每次刷新都弹同一条"。
 */
import { useEffect, useState, useCallback } from 'react';
import { useIntelSignals } from '@/lib/hooks/use-intel-signals';
import { filterNewEnergySignals } from '@/features/qintian/lib/price-forecast';
import type { IntelSignal } from '@/lib/contracts/intel';

const DISMISS_KEY = 'chaotang.qintian.signalWatch.dismissedIds';
const MAX_VISIBLE = 3;

function loadDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage 不可用(隐私模式等)→ 跳过持久化，不阻断主流程
  }
}

export interface SignalWatchResult {
  /** 最近的未关闭电池/新能源相关信号(最多 3 条)。 */
  visible: IntelSignal[];
  dismiss: (signalId: string) => void;
}

export function useNewEnergySignalWatch(): SignalWatchResult {
  const { signals } = useIntelSignals();
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setDismissed(loadDismissed());
  }, []);

  const dismiss = useCallback((signalId: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(signalId);
      saveDismissed(next);
      return next;
    });
  }, []);

  const relevant = filterNewEnergySignals(signals)
    .slice()
    .sort((a, b) => new Date(b.firstSeenAt).getTime() - new Date(a.firstSeenAt).getTime())
    .filter((s) => !dismissed.has(s.id))
    .slice(0, MAX_VISIBLE);

  return { visible: relevant, dismiss };
}

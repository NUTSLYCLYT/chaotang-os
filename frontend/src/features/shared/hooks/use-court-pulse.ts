'use client';

/**
 * 朝堂脉搏 · 全局 badge 数据 hook
 *
 * 供 dashboard sidebar / top bar 读取"今日真正重要的东西"：
 *   - 待批呈报数
 *   - 急报数
 *   - 警讯数
 *   - 执行中任务数
 *
 * 每 3 秒轮询一次。所有需要 badge 的地方都用这一个 hook。
 */

import { useEffect, useState, useCallback } from 'react';
import { chaotang } from '@/lib/api/chaotang';

export interface CourtPulse {
  pendingReviews: number;
  criticalSignals: number;
  warningSignals: number;
  runningTasks: number;
  totalTasks: number;
  totalSignals: number;
  hasEmergency: boolean;
  loading: boolean;
  source: 'real' | 'degraded';
}

const POLL_MS = 3000;

export function useCourtPulse(enabled = true): CourtPulse {
  const [state, setState] = useState<CourtPulse>({
    pendingReviews: 0,
    criticalSignals: 0,
    warningSignals: 0,
    runningTasks: 0,
    totalTasks: 0,
    totalSignals: 0,
    hasEmergency: false,
    loading: true,
    source: 'degraded',
  });

  const tick = useCallback(async () => {
    try {
      // chaotang.tasks() → /api/court/chaotang/tasks (BFF → jiqun_ai :8081)
      const tasks = await chaotang.tasks();
      const pendingReviews = tasks.filter((t) => (t as { status?: string }).status === 'approved').length;
      const runningTasks = tasks.filter(
        (t) => (t as { status?: string }).status === 'running' || (t as { status?: string }).status === 'processing',
      ).length;
      setState({
        pendingReviews,
        criticalSignals: 0,   // intel 端点暂无 chaotang.* 等价方法，归零
        warningSignals: 0,
        runningTasks,
        totalTasks: tasks.length,
        totalSignals: 0,
        hasEmergency: pendingReviews > 0,
        loading: false,
        source: 'real',
      });
    } catch {
      setState((s) => ({ ...s, loading: false, source: 'degraded' }));
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, tick]);

  return state;
}

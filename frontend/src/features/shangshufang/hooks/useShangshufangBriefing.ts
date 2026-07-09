'use client';

/**
 * useShangshufangBriefing
 *
 * 用 SWR 从 /api/court/shangshufang/briefing 获取上书房今日简报。
 * 数据源：Turso 直查（不再依赖外部 jiqun 服务）。
 *
 * 特性：
 *   - 60s 自动重验（revalidateOnFocus + refreshInterval）
 *   - 失败后返回空骨架，前端不崩
 *   - mutate 暴露给手动刷新（裁决后触发）
 */

import { useCallback, useEffect, useState } from 'react';
import type { ShangshufangBriefing } from '@/lib/contracts/shangshufang';
import { loopTraceIdForTask } from '@/core/courtos/loop-trace';
import {
  shangshufangHome,
  type ShangshufangDecisionTaskSummary,
  type ShangshufangHomeResponse,
} from '@/lib/jiqun-api';

const EMPTY_BRIEFING: ShangshufangBriefing = {
  dailyStats: { taskTotal: 0, pendingCount: 0, runningCount: 0, completedToday: 0 },
  chancellorItems: [],
  memorials: [],
  fetchedAt: new Date().toISOString(),
  // 尚未拿到任何真实数据：诚实标 unavailable（页面按 isLoading 屏蔽加载期闪烁）。
  sourceMode: 'unavailable',
};

function priorityForTask(task: ShangshufangDecisionTaskSummary): 'urgent' | 'high' | 'medium' | 'low' {
  if (task.risk_flags.some((risk) => ['需人工确认', '股权风险', '合同风险', '付款风险'].includes(risk))) {
    return 'urgent';
  }
  if (task.status === 'awaiting_decision' || task.unknown_gaps.length > 0) return 'high';
  return 'medium';
}

function tagForTask(task: ShangshufangDecisionTaskSummary): string {
  if (task.status === 'awaiting_decision') return '待裁 · 军机处回奏';
  if (task.status === 'awaiting_evidence') return '待补证 · 证据缺口';
  if (task.status === 'awaiting_confirm' || task.status === 'awaiting_emperor_confirm') return '待确认 · 丞相拟旨';
  if (task.status === 'reviewing') return '会审中 · 军机处';
  return `上书房 · ${task.status}`;
}

function decisionOptionsForTask(task: ShangshufangDecisionTaskSummary): string[] {
  if (task.status === 'awaiting_decision') return ['采纳', '补证', '复核', '驳回', '追问'];
  if (task.status === 'awaiting_evidence') return ['补证', '复核', '追问'];
  if (task.status === 'awaiting_confirm' || task.status === 'awaiting_emperor_confirm') return ['确认发起会审', '取消'];
  return ['查看状态'];
}

function mergeDecisionHome(
  briefing: ShangshufangBriefing,
  home: ShangshufangHomeResponse | undefined,
): ShangshufangBriefing {
  if (!home) return briefing;
  const decisionTasks = [...home.pending_decisions, ...home.pending_evidence_tasks];
  if (decisionTasks.length === 0) return briefing;

  const existingMemorialIds = new Set(briefing.memorials.map((item) => item.id));
  const existingChancellorIds = new Set(briefing.chancellorItems.map((item) => item.id));

  const memorials = decisionTasks
    .filter((task) => !existingMemorialIds.has(task.task_id))
    .map((task) => {
      const draft = task.draft_edict;
      const gaps = task.unknown_gaps.length ? `缺口：${task.unknown_gaps.join('、')}` : '暂无显式缺口';
      const risks = task.risk_flags.length ? `风险：${task.risk_flags.join('、')}` : '风险待复核';
      return {
        id: task.task_id,
        loopTraceId: task.loop_trace_id ?? loopTraceIdForTask(task.task_id),
        title: draft?.refined_edict || task.raw_question,
        summary: `${tagForTask(task)} · 来源 ${task.source_label}。${gaps}。${risks}。`,
        priority: priorityForTask(task),
        status: task.status,
        petitioner: '皇上原问',
        reporter: task.status === 'awaiting_decision' ? '军机处' : '丞相',
        sealDate: task.updated_at || task.created_at,
        decisionOptions: decisionOptionsForTask(task),
        enhancedSuggestion:
          draft?.refined_edict ||
          `请围绕“${task.raw_question}”继续形成可裁决、可归档的上书房任务。`,
        verdict: task.status === 'awaiting_decision' ? '圣裁建议：补证或复核' : undefined,
        citations: [],
      };
    });

  const chancellorItems = decisionTasks
    .filter((task) => !existingChancellorIds.has(`chancellor-${task.task_id}`))
    .map((task) => ({
      id: `chancellor-${task.task_id}`,
      loopTraceId: task.loop_trace_id ?? loopTraceIdForTask(task.task_id),
      title: task.draft_edict?.refined_edict || task.raw_question,
      tag: tagForTask(task),
      priority: priorityForTask(task),
      source: 'primary' as const,
      suggestedCommand: task.draft_edict?.refined_edict || task.raw_question,
      citations: [],
      recommendedMinisters: task.recommended_departments,
    }));

  const pendingCount =
    briefing.dailyStats.pendingCount +
    decisionTasks.filter((task) => ['awaiting_decision', 'awaiting_confirm', 'awaiting_emperor_confirm'].includes(task.status)).length;
  const runningCount =
    briefing.dailyStats.runningCount +
    decisionTasks.filter((task) => ['reviewing', 'awaiting_evidence'].includes(task.status)).length;

  return {
    ...briefing,
    sourceMode: briefing.sourceMode === 'unavailable' ? 'real' : briefing.sourceMode,
    dailyStats: {
      ...briefing.dailyStats,
      taskTotal: briefing.dailyStats.taskTotal + decisionTasks.length,
      pendingCount,
      runningCount,
    },
    chancellorItems: [...chancellorItems, ...briefing.chancellorItems],
    memorials: [...memorials, ...briefing.memorials],
  };
}

async function mergedBriefingFetcher(): Promise<ShangshufangBriefing> {
  const briefing = { ...EMPTY_BRIEFING, fetchedAt: new Date().toISOString() };
  const homeResult = await Promise.allSettled([shangshufangHome()]);
  const home = homeResult[0].status === 'fulfilled' ? homeResult[0].value : undefined;
  return mergeDecisionHome(briefing, home);
}

export function useShangshufangBriefing() {
  const [briefing, setBriefing] = useState<ShangshufangBriefing>(EMPTY_BRIEFING);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await mergedBriefingFetcher();
      setBriefing(next);
      setError(null);
      return next;
    } catch (err) {
      const nextError = err instanceof Error ? err : new Error('briefing failed');
      setError(nextError);
      console.warn('[useShangshufangBriefing] fetch failed:', nextError.message);
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      setIsLoading(true);
      try {
        const next = await mergedBriefingFetcher();
        if (!alive) return;
        setBriefing(next);
        setError(null);
      } catch (err) {
        if (!alive) return;
        const nextError = err instanceof Error ? err : new Error('briefing failed');
        setError(nextError);
        console.warn('[useShangshufangBriefing] fetch failed:', nextError.message);
      } finally {
        if (alive) setIsLoading(false);
      }
    }

    void load();
    const timer = window.setInterval(() => {
      void refresh();
    }, 60_000);
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  return {
    briefing,
    isLoading,
    isError: !!error,
    refresh,
  };
}

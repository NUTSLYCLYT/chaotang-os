/**
 * 指挥台数据 orchestrator
 *
 * 统一收拢 tasks / agentRuns / currentTask 的加载、错误、live 更新。
 * 所有页面组件都从这里拿数据，不再散落在多个 effect。
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, API_MODE } from '@/lib/api/client';
import { useAppStore } from '@/lib/store/app-store';
import type { Task, CreateTaskDto, ExecutionMode } from '@/types/task';
import type { AgentRun } from '@/types/agent';
import type { ManorAnalyzeResult } from '@/types/manor';
import { manorAdapter, type ManorStreamEvent } from '@/lib/api/adapters/manor-adapter';
import type { StageEntry, StageStatus } from './use-manor-stream';
import { inferManorDomain } from '@/lib/routing/infer-manor-domain';
import { useTaskAnimation } from './use-task-animation';
import { playDemoScript } from '@/lib/demo/script-player';
import { nvidiaMainScript } from '@/lib/demo/scripts/nvidia-main';
import { hrLaborDisputeScript } from '@/lib/demo/scripts/hr-labor-dispute';
import { healthCheckupScript } from '@/lib/demo/scripts/health-checkup';
import { intelBriefingScript } from '@/lib/demo/scripts/intel-briefing';
import { forecastAiAdoptionScript } from '@/lib/demo/scripts/forecast-ai-adoption';
import { legalContractReviewScript } from '@/lib/demo/scripts/legal-contract-review';
import { hrPerformanceReviewScript } from '@/lib/demo/scripts/hr-performance-review';
import { supplyChainRiskScript } from '@/lib/demo/scripts/supply-chain-risk';
import { financeBudgetAnalysisScript } from '@/lib/demo/scripts/finance-budget-analysis';
import { complianceAuditScript } from '@/lib/demo/scripts/compliance-audit';
import { emitAudit } from '@/lib/audit/audit-emitter';
import { trackEvent } from '@/lib/metrics';
import {
  reconcileDispatchedTaskList,
  removeOptimisticCommandTasks,
  shouldUseLocalCommandSimulation,
} from '../lib/command-dispatch-policy';
import { withBasePath } from '@/lib/base-path';

const NVIDIA_TRIGGERS = ['NVIDIA', 'nvidia', '英伟达', 'Nvidia'] as const;
const HR_TRIGGERS = ['劳动仲裁', '加班费', '员工离职', '裁员补偿'] as const;
const HEALTH_TRIGGERS = ['体检', '健康报告', '血压', '血糖', '体检数据'] as const;
const INTEL_TRIGGERS = ['情报快报', '锦衣卫', '昨夜情报', '情报摘要'] as const;
const FORECAST_TRIGGERS = ['AI 采纳', 'AI采纳', '跃迁', '2027 预测', '2027预测', 'AI 跃迁'] as const;
const LEGAL_CONTRACT_TRIGGERS = ['合同审查', '法律风险', '供应商合同'] as const;
const HR_PERF_TRIGGERS = ['绩效评估', '绩效争议', '员工异议'] as const;
const SUPPLY_CHAIN_TRIGGERS = ['供应商断供', '供应链风险', '供应链预警', '交付延迟'] as const;
const FINANCE_BUDGET_TRIGGERS = ['预算超支', '财务管控', '研发超支'] as const;
const COMPLIANCE_AUDIT_TRIGGERS = ['合规稽查', '数据合规', '个人信息保护稽查'] as const;

export type DataPhase = 'idle' | 'loading' | 'ready' | 'error';

interface UseCommandCenterDataResult {
  phase: DataPhase;
  error: string | null;
  tasks: Task[];
  runs: AgentRun[];
  currentTask: Task | null;
  taskRuns: AgentRun[];
  selectTask: (id: string | null) => void;
  submitCommand: (rawCommand: string, mode: ExecutionMode) => Promise<Task | null>;
  refresh: () => Promise<void>;
  manorResult: ManorAnalyzeResult | null;
  manorLoading: boolean;
  manorError: string | null;
  manorStages: StageEntry[];
  manorFallback: boolean;
}

const LIVE_POLL_MS = 1500;

async function getPinnedTaskFull(taskId: string): Promise<{ task: Task; runs: AgentRun[]; report: unknown } | null> {
  const response = await fetch(withBasePath(`/api/court/backend/tasks/${encodeURIComponent(taskId)}`), {
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`pinned_task_failed:${response.status}`);
  return response.json() as Promise<{ task: Task; runs: AgentRun[]; report: unknown }>;
}

function mergeTaskList(taskList: Task[], fullTask: Task | null): Task[] {
  if (!fullTask) return taskList;
  return [fullTask, ...taskList.filter((task) => task.id !== fullTask.id)];
}

export function useCommandCenterData(
  initialTaskId?: string,
): UseCommandCenterDataResult {
  const [phase, setPhase] = useState<DataPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const { animate: animateTask } = useTaskAnimation();
  const [manorResult, setManorResult] = useState<ManorAnalyzeResult | null>(null);
  const [manorLoading, setManorLoading] = useState(false);
  const [manorError, setManorError] = useState<string | null>(null);
  const [manorStages, setManorStages] = useState<StageEntry[]>([]);
  const [manorFallback, setManorFallback] = useState(false);

  const tasks = useAppStore((s) => s.tasks);
  const runs = useAppStore((s) => s.agentRuns);
  const currentTaskId = useAppStore((s) => s.currentTaskId);

  const currentTask: Task | null =
    tasks.find((t) => t.id === (initialTaskId ?? currentTaskId)) ??
    tasks[0] ??
    null;

  const taskRuns = currentTask
    ? runs.filter((r) => r.taskId === currentTask.id)
    : [];

  const refresh = useCallback(async () => {
    setPhase((p) => (p === 'ready' ? 'ready' : 'loading'));
    setError(null);
    try {
      const taskList = await api.tasks.list();
      const targetTaskId = initialTaskId ?? useAppStore.getState().currentTaskId ?? taskList[0]?.id ?? null;
      const full = targetTaskId
        ? initialTaskId
          ? await getPinnedTaskFull(targetTaskId)
          : await api.tasks.getFullTask(targetTaskId)
        : null;
      const agentRuns = full?.runs ?? (await api.agents.getStatusMatrix());
      const store = useAppStore.getState();
      store.setTasks(mergeTaskList(taskList, full?.task ?? null));
      store.setAgentRuns(agentRuns);
      if (targetTaskId) {
        store.selectTask(targetTaskId);
      } else if (!store.currentTaskId && taskList[0]) {
        store.selectTask(taskList[0].id);
      }
      setPhase('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
      setPhase('error');
    }
  }, [initialTaskId]);

  // initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      const store = useAppStore.getState();
      if (store.tasks.length === 0) {
        await refresh();
      } else if (initialTaskId && !store.tasks.some((task) => task.id === initialTaskId)) {
        await refresh();
      } else {
        setPhase('ready');
      }
      if (initialTaskId && store.currentTaskId !== initialTaskId) {
        store.selectTask(initialTaskId);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refresh, initialTaskId]);

  // lightweight polling for live runs (mock mode only effect: deterministic)
  useEffect(() => {
    if (phase !== 'ready' || !currentTask) return;
    const running = taskRuns.some((r) => r.state === 'running');
    if (!running) return;
    const timer = setInterval(async () => {
      try {
        const full = await api.tasks.getFullTask(currentTask.id);
        const store = useAppStore.getState();
        store.setTasks(store.tasks.map((task) => (task.id === full.task.id ? full.task : task)));
        store.setAgentRuns(full.runs);
      } catch {
        /* silent — polling should never surface */
      }
    }, LIVE_POLL_MS);
    return () => clearInterval(timer);
  }, [phase, currentTask, taskRuns]);

  const selectTask = useCallback((id: string | null) => {
    useAppStore.getState().selectTask(id);
    if (!id) return;
    void (async () => {
      try {
        const full = await api.tasks.getFullTask(id);
        const store = useAppStore.getState();
        store.setTasks(store.tasks.map((task) => (task.id === full.task.id ? full.task : task)));
        store.setAgentRuns(full.runs);
      } catch {
        /* silent */
      }
    })();
  }, []);

  const submitCommand = useCallback(
    async (rawCommand: string, mode: ExecutionMode): Promise<Task | null> => {
      if (!rawCommand.trim()) return null;
      try {
        setError(null);
        const dto: CreateTaskDto = { rawCommand: rawCommand.trim(), mode };
        const useLocalSimulation = shouldUseLocalCommandSimulation(API_MODE);
        const optimisticId = useLocalSimulation ? `tmp-${Date.now()}` : null;
        const store = useAppStore.getState();
        const ownerUserId = store.currentUserId ?? undefined;
        if (optimisticId) {
          const optimistic: Task = {
            id: optimisticId,
            title: rawCommand.trim().slice(0, 48) + (rawCommand.length > 48 ? '…' : ''),
            description: rawCommand.trim(),
            rawCommand: rawCommand.trim(),
            status: 'submitted',
            mode,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ownerUserId,
          };
          store.addTask(optimistic);
          store.selectTask(optimisticId);
        }
        emitAudit('submit_command', {
          targetId: optimisticId ?? 'pending-backend-dispatch',
          metadata: { title: rawCommand.trim().slice(0, 48) },
        });

        const real = await api.tasks.create(dto);
        // In real/hybrid mode, do not show success until the backend returns a real task.
        store.setTasks(
          reconcileDispatchedTaskList({
            tasks: useAppStore.getState().tasks,
            realTask: real,
            optimisticId,
            ownerUserId,
          }),
        );
        store.selectTask(real.id);

        if (useLocalSimulation) {
          animateTask(real.id);

          if (NVIDIA_TRIGGERS.some((kw) => rawCommand.includes(kw))) {
            void playDemoScript(nvidiaMainScript);
          } else if (HR_TRIGGERS.some((kw) => rawCommand.includes(kw))) {
            void playDemoScript(hrLaborDisputeScript);
          } else if (HEALTH_TRIGGERS.some((kw) => rawCommand.includes(kw))) {
            void playDemoScript(healthCheckupScript);
          } else if (INTEL_TRIGGERS.some((kw) => rawCommand.includes(kw))) {
            void playDemoScript(intelBriefingScript);
          } else if (FORECAST_TRIGGERS.some((kw) => rawCommand.includes(kw))) {
            void playDemoScript(forecastAiAdoptionScript);
          } else if (LEGAL_CONTRACT_TRIGGERS.some((kw) => rawCommand.includes(kw))) {
            void playDemoScript(legalContractReviewScript);
          } else if (HR_PERF_TRIGGERS.some((kw) => rawCommand.includes(kw))) {
            void playDemoScript(hrPerformanceReviewScript);
          } else if (SUPPLY_CHAIN_TRIGGERS.some((kw) => rawCommand.includes(kw))) {
            void playDemoScript(supplyChainRiskScript);
          } else if (FINANCE_BUDGET_TRIGGERS.some((kw) => rawCommand.includes(kw))) {
            void playDemoScript(financeBudgetAnalysisScript);
          } else if (COMPLIANCE_AUDIT_TRIGGERS.some((kw) => rawCommand.includes(kw))) {
            void playDemoScript(complianceAuditScript);
          }
        }

        // fire manor analysis concurrently — 双管齐下：
        //   1. /api/manor/stream · SSE 拿 stage 进度 · 7 位律师逐个就位
        //   2. /api/manor/analyze · 一次性拿完整结果（stream 不保证有 final envelope）
        const domain = inferManorDomain(rawCommand);
        const situation = rawCommand.trim();
        setManorResult(null);
        setManorError(null);
        setManorStages([]);
        setManorFallback(false);
        setManorLoading(true);
        const taskIdForReport = real.id;
        const manorStart = Date.now();
        trackEvent({ name: 'command_submitted', taskId: real.id, domain });

        // Stream: only update stages · 不负责 final
        void (async () => {
          try {
            for await (const ev of manorAdapter.stream({ domain, situation })) {
              applyStageEvent(setManorStages, setManorFallback, ev);
            }
          } catch {
            // SSE 失败不污染主流程 · analyze 还在跑
          }
        })();

        // Analyze: 真正的 final result
        manorAdapter
          .analyze({ domain, situation })
          .then((result) => {
            trackEvent({ name: 'manor_response_received', taskId: taskIdForReport, domain, durationMs: Date.now() - manorStart });
            setManorResult(result);
            useAppStore.getState().updateTask(taskIdForReport, { manorReport: result });
          })
          .catch((err: unknown) => {
            trackEvent({ name: 'task_failed', taskId: taskIdForReport, domain, reason: err instanceof Error ? err.message : 'unknown' });
            setManorError(err instanceof Error ? err.message : '庄园分析失败');
            useAppStore.getState().updateTask(taskIdForReport, { status: 'failed' });
          })
          .finally(() => {
            setManorLoading(false);
          });

        return real;
      } catch (err) {
        const store = useAppStore.getState();
        store.setTasks(removeOptimisticCommandTasks(store.tasks));
        if (store.currentTaskId?.startsWith('tmp-')) {
          store.selectTask(store.tasks.find((task) => !task.id.startsWith('tmp-'))?.id ?? null);
        }
        setError(err instanceof Error ? err.message : '发令失败');
        return null;
      }
    },
    [],
  );

  return {
    phase,
    error,
    tasks,
    runs,
    currentTask,
    taskRuns,
    selectTask,
    submitCommand,
    refresh,
    manorResult,
    manorLoading,
    manorError,
    manorStages,
    manorFallback,
  };
}

function normalizeStageStatus(s: string): StageStatus {
  if (s === 'running' || s === 'done' || s === 'failed') return s;
  if (s === 'ok' || s === 'completed') return 'done';
  if (s === 'error') return 'failed';
  return 'pending';
}

function applyStageEvent(
  setStages: React.Dispatch<React.SetStateAction<StageEntry[]>>,
  setFallback: React.Dispatch<React.SetStateAction<boolean>>,
  ev: ManorStreamEvent,
) {
  switch (ev.type) {
    case 'stage_add':
      setStages((cur) =>
        cur.find((x) => x.name === ev.name)
          ? cur
          : [...cur, { name: ev.name, status: 'pending' as StageStatus }],
      );
      return;
    case 'stage_update':
      setStages((cur) =>
        cur.map((x) =>
          x.name === ev.name
            ? { ...x, status: normalizeStageStatus(ev.status), message: ev.message }
            : x,
        ),
      );
      return;
    case 'done':
      setStages((cur) =>
        cur.map((x) => (x.status === 'running' ? { ...x, status: 'done' } : x)),
      );
      return;
    case 'fallback':
      setFallback(true);
      return;
    default:
      return;
  }
}

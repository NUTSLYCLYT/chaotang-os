'use client';

/**
 * useJiqunRunProgress — 后端蜂群任务进度追踪（闭合"密旨/圣旨→后端执行→回奏"环）
 *
 * 2026-06-11 实测缺口：orchestrate/all 返回 jiqunSwarm.taskId/streamUrl 后，上书房
 * 只渲染一行静态文本，后端任务跑死跑活 UI 全程失明（任务实际已 error 仍显示"密报已成"）。
 * 本 hook 消费既有 SSE 代理 /jiqun/api/runs/stream/{taskId}（事件：route/swarm_start/
 * step/swarm_done/done/error），SSE 断线时降级轮询 /runs/stream/{taskId}/status，
 * 把执行进度与终态（含失败原因）交还陛下。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { jiqunFetcher, type JiqunSessionSummary } from '@/lib/jiqun-api';

export interface JiqunRunProgress {
  taskId: string | null;
  status: 'idle' | 'running' | 'done' | 'error';
  /** 意图路由结果（route 事件）：入口蜂群 + 原因 */
  routedSwarm: string | null;
  /** 当前执行中的蜂群名（swarm_start 事件） */
  swarmName: string | null;
  /** 已完成蜂群数（swarm_done 事件计数） */
  swarmsDone: number;
  /** 当前步骤进度（step 事件） */
  step: number;
  total: number;
  stepName: string | null;
  /** done 事件返回的编排会话 id，用于跳转流程详情 */
  sessionId: string | null;
  error: string | null;
}

export type JiqunRunTrackRef =
  | string
  | {
      taskId?: string | null;
      sessionId?: string | null;
    };

const IDLE: JiqunRunProgress = {
  taskId: null,
  status: 'idle',
  routedSwarm: null,
  swarmName: null,
  swarmsDone: 0,
  step: 0,
  total: 0,
  stepName: null,
  sessionId: null,
  error: null,
};

const POLL_INTERVAL_MS = 5_000;
const JIQUN_BACKEND_BASE = (
  process.env.NEXT_PUBLIC_JIQUN_API_URL ??
  process.env.NEXT_PUBLIC_CHAOTANG_API_URL ??
  'http://localhost:8081'
).replace(/\/$/, '');
const POLL_MAX_MS = 15 * 60_000; // 蜂群链路可达数分钟，超时后停表并标错

function isDoneStatus(status: string): boolean {
  return /^(completed|complete|done|pass)$/i.test(status);
}

function isErrorStatus(status: string): boolean {
  return /^(failed|fail|error|blocked)$/i.test(status);
}

interface StreamEvent {
  type?: string;
  swarm?: string | null;
  reason?: string;
  swarm_id?: string;
  name?: string;
  step?: number;
  total?: number;
  status?: string;
  session_id?: string;
  message?: string;
  error?: string;
}

export function useJiqunRunProgress() {
  const [progress, setProgress] = useState<JiqunRunProgress>(IDLE);
  const esRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const terminalRef = useRef(false);

  const cleanup = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    if (pollTimerRef.current != null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const reset = useCallback(() => {
    terminalRef.current = false;
    cleanup();
    setProgress(IDLE);
  }, [cleanup]);

  /** SSE 不可用时的兜底：轮询任务状态直到终态。 */
  const startPolling = useCallback(
    (taskId: string) => {
      if (pollTimerRef.current != null) return;
      const startedAt = Date.now();
      pollTimerRef.current = window.setInterval(async () => {
        if (terminalRef.current) {
          cleanup();
          return;
        }
        try {
          const s = await jiqunFetcher<{ status: string; run_id?: string | null; error?: string | null }>(
            `/runs/stream/${encodeURIComponent(taskId)}/status`,
          );
          if (s.status === 'done') {
            terminalRef.current = true;
            cleanup();
            setProgress((p) => ({ ...p, status: 'done', sessionId: s.run_id ?? p.sessionId }));
          } else if (s.status === 'error') {
            terminalRef.current = true;
            cleanup();
            setProgress((p) => ({ ...p, status: 'error', error: s.error ?? '后端蜂群执行失败' }));
          }
        } catch {
          /* 单次轮询失败不终止，等下一轮 */
        }
        if (Date.now() - startedAt > POLL_MAX_MS && !terminalRef.current) {
          terminalRef.current = true;
          cleanup();
          setProgress((p) => ({ ...p, status: 'error', error: '执行超时未回报，请前往庄园主页查看' }));
        }
      }, POLL_INTERVAL_MS);
    },
    [cleanup],
  );

  const startSessionPolling = useCallback(
    (sessionId: string) => {
      if (pollTimerRef.current != null) return;
      const startedAt = Date.now();
      pollTimerRef.current = window.setInterval(async () => {
        if (terminalRef.current) {
          cleanup();
          return;
        }
        try {
          const s = await jiqunFetcher<JiqunSessionSummary>(
            `/swarm/sessions/${encodeURIComponent(sessionId)}`,
          );
          const swarmsDone = Number(s.completed_count ?? 0);
          const total = Number(s.swarm_count ?? 0);
          setProgress((p) => ({
            ...p,
            sessionId: s.session_id || sessionId,
            swarmsDone,
            total,
          }));

          if (isDoneStatus(s.status)) {
            terminalRef.current = true;
            cleanup();
            setProgress((p) => ({
              ...p,
              status: 'done',
              sessionId: s.session_id || sessionId,
              swarmsDone,
              total,
            }));
          } else if (isErrorStatus(s.status)) {
            terminalRef.current = true;
            cleanup();
            setProgress((p) => ({
              ...p,
              status: 'error',
              sessionId: s.session_id || sessionId,
              swarmsDone,
              total,
              error: '后端执行失败，请前往庄园主页查看详情',
            }));
          }
        } catch {
          /* session 文件可能尚未落盘，等下一轮 */
        }
        if (Date.now() - startedAt > POLL_MAX_MS && !terminalRef.current) {
          terminalRef.current = true;
          cleanup();
          setProgress((p) => ({ ...p, status: 'error', error: '执行超时未回报，请前往庄园主页查看' }));
        }
      }, POLL_INTERVAL_MS);
    },
    [cleanup],
  );

  /** 开始追踪一个后端任务（orchestrate/all 返回 jiqunSwarm.taskId 后调用）。 */
  const track = useCallback(
    (ref: JiqunRunTrackRef) => {
      const taskId = typeof ref === 'string' ? ref : ref.taskId ?? null;
      const sessionId = typeof ref === 'string' ? null : ref.sessionId ?? null;
      if (!taskId && !sessionId) return;

      terminalRef.current = false;
      cleanup();
      setProgress({ ...IDLE, taskId, sessionId, status: 'running' });

      if (!taskId) {
        startSessionPolling(sessionId!);
        return;
      }

      const es = new EventSource(`${JIQUN_BACKEND_BASE}/api/runs/stream/${encodeURIComponent(taskId)}`);
      esRef.current = es;

      es.onmessage = (e: MessageEvent) => {
        let ev: StreamEvent;
        try {
          ev = JSON.parse(e.data) as StreamEvent;
        } catch {
          return;
        }
        switch (ev.type) {
          case 'heartbeat':
            return;
          case 'route':
            setProgress((p) => ({ ...p, routedSwarm: ev.swarm ?? null }));
            return;
          case 'swarm_start':
            setProgress((p) => ({ ...p, swarmName: ev.name ?? ev.swarm_id ?? null, step: 0, total: 0, stepName: null }));
            return;
          case 'step':
            setProgress((p) => ({
              ...p,
              step: (ev.step ?? 0) + 1,
              total: ev.total ?? p.total,
              stepName: ev.name ?? p.stepName,
            }));
            return;
          case 'swarm_done':
            setProgress((p) => ({ ...p, swarmsDone: p.swarmsDone + 1 }));
            return;
          case 'done':
            terminalRef.current = true;
            es.close();
            setProgress((p) => ({ ...p, status: 'done', sessionId: ev.session_id ?? p.sessionId }));
            return;
          case 'error':
            terminalRef.current = true;
            es.close();
            setProgress((p) => ({ ...p, status: 'error', error: ev.message ?? ev.error ?? '后端蜂群执行失败' }));
            return;
          default:
            return;
        }
      };

      es.onerror = () => {
        if (terminalRef.current) return;
        // SSE 断流（代理缓冲/网络/任务不存在）→ 降级轮询，不让陛下失明
        es.close();
        startPolling(taskId);
      };
    },
    [cleanup, startPolling, startSessionPolling],
  );

  return { progress, track, reset };
}

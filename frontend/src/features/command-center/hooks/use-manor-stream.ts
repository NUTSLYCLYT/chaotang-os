/**
 * 朝堂 OS · useManorStream
 *
 * 把 /api/manor/stream 的 SSE 包成 React hook，逐帧更新 stage list。
 * 同时 kick off /api/manor/analyze 拿最终结果（legal-agent stream 的 done 事件
 * 不保证包含完整 envelope，用 JSON 端点聚合）。
 *
 * 对 UI：
 *   stages     : 专家就位进度 · 每位律师/分析师独立 status
 *   finalResult: 最终分析报告 · analyze 端点返回
 *   loading    : 整个流程未完成
 *   error      : 任一环节失败
 *
 * 调用方式：
 *   const { stages, finalResult, loading, error, run, abort } = useManorStream();
 *   <button onClick={() => run({ domain, situation })}>分析</button>
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import type { ManorAnalyzeRequest, ManorAnalyzeResult } from '@/types/manor';
import { manorAdapter, type ManorStreamEvent } from '@/lib/api/adapters/manor-adapter';

export type StageStatus = 'pending' | 'running' | 'done' | 'failed';

export interface StageEntry {
  name: string;
  status: StageStatus;
  message?: string;
}

interface State {
  stages: StageEntry[];
  finalResult: ManorAnalyzeResult | null;
  loading: boolean;
  error: string | null;
  /** 是否走了降级路径 */
  fallback: boolean;
}

const INITIAL: State = {
  stages: [],
  finalResult: null,
  loading: false,
  error: null,
  fallback: false,
};

export function useManorStream() {
  const [state, setState] = useState<State>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const run = useCallback(async (req: ManorAnalyzeRequest) => {
    // 取消先前任务
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setState({ ...INITIAL, loading: true });

    // 并行两条流：SSE 拿进度 / analyze 拿最终结果
    // · 任一失败不阻塞另一路
    // · 客户端 abort 同时取消两路
    const streamPromise = (async () => {
      try {
        for await (const ev of manorAdapter.stream(req, ctrl.signal)) {
          applyStreamEvent(setState, ev);
        }
      } catch (err) {
        // abort 不算失败 · 组件卸载或用户换页触发
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // SSE 挂了不污染最终结果 · 只提示
        setState((s) => ({
          ...s,
          stages:
            s.stages.length === 0
              ? [{ name: '上游流式通道', status: 'failed', message: err instanceof Error ? err.message : 'stream error' }]
              : s.stages,
        }));
      }
    })();

    const analyzePromise = (async () => {
      try {
        const result = await manorAdapter.analyze(req);
        setState((s) => ({
          ...s,
          finalResult: result,
          loading: false,
        }));
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setState((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : '庄园分析失败',
        }));
      }
    })();

    await Promise.allSettled([streamPromise, analyzePromise]);
    // loading 由 analyze 路控制收尾；若 analyze 成功但 SSE 还未收 eof，也视为完成
    setState((s) => ({ ...s, loading: false }));
  }, []);

  return { ...state, run, abort };
}

function applyStreamEvent(
  setState: React.Dispatch<React.SetStateAction<State>>,
  ev: ManorStreamEvent,
) {
  switch (ev.type) {
    case 'open':
      // 无动作 · 首帧确认通道建立
      return;
    case 'stage_add':
      setState((s) => {
        if (s.stages.find((x) => x.name === ev.name)) return s;
        return { ...s, stages: [...s.stages, { name: ev.name, status: 'pending' }] };
      });
      return;
    case 'stage_update':
      setState((s) => ({
        ...s,
        stages: s.stages.map((x) =>
          x.name === ev.name
            ? { ...x, status: normalizeStatus(ev.status), message: ev.message }
            : x,
        ),
      }));
      return;
    case 'done':
      setState((s) => ({
        ...s,
        stages: s.stages.map((x) => (x.status === 'running' ? { ...x, status: 'done' } : x)),
      }));
      return;
    case 'error':
      setState((s) => ({ ...s, error: ev.message }));
      return;
    case 'fallback':
      setState((s) => ({ ...s, fallback: true }));
      return;
    case 'eof':
      return;
  }
}

function normalizeStatus(s: string): StageStatus {
  if (s === 'running' || s === 'done' || s === 'failed') return s;
  if (s === 'ok' || s === 'completed') return 'done';
  if (s === 'error') return 'failed';
  return 'pending';
}

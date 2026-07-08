'use client';

/**
 * 真链 BFF 派发+轮询 hook(2026-07-03 通电)。
 *
 * 三个"真链BFF"(吏部招聘/刑部法律会诊/工部PACK可行性)协议同构——POST 派发拿 trace_id，
 * GET /result?sid= 轮询直到 status 变成 completed/error/failed——但响应字段各异(吏部
 * data/verdict，刑部 consequentialFields/humanConfirmationRequired，工部
 * lockedProductionFields)。本 hook 只管通用协议这层，具体字段解读交给各自面板组件
 * (TResult 泛型由调用方指定，做完只拿到原始 payload)。
 */
import { useCallback, useRef, useState } from 'react';
import { withBasePath } from '@/lib/base-path';

export type SwarmDispatchPollState<TResult> =
  | { phase: 'idle' }
  | { phase: 'dispatching' }
  | { phase: 'polling'; traceId: string }
  | { phase: 'done'; traceId: string; result: TResult }
  | { phase: 'error'; message: string };

interface PollEnvelope {
  status?: string;
  message?: string;
}

const POLL_INTERVAL_MS = 2500;
/** 轮询上限 ~50s；超时不代表蜂群失败，只代表前端不再等，用户可用同一入口重派。 */
const MAX_POLLS = 20;

export function useSwarmDispatchPoll<TResult extends PollEnvelope>(dispatchPath: string, resultPath: string) {
  const [state, setState] = useState<SwarmDispatchPollState<TResult>>({ phase: 'idle' });
  const cancelledRef = useRef(false);

  const dispatch = useCallback(
    async (taskInput: string) => {
      cancelledRef.current = false;
      setState({ phase: 'dispatching' });
      try {
        const res = await fetch(withBasePath(dispatchPath), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ task_input: taskInput }),
        });
        const envelope = (await res.json().catch(() => ({}))) as { trace_id?: string | null; message?: string };
        if (!envelope.trace_id) {
          setState({ phase: 'error', message: envelope.message ?? '派发失败，未拿到可追踪的 trace_id' });
          return;
        }
        const traceId = envelope.trace_id;
        setState({ phase: 'polling', traceId });

        for (let i = 0; i < MAX_POLLS; i += 1) {
          if (cancelledRef.current) return;
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
          if (cancelledRef.current) return;
          const pollRes = await fetch(withBasePath(`${resultPath}?sid=${encodeURIComponent(traceId)}`));
          const payload = (await pollRes.json().catch(() => ({}))) as TResult;
          if (payload.status === 'completed' || payload.status === 'error' || payload.status === 'failed') {
            setState({ phase: 'done', traceId, result: payload });
            return;
          }
          // 仍在跑(running/queued/unknown)，继续轮询。
        }
        setState({ phase: 'error', message: '轮询超时(蜂群可能仍在后台跑，可稍后重新派发)' });
      } catch (e) {
        setState({ phase: 'error', message: e instanceof Error ? e.message : '网络异常' });
      }
    },
    [dispatchPath, resultPath],
  );

  const reset = useCallback(() => {
    cancelledRef.current = true;
    setState({ phase: 'idle' });
  }, []);

  return { state, dispatch, reset };
}

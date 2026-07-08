'use client';

/**
 * useOrchestrationRun
 *
 * 下旨流水线 SSE hook：POST /api/orchestration/run，消费 SSE 事件流。
 *
 * 特性：
 *   - 流式进度反馈（stage_start / stage_progress / retrieve_done / zhongshu_done…）
 *   - 支持 citations 从 zhongshu_done 事件中提取
 *   - 组件卸载时自动 abort（防 leak）
 *   - 返回 run(command) 触发函数、status、progressMsg、citations、taskId
 */

import { useCallback, useRef, useState } from 'react';
import type { PipelineStageEvent } from '@/lib/contracts/shangshufang';
import type { Citation } from '@/lib/contracts/decree';
import { withBasePath } from '@/lib/base-path';

export type OrchestrationStatus =
  | 'idle'
  | 'running'
  | 'done'
  | 'error';

export interface OrchestrationState {
  status: OrchestrationStatus;
  progressMsg: string | null;
  citations: Citation[];
  taskId: string | null;
  finalDecision: string | null;
  approved: boolean | null;
}

const INITIAL_STATE: OrchestrationState = {
  status: 'idle',
  progressMsg: null,
  citations: [],
  taskId: null,
  finalDecision: null,
  approved: null,
};

// 大神会审(Jobs 隐喻纯度)：emoji 在圣旨语境如 Comic Sans 混进金石字——
// 一律换成朱砂金石符〔察/草/覆/颁/档…〕，与帝金/朱砂色板同一品味。
const STAGE_LABEL: Record<string, string> = {
  retrieve: '〔察〕锦衣卫密探已出京，正搜寻情报案卷…',
  zhongshu: '〔草〕中书省诸葛大人开始起草奏稿…',
  menxia: '〔覆〕门下省魏徵大人正在覆核驳议…',
  shangshu: '〔颁〕尚书省苏秦大人领旨，分派六部执行…',
  persist: '〔档〕史馆史官正将决议入档存卷…',
};

export function useOrchestrationRun() {
  const [state, setState] = useState<OrchestrationState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (command: string): Promise<void> => {
    // 取消上一次未完成的流
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setState({
      status: 'running',
      progressMsg: '〔颁旨〕圣旨已递，三省审议启动，群臣待命…',
      citations: [],
      taskId: null,
      finalDecision: null,
      approved: null,
    });

    try {
      // 获取 auth token（可选）
      let authHeader: string | undefined;
      if (typeof window !== 'undefined') {
        const { getToken } = await import('@/lib/auth');
        const token = getToken();
        if (token) authHeader = `Bearer ${token}`;
      }

      const res = await fetch(withBasePath('/api/orchestration/run'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({ command }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          progressMsg: `三省审议通道不通（${res.status}），请稍后重试。`,
        }));
        return;
      }

      // 逐行解析 SSE
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      const handleEvent = (raw: string) => {
        let ev: PipelineStageEvent;
        try { ev = JSON.parse(raw) as PipelineStageEvent; } catch { return; }

        switch (ev.type) {
          case 'stage_start':
            setState((prev) => ({
              ...prev,
              progressMsg: STAGE_LABEL[ev.stage] ?? `${ev.stage} 启动…`,
            }));
            break;
          case 'stage_progress':
            setState((prev) => ({ ...prev, progressMsg: ev.message }));
            break;
          case 'retrieve_done':
            setState((prev) => ({
              ...prev,
              progressMsg: `〔察〕锦衣卫回报：${ev.tavilyCitations} 条情报 · ${ev.precedents} 条史馆案例，中书省开始起草…`,
            }));
            break;
          case 'zhongshu_done': {
            const cits = ev.draft?.citations ?? [];
            setState((prev) => ({
              ...prev,
              progressMsg: '〔草〕中书省草案已就，呈门下省魏徵大人覆核…',
              citations: cits,
              finalDecision: ev.draft?.decision ?? null,
            }));
            break;
          }
          case 'menxia_done':
            setState((prev) => ({
              ...prev,
              approved: ev.review?.approved ?? null,
              progressMsg: ev.review?.approved
                ? '〔准〕门下省准奏！尚书省苏秦大人已领旨，正分派六部落地…'
                : `〔疑〕门下省存疑：${ev.review?.comments ?? '史馆查无先例，需补充情报'}`,
            }));
            break;
          case 'shangshu_done':
            setState((prev) => ({
              ...prev,
              taskId: (ev.execution as { taskId?: string })?.taskId ?? null,
              progressMsg: '〔行〕六部已奉旨执行，史馆史官正在存档…',
            }));
            break;
          case 'persist_done':
            setState((prev) => ({
              ...prev,
              taskId: ev.taskId ?? prev.taskId,
              progressMsg: '〔档〕决议与任务已入主库，上书房稍后可读回。',
            }));
            break;
          case 'pipeline_done':
          case 'eof':
            setState((prev) => ({
              ...prev,
              status: 'done',
              progressMsg: prev.approved === false
                ? `门下省驳议，圣旨需重议。${prev.finalDecision ?? ''}`
                : `〔成〕三省议决完毕！${prev.taskId ? `蜂群任务 ${prev.taskId} 已创建` : '旨意已落地'}`,
            }));
            break;
          case 'error':
          case 'stage_error':
            setState((prev) => ({
              ...prev,
              status: 'error',
              progressMsg: `〔误〕议事出错，请稍后重试：${ev.message ?? (ev as { error?: string }).error ?? 'unknown'}`,
            }));
            break;
        }
      };

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // 按 SSE \n\n 分割
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data:')) {
              handleEvent(line.slice(5).trim());
            }
          }
        }
      }

      // 流读完但 pipeline_done 可能已经设置了状态
      setState((prev) =>
        prev.status === 'running'
          ? { ...prev, status: 'done', progressMsg: '审议流程已完成。' }
          : prev,
      );
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
      setState((prev) => ({
        ...prev,
        status: 'error',
        progressMsg: `下旨失败：${err instanceof Error ? err.message : String(err)}`,
      }));
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(INITIAL_STATE);
  }, []);

  return { state, run, reset };
}

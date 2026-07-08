'use client';

/**
 * 朝堂 OS · 锦衣卫 Bottom Dock 问报 Hook
 *
 * 调用 /api/orchestration/run（三省 SSE 流水线），携带 COURT_TOOLS。
 * 返回含 citations 的流式响应——从 zhongshu_done / menxia_done 事件中提取。
 *
 * 与通用 useDockChat 的区别：
 *   1. 目标端点是 /api/orchestration/run（SSE，POST）
 *   2. 解析 SSE 事件流，提取 zhongshu.citations 作为来源标注
 *   3. 最终消息包含可信度信息
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DockMessage } from '@/features/shared/components/bottom-dock';

export interface IntelDockMessage extends DockMessage {
  /** 来自 zhongshu 草稿的引用来源 */
  citations?: Array<{ title: string; url?: string; domain?: string }>;
}

/** SSE 事件解析 */
function parseSseChunk(chunk: string): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = [];
  const parts = chunk.split('\n\n');
  for (const part of parts) {
    const lines = part.split('\n');
    let event = 'message';
    let data = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        event = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        data = line.slice(6).trim();
      }
    }
    if (data) events.push({ event, data });
  }
  return events;
}

export function useIntelDockChat(initialGreeting: string) {
  const [messages, setMessages] = useState<IntelDockMessage[]>([
    { role: 'agent', text: initialGreeting, time: '刚刚' },
  ]);

  const streamingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const handleSend = useCallback(async (text: string) => {
    if (streamingRef.current) return;
    streamingRef.current = true;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { role: 'user', text, time: now }]);
    const agentTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { role: 'agent', text: '正在向三省请示…', time: agentTime }]);

    let finalText = '';
    let citations: IntelDockMessage['citations'] = [];

    try {
      const res = await fetch('/api/orchestration/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command: text }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error(`upstream ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (controller.signal.aborted) break;

        buffer += decoder.decode(value, { stream: true });
        const boundary = buffer.lastIndexOf('\n\n');
        if (boundary === -1) continue;

        const complete = buffer.slice(0, boundary + 2);
        buffer = buffer.slice(boundary + 2);

        const events = parseSseChunk(complete);
        for (const { event, data } of events) {
          if (!data || data === '') continue;

          try {
            const payload = JSON.parse(data) as Record<string, unknown>;

            if (event === 'zhongshu_done') {
              const draft = payload.draft as Record<string, unknown> | undefined;
              if (draft) {
                const draftText = typeof draft.draft === 'string' ? draft.draft : '';
                const rawCitations = Array.isArray(draft.citations) ? draft.citations : [];
                citations = rawCitations
                  .filter((c) => c && typeof c === 'object')
                  .map((c) => ({
                    title: String((c as Record<string, unknown>).title ?? ''),
                    url: typeof (c as Record<string, unknown>).url === 'string'
                      ? String((c as Record<string, unknown>).url)
                      : undefined,
                    domain: typeof (c as Record<string, unknown>).domain === 'string'
                      ? String((c as Record<string, unknown>).domain)
                      : undefined,
                  }));

                // Update message with draft text while waiting for menxia
                if (draftText) {
                  setMessages((prev) => {
                    const next = [...prev];
                    next[next.length - 1] = {
                      role: 'agent',
                      text: draftText + '\n\n_门下省审议中…_',
                      time: agentTime,
                      citations,
                    };
                    return next;
                  });
                }
              }
            }

            if (event === 'pipeline_done') {
              const result = payload.result as Record<string, unknown> | undefined;
              if (result) {
                const zhongshu = result.zhongshu as Record<string, unknown> | undefined;
                const menxia = result.menxia as Record<string, unknown> | undefined;
                const verdict = typeof result.finalVerdict === 'string' ? result.finalVerdict : '';

                const zhongshuText = typeof zhongshu?.draft === 'string' ? zhongshu.draft : '';
                const menxiaReasoning = typeof menxia?.reasoning === 'string' ? menxia.reasoning : '';

                const verdictLabel = verdict === '准' ? '✅ 准奏' : verdict === '再议' ? '🔄 再议' : '❌ 驳回';

                finalText = zhongshuText
                  ? `${zhongshuText}\n\n**${verdictLabel}**：${menxiaReasoning}`
                  : `**${verdictLabel}**：${menxiaReasoning}`;
              }
            }

            if (event === 'stage_error') {
              const errMsg = typeof payload.error === 'string' ? payload.error : '流水线阶段失败';
              console.warn('[IntelDockChat] stage_error:', payload.stage, errMsg);
            }
          } catch {
            // non-JSON SSE comment / heartbeat — ignore
          }
        }
      }

      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'agent',
          text: finalText || '臣已禀报完毕，陛下可继续问报。',
          time: agentTime,
          citations: (citations ?? []).length > 0 ? citations : undefined,
        };
        return next;
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('[IntelDockChat] error:', err);
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'agent',
          text: '三省暂时无法会审，请稍后再问。',
          time: agentTime,
        };
        return next;
      });
    } finally {
      streamingRef.current = false;
    }
  }, []);

  return { messages, handleSend };
}

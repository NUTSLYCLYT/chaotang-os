'use client';

/**
 * 史馆 · useOrchestrationChat
 *
 * 与 useDockChat 同接口，但发送目标为 /api/orchestration/run（SSE 三省会审流）。
 * body 格式：{ command: string }（orchestration route 要求）。
 *
 * SSE 响应是多事件流（event: zhongshu_done / menxia_done / …），
 * 此处逐行拼接 data 字段中的 text/summary 到对话气泡。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DockMessage } from '@/features/shared/components/bottom-dock';
import { backendFetch } from '@/lib/backend-api';

export function useOrchestrationChat(initialGreeting: string) {
  const [messages, setMessages] = useState<DockMessage[]>([
    { role: 'agent', text: initialGreeting, time: '刚刚' },
  ]);

  const streamingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const handleSend = useCallback(async (text: string) => {
    if (streamingRef.current) return;
    // /api/orchestration/run 需要至少 5 个字
    const command = text.trim().length < 5 ? `${text.trim()} 请太史令回禀` : text.trim();
    streamingRef.current = true;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { role: 'user', text, time: now }]);
    const agentTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { role: 'agent', text: '太史令正在翻阅档案…▋', time: agentTime }]);

    try {
      const res = await backendFetch('/api/orchestration/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error(`orchestration ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      let done = false;
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          // SSE 格式：event: <name>\ndata: <json>\n\n
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const raw = line.slice(5).trim();
            if (!raw || raw === '[DONE]') continue;
            try {
              const payload = JSON.parse(raw) as {
                type?: string;
                draft?: { summary?: string; recommendation?: string };
                review?: { verdict?: string; summary?: string };
                execution?: { summary?: string };
                message?: string;
              };
              // 取不同阶段的文本摘要
              let fragment = '';
              if (payload.type === 'zhongshu_done' && payload.draft?.summary) {
                fragment = `【中书草案】${payload.draft.summary}`;
              } else if (payload.type === 'menxia_done' && payload.review?.summary) {
                fragment = `\n\n【门下审核】${payload.review.verdict ?? ''} ${payload.review.summary}`;
              } else if (payload.type === 'shangshu_done' && payload.execution?.summary) {
                fragment = `\n\n【尚书落地】${payload.execution.summary}`;
              } else if (payload.type === 'pipeline_done') {
                fragment = '';
              } else if (payload.type === 'error') {
                fragment = `\n\n❌ ${payload.message ?? '流程异常'}`;
              }
              if (fragment) {
                accumulated += fragment;
                setMessages((prev) => {
                  const next = [...prev];
                  next[next.length - 1] = { role: 'agent', text: accumulated + '▋', time: agentTime };
                  return next;
                });
              }
            } catch {
              /* ignore malformed SSE chunks */
            }
          }
        }
      }

      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'agent',
          text: accumulated || '太史令已翻阅档案，但无额外摘要，请直接查看史馆记录。',
          time: agentTime,
        };
        return next;
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'agent',
          text: '太史令一时无对 · 请陛下再次下旨。',
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

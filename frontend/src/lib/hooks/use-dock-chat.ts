'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DockMessage } from '@/features/shared/components/bottom-dock';
import { backendFetch } from '@/lib/backend-api';
import { streamSseTokens } from '@/lib/sse-tokens';

function readResponseText(record: Record<string, unknown> | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function fallbackReply(apiPath: string, text: string): string {
  if (apiPath.includes('/api/shangshufang/chancellor-chat')) {
    const command = text.trim();
    return [
      '臣先按丞相单 Agent 兜底初判：当前丞相后端对话端点暂未连通，未召军机处，也未启动六部会审。',
      command ? `所问：${command}` : null,
      '建议先把目标、现有证据、缺口和期望产出各补一句；若要正式执行，再走下旨流程。',
    ].filter(Boolean).join('\n\n');
  }
  if (apiPath.includes('/api/qintian/chat')) {
    return '钦天监暂未连通；可先补充时间窗口、关键风险和要比较的方案，再继续占验。';
  }
  return '当前对话端点暂未连通，请稍后再试。';
}

/** Drop-in replacement for the setTimeout+mockReply pattern in all bottom docks */
export function useDockChat(
  initialGreeting: string,
  apiPath = '/api/chat',
) {
  const [messages, setMessages] = useState<DockMessage[]>([
    { id: 'initial-greeting', role: 'agent', text: initialGreeting, time: '刚刚' },
  ]);

  const messageSeqRef = useRef(0);
  const streamingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const nextMessageId = useCallback((role: DockMessage['role']) => {
    messageSeqRef.current += 1;
    return `${role}-${Date.now()}-${messageSeqRef.current}`;
  }, []);

  const appendUserMessage = useCallback((text: string) => {
    const message = text.trim();
    if (!message) return;
    const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { id: nextMessageId('user'), role: 'user', text: message, time: now }]);
  }, [nextMessageId]);

  const handleSend = useCallback(async (text: string) => {
    if (streamingRef.current) return;
    streamingRef.current = true;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { id: nextMessageId('user'), role: 'user', text, time: now }]);
    const agentTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const agentMessageId = nextMessageId('agent');
    setMessages((prev) => [...prev, { id: agentMessageId, role: 'agent', text: '▋', time: agentTime }]);

    try {
      const res = await backendFetch(apiPath, {
        method: 'POST',
        headers: { accept: 'text/event-stream, application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('upstream');

      let accumulated = '';
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('text/event-stream') && res.body) {
        for await (const token of streamSseTokens(res.body)) {
          accumulated += token;
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { id: agentMessageId, role: 'agent', text: accumulated + '▋', time: agentTime };
            return next;
          });
        }
      } else {
        const json = await res.json().catch(() => null) as Record<string, unknown> | null;
        const data = json?.data && typeof json.data === 'object' ? json.data as Record<string, unknown> : null;
        accumulated =
          readResponseText(json, ['reply', 'message', 'answer', 'text', 'content']) ??
          readResponseText(data, ['reply', 'message', 'answer', 'text', 'content', 'summary']) ??
          '';
      }

      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          id: agentMessageId,
          role: 'agent',
          text: accumulated || '臣已收到旨意。',
          time: agentTime,
        };
        return next;
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          id: agentMessageId,
          role: 'agent',
          text: fallbackReply(apiPath, text),
          time: agentTime,
        };
        return next;
      });
    } finally {
      streamingRef.current = false;
    }
  }, [apiPath, nextMessageId]);

  return { messages, handleSend, appendUserMessage };
}

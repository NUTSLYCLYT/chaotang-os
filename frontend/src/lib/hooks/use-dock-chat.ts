'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DockMessage } from '@/features/shared/components/bottom-dock';
import { withBasePath } from '@/lib/base-path';
import { streamSseTokens } from '@/lib/sse-tokens';

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
      const apiUrl = apiPath.startsWith('/') ? withBasePath(apiPath) : apiPath;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error('upstream');

      let accumulated = '';
      for await (const token of streamSseTokens(res.body)) {
        accumulated += token;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { id: agentMessageId, role: 'agent', text: accumulated + '▋', time: agentTime };
          return next;
        });
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
          text: '臣一时无对 · 请陛下再次下旨。',
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

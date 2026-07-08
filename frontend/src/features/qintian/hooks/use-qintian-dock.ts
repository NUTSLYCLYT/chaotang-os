/**
 * 钦天监 · useQintianDock
 *
 * 底部 Dock 聊天逻辑：
 *   - 快速占验 → /api/qintian/chat（SSE token stream + citations）
 *   - 深度议事 → /api/orchestration/run（三省审议流水线）
 *
 * 策略：
 *   - 消息包含"三省"/"审议"/"仔细"/"详"等关键词 → 走 orchestration
 *   - 其余短问 → 走 qintian/chat（快速 LLM）
 *
 * 返回 DockMessage[] 兼容 BottomDock 组件接口。
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DockMessage } from '@/features/shared/components/bottom-dock';
import { withBasePath } from '@/lib/base-path';
import type { QintianCitation } from '@/lib/contracts/qintian';
import type { ForecastScenario } from '@/types/forecast';

const DEEP_KEYWORDS = ['三省', '审议', '详细', '仔细', '详解', '全面', '分析', '报告'];

function needsDeepAnalysis(text: string): boolean {
  return DEEP_KEYWORDS.some((kw) => text.includes(kw));
}

function now(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export interface QintianDockState {
  messages: DockMessage[];
  citations: QintianCitation[];
  toolsUsed: string[];
  isStreaming: boolean;
  handleSend: (text: string) => void;
}

export function useQintianDock(
  greeting: string,
  activeScenario: ForecastScenario | null,
): QintianDockState {
  const [messages, setMessages] = useState<DockMessage[]>([
    { role: 'agent', text: greeting, time: '刚刚' },
  ]);
  const [citations, setCitations] = useState<QintianCitation[]>([]);
  const [toolsUsed, setToolsUsed] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  /* ------------------------------------------------------------------------ */
  /* 快速占验 via /api/qintian/chat                                            */
  /* ------------------------------------------------------------------------ */

  const quickChat = useCallback(async (text: string) => {
    const controller = new AbortController();
    abortRef.current = controller;

    const agentTime = now();
    setMessages((prev) => [...prev, { role: 'agent', text: '▋', time: agentTime }]);
    setCitations([]);
    setToolsUsed([]);

    try {
      // activeScenario is a plain serialisable object – safe to JSON-serialise directly
      const res = await fetch(withBasePath('/api/qintian/chat'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text, scenarioContext: activeScenario ?? null }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error('upstream');

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let accumulated = '';
      let sourceLabel: 'LIVE' | 'FALLBACK' = 'LIVE';
      const newCitations: QintianCitation[] = [];
      const newTools: string[] = [];
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6);
          try {
            const obj = JSON.parse(raw) as Record<string, unknown>;
            if (typeof obj.token === 'string') {
              accumulated += obj.token;
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = {
                  role: 'agent',
                  text: accumulated + '▋',
                  time: agentTime,
                };
                return next;
              });
            }
            if (obj.sourceLabel === 'FALLBACK' || obj.sourceLabel === 'LIVE') {
              sourceLabel = obj.sourceLabel;
            }
            if (obj.citation) {
              newCitations.push(obj.citation as QintianCitation);
            }
            if (Array.isArray(obj.toolsUsed)) {
              newTools.push(...(obj.toolsUsed as string[]));
            }
          } catch {
            /* skip */
          }
        }
      }

      // 铁律13.2：fallback 占验词必须明示「非实时」，不得伪装成实时推演。
      const finalText = accumulated || '臣一时无对，请陛下再次下旨。';
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'agent',
          text:
            sourceLabel === 'FALLBACK'
              ? `〔钦天监·占验词·非实时推演〕\n${finalText}`
              : finalText,
          time: agentTime,
        };
        return next;
      });
      setCitations(newCitations);
      setToolsUsed(newTools);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'agent',
          text: '臣一时无对，请陛下再次下旨。',
          time: agentTime,
        };
        return next;
      });
    }
  }, [activeScenario]);

  /* ------------------------------------------------------------------------ */
  /* 深度审议 via /api/orchestration/run                                       */
  /* ------------------------------------------------------------------------ */

  const deepOrchestration = useCallback(async (text: string) => {
    const controller = new AbortController();
    abortRef.current = controller;

    const agentTime = now();
    setMessages((prev) => [
      ...prev,
      { role: 'agent', text: '三省开始审议，请稍候…', time: agentTime },
    ]);

    const scenarioCtx = activeScenario
      ? `\n当前焦点情景：${activeScenario.label}（${activeScenario.name}），概率 ${Math.round(activeScenario.probability * 100)}%`
      : '';

    try {
      const res = await fetch(withBasePath('/api/orchestration/run'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          command: `钦天监占验：${text}${scenarioCtx}`,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error('orchestration upstream error');

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let finalDecision = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';

        for (const part of parts) {
          const lines = part.split('\n');
          const eventLine = lines.find((l) => l.startsWith('event: '));
          const dataLine = lines.find((l) => l.startsWith('data: '));
          if (!eventLine || !dataLine) continue;

          const eventName = eventLine.slice(7).trim();
          const raw = dataLine.slice(6);
          try {
            const obj = JSON.parse(raw) as Record<string, unknown>;
            if (eventName === 'pipeline_done') {
              const result = obj.result as Record<string, unknown> | undefined;
              finalDecision = String(result?.final_decision ?? result?.decision ?? '');
            }
            if (eventName === 'stage_progress') {
              const msg = String(obj.message ?? '');
              if (msg) {
                setMessages((prev) => {
                  const next = [...prev];
                  next[next.length - 1] = {
                    role: 'agent',
                    text: `[审议中] ${msg}`,
                    time: agentTime,
                  };
                  return next;
                });
              }
            }
          } catch {
            /* skip */
          }
        }
      }

      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'agent',
          text: finalDecision || '三省审议完毕，尚书省正在落地执行。',
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
          text: '三省审议暂时中断，请陛下稍后再议。',
          time: agentTime,
        };
        return next;
      });
    }
  }, [activeScenario]);

  /* ------------------------------------------------------------------------ */
  /* Public handleSend                                                         */
  /* ------------------------------------------------------------------------ */

  const handleSend = useCallback(
    (text: string) => {
      if (isStreaming) return;
      setIsStreaming(true);
      abortRef.current?.abort();

      const userTime = now();
      setMessages((prev) => [...prev, { role: 'user', text, time: userTime }]);

      const action = needsDeepAnalysis(text) ? deepOrchestration : quickChat;
      action(text).finally(() => setIsStreaming(false));
    },
    [isStreaming, quickChat, deepOrchestration],
  );

  return { messages, citations, toolsUsed, isStreaming, handleSend };
}

/**
 * 太医院 · 问诊 Hook
 *
 * 替代 useDockChat 的太医院专属版本。
 * 调用 POST /api/orchestration/run（SSE），解析三省审议事件，
 * 提取最终诊断文本和 citations，实时回传给 BottomDock。
 *
 * 与 useDockChat 的区别：
 *   - useDockChat 消费 data: {"token":"..."} 逐字流
 *   - usePhysicianChat 消费 event: xxx / data: {...} 命名事件流，
 *     从 zhongshu_done / pipeline_done 里提取诊断正文
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DockMessage } from '@/features/shared/components/bottom-dock';
import type { PhysicianCitation } from '@/lib/contracts/taiyi';
import { backendFetch } from '@/lib/backend-api';

export interface PhysicianMessage extends DockMessage {
  citations?: PhysicianCitation[];
}

/**
 * SSE 事件解析：从 orchestration/run 事件流中读取太医回复。
 *
 * 事件优先级：
 * 1. zhongshu_done → draft.draft（中书省初稿，最早到达）
 * 2. pipeline_done → result.summary（最终裁决，最权威）
 * 3. menxia_done → review.reasoning（门下省驳议理由，可附）
 */
async function* readOrchestrationEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ type: string; data: Record<string, unknown> }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      yield* drain();
    }
    buf += decoder.decode();
    yield* drain();
  } finally {
    reader.releaseLock();
  }

  function* drain(): Generator<{ type: string; data: Record<string, unknown> }> {
    const blocks = buf.replace(/\r\n/g, '\n').split('\n\n');
    buf = blocks.pop() ?? '';
    for (const block of blocks) {
      if (!block.trim()) continue;
      let eventType = 'message';
      let dataStr = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) eventType = line.slice(6).trim();
        else if (line.startsWith('data:')) dataStr = line.slice(5).trim();
      }
      if (!dataStr) continue;
      try {
        const parsed = JSON.parse(dataStr) as Record<string, unknown>;
        yield { type: eventType, data: parsed };
      } catch {
        // non-JSON data lines (heartbeat etc.) — ignore
      }
    }
  }
}

/** 从 orchestration event 提取太医诊断文本 */
function extractPhysicianReply(event: { type: string; data: Record<string, unknown> }): {
  text?: string;
  citations?: PhysicianCitation[];
} | null {
  if (event.type === 'zhongshu_done') {
    const draft = event.data['draft'] as Record<string, unknown> | undefined;
    if (draft?.['draft']) {
      return {
        text: String(draft['draft']),
        citations: (draft['citations'] as PhysicianCitation[] | undefined) ?? [],
      };
    }
  }

  if (event.type === 'pipeline_done') {
    const result = event.data['result'] as Record<string, unknown> | undefined;
    if (result?.['summary']) {
      const cits = (result['citations'] as PhysicianCitation[] | undefined) ?? [];
      return { text: String(result['summary']), citations: cits };
    }
    if (result?.['draft']) {
      const draft = result['draft'] as Record<string, unknown>;
      return {
        text: String(draft['draft'] ?? ''),
        citations: (draft['citations'] as PhysicianCitation[] | undefined) ?? [],
      };
    }
  }

  return null;
}

export function usePhysicianChat(initialGreeting: string) {
  const [messages, setMessages] = useState<PhysicianMessage[]>([
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

    // 显示思考中占位符
    setMessages((prev) => [...prev, { role: 'agent', text: '太医正在诊察中▋', time: agentTime }]);

    try {
      const res = await backendFetch('/api/orchestration/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          command: `太医院问诊：${text}`,
          // 给中书省 system context 提示：这是太医院场景，需要调用 query_health_profile 工具
          constitutions: [
            {
              id: 'taiyi_context',
              text: '本次问诊来自太医院·健康养生与医疗资源台（红线：太医不做临床诊断、不开处方、不给具体用药剂量方案）。若问题涉及健康指标或身体状况，先调用 query_health_profile 获取最新档案，基于真实数据给养生调理与就医方向建议；凡涉及诊断、处方、具体用药，一律回复"此属临床诊疗范畴，太医只作健康参考，请及时就医、遵医嘱"，不得给出具体诊断结论或用药方案。回答以太医口吻称"陛下"，结尾列数据来源（citations）。',
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error(`orchestration upstream ${res.status}`);

      let bestText = '';
      let bestCitations: PhysicianCitation[] = [];
      let gotFinalReply = false;

      for await (const event of readOrchestrationEvents(res.body)) {
        if (controller.signal.aborted) break;

        // 更新进度提示
        if (event.type === 'stage_start') {
          const stage = String(event.data['stage'] ?? '');
          const stageLabel: Record<string, string> = {
            retrieve: '正在查阅医案典籍▋',
            zhongshu: '中书省正在起草诊断▋',
            menxia: '门下省正在复审▋',
            shangshu: '尚书省正在落地医令▋',
            persist: '归档中▋',
          };
          if (stageLabel[stage]) {
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = { role: 'agent', text: stageLabel[stage]!, time: agentTime };
              return next;
            });
          }
        }

        const extracted = extractPhysicianReply(event);
        if (extracted?.text) {
          bestText = extracted.text;
          bestCitations = extracted.citations ?? [];
          gotFinalReply = event.type === 'pipeline_done';

          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              role: 'agent',
              text: bestText,
              time: agentTime,
              citations: bestCitations,
            };
            return next;
          });

          if (gotFinalReply) break;
        }
      }

      // 如果没有提取到任何回复，显示降级提示
      if (!bestText) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: 'agent',
            text: '臣已收悉陛下旨意，正在整理诊断结论，稍候奏报。',
            time: agentTime,
          };
          return next;
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'agent',
          text: '臣一时无对 · 请陛下再次问诊。',
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

'use client';

/**
 * useAgentChat —— 通用单 agent 对话 hook（户部 + 各部门复用）。
 *
 * 调 POST <endpoint>（JSON {command}），把结构化结果渲染成"问责面板"消息节点：
 * 答案 + 证据 + 数字接地徽标 + 冲突声明。这是单 agent 范式"对答案负责"的真实呈现。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DockMessage } from '@/features/shared/components/bottom-dock';
import type { AgentResult } from '@/lib/swarm/dept-agent';
import { AgentAnswerCard } from '@/features/swarm/components/agent-answer-card';
import { withBasePath } from '@/lib/base-path';

const nowLabel = (): string =>
  new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

export function useAgentChat(opts: { endpoint: string; greeting: string; accent: string }) {
  const { endpoint, greeting, accent } = opts;
  const [messages, setMessages] = useState<DockMessage[]>([
    { role: 'agent', text: greeting, time: '刚刚' },
  ]);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleSend = useCallback(async (text: string) => {
    if (busyRef.current) return;
    const command = text.trim();
    if (!command) return;
    busyRef.current = true;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const t = nowLabel();
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: command, time: t },
      { role: 'agent', text: '臣正在核账……', time: t },
    ]);

    const replace = (msg: DockMessage) =>
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = msg;
        return next;
      });

    try {
      // basePath 必带：prod 部署在 /chaotang 下，裸路径会绕过 basePath 直接 404
      const res = await fetch(withBasePath(endpoint), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command }),
        signal: controller.signal,
      });
      const json = (await res.json().catch(() => ({}))) as
        | (AgentResult & { ok: true })
        | { ok?: false; error?: string };

      // 诚实分流(铁律:不把系统故障伪装成 AI 无话可说)：
      // 通路不可达(404 端点缺失/5xx) → 红色诚实条明示故障并记录；只有 200-空回答才是"臣一时无对"。
      if (!res.ok) {
        const detail =
          typeof json === 'object' && json && 'error' in json && json.error
            ? String(json.error)
            : `通路未达（HTTP ${res.status}）`;
        // eslint-disable-next-line no-console
        console.error('[useAgentChat] 部门通路故障', { endpoint, status: res.status, detail });
        replace({
          role: 'agent',
          text: `⚠ 此通路未达：${detail}`,
          time: nowLabel(),
          node: (
            <div
              role="alert"
              className="rounded-md border border-[#F43F5E]/45 bg-[#F43F5E]/10 px-3 py-2 text-[12px] text-[#F8A6B4]"
            >
              ⚠ 此通路未达：{detail}
              <div className="mt-0.5 text-[11px] text-[#C68B95]">
                这不是臣无话可说，是该员工通路当前不可用——已记录待修，勿误判为 AI 能力边界。
              </div>
            </div>
          ),
        });
        return;
      }
      if (!('ok' in json) || !json.ok) {
        const errMsg = ('error' in json && json.error) || '臣一时无对 · 请陛下再次下旨。';
        replace({ role: 'agent', text: errMsg, time: nowLabel() });
        return;
      }

      const result = json as AgentResult & { ok: true };
      replace({
        role: 'agent',
        text: result.answer || '臣已核账完毕。',
        time: nowLabel(),
        node: <AgentAnswerCard result={result} accent={accent} />,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      // eslint-disable-next-line no-console
      console.error('[useAgentChat] 部门通路异常', { endpoint, err });
      replace({
        role: 'agent',
        text: '⚠ 通路异常（网络或服务中断），非臣无对，已记录。',
        time: nowLabel(),
        node: (
          <div
            role="alert"
            className="rounded-md border border-[#F43F5E]/45 bg-[#F43F5E]/10 px-3 py-2 text-[12px] text-[#F8A6B4]"
          >
            ⚠ 通路异常（网络或服务中断）——非臣无话可说，已记录待查。
          </div>
        ),
      });
    } finally {
      busyRef.current = false;
    }
  }, [endpoint, accent]);

  return { messages, handleSend };
}

'use client';

/**
 * DeptAgentDock —— 通用部门"问责坞"。挂在通用部门页底部，让真人向该部门单 agent 提问，
 * 回答以问责面板（答案+证据+接地+冲突）呈现。仅对 dept-agent-meta 注册的部门渲染。
 */

import { BottomDock } from '@/features/shared/components/bottom-dock';
import { useAgentChat } from '@/features/swarm/lib/use-agent-chat';
import { DEPT_AGENT_META } from '@/lib/swarm/dept-agent-meta';

export function DeptAgentDock({ code }: { code: string }) {
  const meta = DEPT_AGENT_META[code];
  // hook 必须无条件调用；meta 缺失时用安全兜底（调用方已用 hasDeptAgent 守卫，正常不触发）
  const { messages, handleSend } = useAgentChat({
    endpoint: `/api/court/dept/${code}/ask`,
    greeting: meta?.greeting ?? '',
    accent: meta?.accent ?? '#6BA0FF',
  });
  if (!meta) return null;

  return (
    <BottomDock
      title={meta.title}
      name={meta.name}
      accent={meta.accent}
      avatar={<span className="text-[18px]">{meta.emoji}</span>}
      quickPrompts={meta.quickPrompts}
      messages={messages}
      placeholder="请陛下示下..."
      sendLabel="下旨"
      onSend={handleSend}
    />
  );
}

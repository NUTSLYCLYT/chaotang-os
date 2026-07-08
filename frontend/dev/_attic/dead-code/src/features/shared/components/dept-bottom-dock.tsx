'use client';

import { BottomDock } from '@/features/shared/components/bottom-dock';
import { useAgentChat } from '@/features/swarm/lib/use-agent-chat';
import { DEPT_AGENT_META, type DeptAgentMeta } from '@/lib/swarm/dept-agent-meta';

interface DeptBottomDockProps {
  deptCode: string;
  meta: DeptAgentMeta;
  /** 展开时左侧展示的焦点面板（可选） */
  focusPanel?: React.ReactNode;
  /** 折叠态徽章 */
  badges?: { label: string; value: string }[];
}

export function DeptBottomDock({ deptCode, meta, focusPanel, badges = [] }: DeptBottomDockProps) {
  const { messages, handleSend } = useAgentChat({
    endpoint: `/api/court/${deptCode}/ask`,
    greeting: meta.greeting,
    accent: meta.accent,
  });

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
      badges={badges}
      focusPanel={focusPanel}
    />
  );
}

/** 通过 deptCode 查 DEPT_AGENT_META，未注册返回 null */
export function getDeptMeta(code: string): DeptAgentMeta | null {
  return DEPT_AGENT_META[code] ?? null;
}

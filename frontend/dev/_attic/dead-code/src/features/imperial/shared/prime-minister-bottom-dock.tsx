'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import {
  Crown,
  FileText,
  Gavel,
  Sparkles,
  AlertTriangle,
  Command as CommandIcon,
} from 'lucide-react';
import { BottomDock, type DockMessage } from '@/features/shared/components/bottom-dock';
import { PrimeMinisterPersona } from './prime-minister-persona';
import type { Task } from '@/types/task';
import type { AgentRun } from '@/types/agent';
import { colors } from '@/config/design-tokens';

const ACCENT = colors.goldBright;

const QUICK = [
  '先压成一句总批',
  '现在最该先处理哪件事？',
  '把高风险议题单列出来',
  '该送三省还是继续执行？',
  '给我一条今日指令',
];

export function PrimeMinisterBottomDock({
  task,
  runs,
  mode,
}: {
  task: Task | null;
  runs: AgentRun[];
  mode: 'overview' | 'command-center';
}) {
  const [messages, setMessages] = useState<DockMessage[]>([
    {
      role: 'agent',
      text:
        mode === 'overview'
          ? '臣丞相在殿下侍命。先收总批，再决定是入军机、入三省，还是直接下旨。'
          : '臣丞相在军机处候旨。当前更重要的不是多看材料，而是先定下一步动作。',
      time: '刚刚',
    },
  ]);

  const runningCount = runs.filter((r) => r.state === 'running' || r.state === 'summarizing').length;
  const riskCount = runs.filter((r) => r.riskLevel === 'high' || r.riskLevel === 'critical').length;
  const readyToReview =
    task?.status === 'report_ready' || task?.status === 'aggregating' || task?.status === 'planning';

  const handleSend = useCallback(async (text: string) => {
    const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { role: 'user', text, time: now }]);
    const agentTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { role: 'agent', text: '▋', time: agentTime }]);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !res.body) throw new Error('upstream');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          try {
            const obj = JSON.parse(line.slice(5).trim());
            if (obj.token) {
              accumulated += obj.token;
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: 'agent', text: accumulated + '▋', time: agentTime };
                return next;
              });
            }
          } catch { /* ignore */ }
        }
      }
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: 'agent', text: accumulated || '臣已收到旨意。', time: agentTime };
        return next;
      });
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: 'agent', text: '臣一时无对 · 请陛下再次下旨。', time: agentTime };
        return next;
      });
    }
  }, []);

  const focusPanel = useMemo(() => {
    return (
      <div className="space-y-3">
        <div
          className="rounded-xl border p-3"
          style={{
            borderColor: `${ACCENT}55`,
            background: `linear-gradient(135deg, ${ACCENT}12, transparent 70%)`,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
                Prime Minister Focus
              </div>
              <div className="mt-1 text-[18px] font-semibold" style={{ color: colors.goldBright }}>
                {task?.title ?? '当前尚无主任务'}
              </div>
            </div>
            <div
              className="rounded-full border px-2 py-1 font-mono text-[12px] font-bold"
              style={{
                borderColor: `${ACCENT}55`,
                background: `${ACCENT}14`,
                color: colors.goldBright,
              }}
            >
              {task?.status ?? 'idle'}
            </div>
          </div>
          <div className="mt-2 text-[11px] leading-6" style={{ color: colors.textDim }}>
            {task?.description ?? task?.rawCommand ?? '丞相建议：先下一道短旨，要求只呈最值得先处理的一件事。'}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {[
            {
              label: '执行中',
              value: `${runningCount} 项`,
              note: '当前正在推进',
              icon: CommandIcon,
              color: colors.info,
            },
            {
              label: '高风险',
              value: `${riskCount} 项`,
              note: '需先压缩判断',
              icon: AlertTriangle,
              color: colors.danger,
            },
            {
              label: '御批窗口',
              value: readyToReview ? '已接近' : '未到',
              note: readyToReview ? '可准备裁断' : '先继续收束',
              icon: Gavel,
              color: readyToReview ? colors.success : colors.warning,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="rounded-lg border p-2.5"
                style={{
                  borderColor: `${item.color}33`,
                  background: `linear-gradient(160deg, ${item.color}0a, rgba(0,0,0,0.3))`,
                }}
              >
                <div className="flex items-center gap-1 text-[11px] uppercase tracking-[0.18em]" style={{ color: item.color }}>
                  <Icon size={10} />
                  {item.label}
                </div>
                <div className="mt-1 font-mono text-[14px] font-bold" style={{ color: colors.goldBright }}>
                  {item.value}
                </div>
                <div className="mt-1 text-[11px]" style={{ color: colors.textDim }}>
                  {item.note}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={mode === 'overview' ? '/throne/compose' : '/governance'}
            className="rounded-full border px-3 py-1.5 text-[11px]"
            style={{
              borderColor: `${ACCENT}55`,
              background: `${ACCENT}14`,
              color: colors.goldBright,
            }}
          >
            {mode === 'overview' ? '前往圣旨页' : '送三省治理流'}
          </Link>
          <Link
            href={mode === 'overview' ? '/command-center' : '/overview'}
            className="rounded-full border px-3 py-1.5 text-[11px]"
            style={{
              borderColor: 'rgba(255,255,255,0.12)',
              color: colors.text,
            }}
          >
            {mode === 'overview' ? '进入军机处' : '回大殿总览'}
          </Link>
        </div>
      </div>
    );
  }, [mode, readyToReview, riskCount, runningCount, task]);

  return (
    <BottomDock
      title="Prime Minister"
      name="丞相 · 中枢总理"
      accent={ACCENT}
      avatar={<PrimeMinisterPersona size="sm" />}
      quickPrompts={QUICK}
      messages={messages}
      placeholder="请陛下下旨..."
      sendLabel="下旨"
      onSend={handleSend}
      badges={[
        { label: '在办', value: `${runningCount}` },
        { label: '急章', value: `${riskCount}` },
      ]}
      showCollapsedQuickPrompts={mode !== 'overview'}
      collapsedTeaser={
        task?.title
          ? `当前总批：${task.title}`
          : '臣丞相候旨。请先压成一句判断，再决定是裁断、治理还是继续执行。'
      }
      focusPanel={focusPanel}
    />
  );
}


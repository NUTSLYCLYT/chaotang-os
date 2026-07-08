'use client';

/**
 * 朝堂脉搏 · Pulse Ticker
 *
 * 页面底部一条细长横幅，每 4 秒切换一条系统状态。
 * 让决策者被动感受到系统在活着 — 类似 bloomberg 底部滚动条，
 * 但更克制 · 每次只露一条。
 */

import { useEffect, useState, useMemo } from 'react';
import { Activity } from 'lucide-react';
import type { Task } from '@/types/task';
import type { IntelSignal } from '@/types/intel';
import type { AgentRun } from '@/types/agent';
import { AGENT_META } from '@/types/agent';

export interface PulseTickerProps {
  tasks: Task[];
  signals: IntelSignal[];
  runs: AgentRun[];
}

interface TickerItem {
  id: string;
  text: string;
  color: string;
}

export function PulseTicker({ tasks, signals, runs }: PulseTickerProps) {
  const items: TickerItem[] = useMemo(() => {
    const out: TickerItem[] = [];

    // running agents
    const active = runs.filter((r) => r.state === 'running');
    if (active.length > 0) {
      const names = active
        .slice(0, 3)
        .map((r) => AGENT_META[r.agentCode].nameCn)
        .join('、');
      out.push({
        id: 'agents-running',
        text: `${names}${active.length > 3 ? ' 等' : ''}共 ${active.length} 路正在办理`,
        color: '#3DD68C',
      });
    }

    // pending reviews
    const pending = tasks.filter((t) => t.status === 'report_ready').length;
    if (pending > 0) {
      out.push({
        id: 'pending-reviews',
        text: `${pending} 份呈报恭候御批`,
        color: '#F0C66A',
      });
    }

    // critical signals
    const critical = signals.filter((s) => s.level === 'critical').length;
    if (critical > 0) {
      out.push({
        id: 'critical-intel',
        text: `锦衣卫急报 · ${critical} 条待处置`,
        color: '#F43F5E',
      });
    }

    // warning signals
    const warnings = signals.filter((s) => s.level === 'warning').length;
    if (warnings > 0) {
      out.push({
        id: 'warning-intel',
        text: `${warnings} 条警讯已收录 · 可巡视锦衣卫`,
        color: '#F5A524',
      });
    }

    // archived tasks count
    const archived = tasks.filter((t) => t.status === 'reviewed' || t.status === 'archived').length;
    if (archived > 0) {
      out.push({
        id: 'archive-total',
        text: `史馆已录 ${archived} 案 · 往例可鉴`,
        color: '#6BA0FF',
      });
    }

    // all quiet
    if (out.length === 0) {
      out.push({
        id: 'quiet',
        text: '朝堂清明 · 六部安好 · 无急务',
        color: '#6BA0FF',
      });
    }

    return out;
  }, [tasks, signals, runs]);

  const [cursor, setCursor] = useState(0);
  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => {
      setCursor((c) => (c + 1) % items.length);
    }, 4200);
    return () => clearInterval(id);
  }, [items.length]);

  const current = items[cursor % items.length];
  if (!current) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative flex items-center justify-center gap-3 overflow-hidden rounded-full border px-5 py-2.5"
      style={{
        borderColor: 'rgba(255,255,255,0.08)',
        background:
          'linear-gradient(90deg, rgba(10, 8, 4, 0.8), rgba(20, 16, 8, 0.7), rgba(10, 8, 4, 0.8))',
      }}
    >
      {/* Heartbeat dot */}
      <span className="relative inline-flex h-2 w-2 shrink-0">
        <span
          className="absolute inset-0 animate-ping rounded-full"
          style={{ background: current.color, opacity: 0.6 }}
        />
        <span
          className="relative inline-block h-2 w-2 rounded-full"
          style={{ background: current.color }}
        />
      </span>

      {/* Label */}
      <div className="flex items-center gap-2 text-[11px] tracking-wider text-[#9AA3C4]">
        <Activity size={11} className="text-[#6A7299]" />
        <span className="text-[11px] uppercase">朝堂脉搏</span>
        <span className="text-[#484F72]">·</span>
        <span
          key={current.id}
          className="animate-[fadeIn_.5s_ease-out]"
          style={{ color: current.color }}
        >
          {current.text}
        </span>
      </div>

      {/* Pagination bars */}
      <div className="ml-auto flex items-center gap-1">
        {items.map((_, i) => (
          <span
            key={i}
            className="h-0.5 w-4 rounded-full transition-colors"
            style={{
              background: i === cursor % items.length ? current.color : 'rgba(255,255,255,0.1)',
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(2px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

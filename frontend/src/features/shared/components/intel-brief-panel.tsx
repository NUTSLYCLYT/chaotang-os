'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { GlassPanel } from '@/components/GlassPanel';
import { withBasePath } from '@/lib/base-path';
import type { IntelSignal } from '@/lib/contracts/intel';
import type { AgentCode } from '@/lib/contracts/agent';
import { AGENT_META } from '@/lib/contracts/agent';
import { buildSurpriseInsights } from '@/core/courtos/interaction/surprise-insight-engine';
import { intelSignalToInsightCandidate } from '@/lib/intel/surprise-mapping';

type IntelSignalsResponse = { success: boolean; data: IntelSignal[]; meta?: { total?: number; source?: string } };

const DISPATCH_TARGETS: AgentCode[] = ['hu_bu', 'gong_bu', 'xing_bu', 'li_bu', 'li_bu_rites', 'bing_bu'];

function jsonFetcher(url: string) {
  return fetch(url).then((res) => res.json());
}

export function IntelBriefPanel({ onClose }: { onClose: () => void }) {
  const { data, mutate } = useSWR<IntelSignalsResponse>(
    withBasePath('/api/court/intel/signals?limit=20'),
    jsonFetcher,
    { refreshInterval: 60_000 },
  );
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [dispatched, setDispatched] = useState<Record<string, string>>({});

  const isReal = data?.meta?.source === 'turso';
  const signals = isReal ? (data?.data ?? []) : [];
  const insights = buildSurpriseInsights(
    signals.map((s) => intelSignalToInsightCandidate(s, 'LIVE')),
  );
  const insightIds = new Set(insights.map((i) => i.id));

  async function dispatch(signal: IntelSignal, target: AgentCode) {
    setDispatchingId(signal.id);
    try {
      const res = await fetch(withBasePath(`/api/court/intel/signals/${encodeURIComponent(signal.id)}/dispatch`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetAgents: [target] }),
      });
      const json = (await res.json()) as { success: boolean; data?: { taskId?: string }; error?: string };
      if (json.success && json.data?.taskId) {
        setDispatched((prev) => ({ ...prev, [signal.id]: json.data!.taskId! }));
      }
      mutate();
    } catch {
      // 静默失败保留原状态，用户可重试；不弹全局报错打断阅读情报列表
    } finally {
      setDispatchingId(null);
    }
  }

  return (
    <GlassPanel variant="gold" tone="deep" padding="md" hudCorners className="max-h-[70vh] w-full max-w-md overflow-y-auto">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-semibold tracking-wide text-[#F5E9C9]" style={{ fontFamily: 'var(--font-serif)' }}>
          锦衣卫情报
        </span>
        <button type="button" onClick={onClose} className="text-[11px] text-[#8F835F] hover:text-[#F0C66A]">
          收起
        </button>
      </div>

      {!isReal ? (
        <p className="text-[12px] text-[#8F835F]">暂无真实情报数据。</p>
      ) : signals.length === 0 ? (
        <p className="text-[12px] text-[#8F835F]">暂无情报记录。</p>
      ) : (
        <ul className="space-y-3">
          {signals.map((signal) => {
            const flagged = insightIds.has(signal.id);
            const taskId = dispatched[signal.id];
            return (
              <li
                key={signal.id}
                data-testid={flagged ? 'intel-surprise-item' : 'intel-item'}
                className="rounded-lg border border-[#F0C66A]/20 bg-black/20 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[12px] font-medium text-[#F5E9C9]">{signal.title}</p>
                  {flagged ? (
                    <span className="shrink-0 rounded-full bg-[#F0C66A]/20 px-2 py-0.5 text-[9px] text-[#F0C66A]">
                      惊喜洞察
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] text-[#8F835F]">{signal.summary}</p>
                {taskId ? (
                  <p className="mt-2 text-[10px] text-[#7FC9A8]">已转任务 {taskId}</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {DISPATCH_TARGETS.map((code) => (
                      <button
                        key={code}
                        type="button"
                        disabled={dispatchingId === signal.id}
                        onClick={() => dispatch(signal, code)}
                        className="rounded border border-[#F0C66A]/30 px-1.5 py-0.5 text-[9px] text-[#F0C66A] hover:bg-[#F0C66A]/10 disabled:opacity-40"
                      >
                        转{AGENT_META[code].nameCn}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </GlassPanel>
  );
}

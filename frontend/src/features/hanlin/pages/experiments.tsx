'use client';

import { useEffect, useMemo, useState } from 'react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { fetchHanlinJson } from '@/features/hanlin/lib/api';
import { normalizeHanlinSourceLabel } from '@/features/hanlin/lib/read-model';
import { PageBrief } from '@/features/shared/components/page-brief';
import type { Contribution, Experiment, HanlinSourceLabel } from '@/features/hanlin/types';

export function HanlinExperimentsPage() {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [sourceLabel, setSourceLabel] = useState<HanlinSourceLabel>('FALLBACK');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  async function load() {
    setStatus('loading');
    try {
      const [contributionPayload, experimentPayload] = await Promise.all([
        fetchHanlinJson<{ contributions: Contribution[] }>('/api/hanlin/contributions'),
        fetchHanlinJson<{ experiments: Experiment[]; source?: unknown }>('/api/hanlin/experiments'),
      ]);
      setContributions(contributionPayload.contributions);
      setExperiments(experimentPayload.experiments);
      setSourceLabel(normalizeHanlinSourceLabel(experimentPayload.source));
      setStatus('ready');
    } catch {
      setContributions([]);
      setExperiments([]);
      setSourceLabel('FALLBACK');
      setStatus('error');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const groups = useMemo(
    () => ({
      pending: experiments.filter((item) => item.status === 'pending'),
      running: experiments.filter((item) => item.status === 'running'),
      completed: experiments.filter((item) => item.status === 'completed' || item.status === 'adopted'),
      stopped: experiments.filter((item) => item.status === 'stopped'),
    }),
    [experiments],
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1500px] space-y-5 p-6">
        <PageBrief
          eyebrow="Experiment Pool · 应用实验池"
          title="先验证有没有真实效果，再决定它值不值得进榜、值多少钱。"
          hook="应用池的职责，是拦住那些看起来漂亮但没有实际价值的东西。"
          brief="推荐池只是开始。进入实验池之后，系统需要记录试用、采用和放弃结果，把价值和效果绑定起来。"
          primaryAction={{ label: '返回推荐池', href: '/hanlin/recommendations' }}
          secondaryAction={{ label: '返回开榜司', href: '/hanlin/rankings', tone: 'secondary' }}
        />

        <GlassPanel tone="elevated" padding="md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] leading-6 text-[#AEB7D1]">
              {sourceLabel === 'TRUTH_LEDGER'
                ? '以下结果直接读取 truth_ledger；页面不提供修改、采用或停止动作。'
                : '真实评测账本当前为空或不可用；不使用本地实验数据填充。'}
            </p>
            <span className={`rounded-full border px-3 py-1 text-[11px] ${sourceLabel === 'TRUTH_LEDGER' ? 'border-[#7AD3A1]/25 bg-[#7AD3A1]/10 text-[#9BE7B9]' : 'border-[#F0C66A]/25 bg-[#F0C66A]/10 text-[#F6DFA2]'}`}>
              {sourceLabel}
            </span>
          </div>
        </GlassPanel>

        <div className="grid gap-3 md:grid-cols-4">
          <SummaryStat label="待判定" value={`${groups.pending.length}`} />
          <SummaryStat label="处理中" value={`${groups.running.length}`} />
          <SummaryStat label="判定通过" value={`${groups.completed.length}`} />
          <SummaryStat label="判定未通过" value={`${groups.stopped.length}`} />
        </div>

        <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-4">
          {status === 'loading' ? (
            <GlassPanel tone="elevated" padding="lg">
              <p className="text-[12px] text-[#AEB7D1]">实验池正在同步试用、采用与停止结果。</p>
            </GlassPanel>
          ) : status === 'error' ? (
            <GlassPanel tone="elevated" padding="lg">
              <p className="text-[12px] text-[#F6DFA2]">实验池数据暂时未取到，请稍后再试。</p>
            </GlassPanel>
          ) : (
            <>
          <ExperimentColumn
            title="待判定"
            items={groups.pending}
            contributions={contributions}
            emptyLabel="当前无待判定记录"
          />
          <ExperimentColumn
            title="处理中"
            items={groups.running}
            contributions={contributions}
            emptyLabel="当前无处理中记录"
          />
          <ExperimentColumn
            title="判定通过"
            items={groups.completed}
            contributions={contributions}
            emptyLabel="当前无通过记录"
          />
          <ExperimentColumn
            title="判定未通过"
            items={groups.stopped}
            contributions={contributions}
            emptyLabel="当前无未通过记录"
          />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <GlassPanel tone="elevated" padding="md">
      <div className="text-[11px] uppercase tracking-[0.16em] text-[#8F835F]">{label}</div>
      <div className="mt-2 text-[24px] font-semibold text-[#F5E9C9]">{value}</div>
    </GlassPanel>
  );
}

function ExperimentColumn({
  title,
  items,
  contributions,
  emptyLabel,
}: {
  title: string;
  items: Experiment[];
  contributions: Contribution[];
  emptyLabel: string;
}) {
  return (
    <GlassPanel tone="elevated" padding="lg">
      <div className="mb-4">
        <div className="section-eyebrow">Experiment Status</div>
        <h2 className="section-title text-[20px]">{title}</h2>
      </div>
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-[12px] text-[#AEB7D1]">
            {emptyLabel}
          </div>
        ) : (
          items.map((item) => {
            const contribution = contributions.find((entry) => entry.id === item.contributionId);
            const itemKey = item.id ?? `${item.contributionId}-${item.scenario}-${item.status}`;
            return (
              <div key={itemKey} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-semibold text-[#F5E9C9]">{contribution?.title ?? item.scenario}</div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[#8F835F]">{item.scenario}</div>
                  </div>
                  <div className="rounded-full border border-[#F0C66A]/20 bg-[#F0C66A]/10 px-3 py-1 text-[11px] text-[#F0C66A]">
                    {statusLabel(item.status)}
                  </div>
                </div>
                <p className="mt-3 text-[12px] leading-6 text-[#AEB7D1]">{item.feedbackSummary}</p>
              </div>
            );
          })
        )}
      </div>
    </GlassPanel>
  );
}

function statusLabel(status: string) {
  switch (status) {
    case 'running':
      return '处理中';
    case 'completed':
    case 'adopted':
      return '判定通过';
    case 'stopped':
      return '判定未通过';
    default:
      return '待判定';
  }
}

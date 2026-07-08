'use client';

import { useEffect, useMemo, useState } from 'react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { HanlinRoleBadge } from '@/features/hanlin/components/hanlin-role-badge';
import { hanlinRoleHeaders, hasHanlinCapability, readHanlinRole } from '@/features/hanlin/lib/access';
import { hanlinApi } from '@/features/hanlin/lib/api';
import { PageBrief } from '@/features/shared/components/page-brief';
import type { Contribution, Experiment } from '@/features/hanlin/types';

export function HanlinExperimentsPage() {
  const role = readHanlinRole();
  const canExperiment = hasHanlinCapability(role, 'experiment');
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');

  async function load() {
    setStatus('loading');
    try {
      const [contributionRes, experimentRes] = await Promise.all([
        fetch(hanlinApi('/api/hanlin/contributions')),
        fetch(hanlinApi('/api/hanlin/experiments')),
      ]);
      if (!contributionRes.ok || !experimentRes.ok) {
        throw new Error('hanlin_experiments_fetch_failed');
      }
      const contributionPayload = (await contributionRes.json()) as { contributions: Contribution[] };
      const experimentPayload = (await experimentRes.json()) as { experiments: Experiment[] };
      setContributions(contributionPayload.contributions);
      setExperiments(experimentPayload.experiments);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const groups = useMemo(
    () => ({
      pending: experiments.filter((item) => item.status === 'pending'),
      running: experiments.filter((item) => item.status === 'running' || item.status === 'completed'),
      adopted: experiments.filter((item) => item.status === 'adopted'),
      stopped: experiments.filter((item) => item.status === 'stopped'),
    }),
    [experiments],
  );

  async function updateExperiment(item: Experiment, nextStatus: Experiment['status'], feedbackAppendix: string) {
    setSubmittingId(item.id);
    setMessage('');
    const response = await fetch(hanlinApi('/api/hanlin/experiments'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...hanlinRoleHeaders(role) },
      body: JSON.stringify({
        ...item,
        status: nextStatus,
        feedbackSummary: `${item.feedbackSummary} ${feedbackAppendix}`.trim(),
      }),
    });
    if (response.ok) {
      await load();
      setMessage(
        nextStatus === 'adopted'
          ? '实验池已将该贡献提升为正式采用。'
          : nextStatus === 'running'
            ? '实验池已将该贡献推进到试用中。'
            : '实验池已记录停止试用。',
      );
    } else {
      setMessage('实验状态更新失败，请稍后重试。');
    }
    setSubmittingId(null);
  }

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

        <HanlinRoleBadge
          role={role}
          note={canExperiment ? '当前席位可推进试用、采用与停止动作。' : '当前席位只能查看实验结果。'}
        />

        {message ? (
          <GlassPanel tone="elevated" padding="md">
            <p className="text-[12px] text-[#D7CCA9]">{message}</p>
          </GlassPanel>
        ) : null}

        <div className="grid gap-3 md:grid-cols-4">
          <SummaryStat label="待试用" value={`${groups.pending.length}`} />
          <SummaryStat label="试用中" value={`${groups.running.length}`} />
          <SummaryStat label="已采用" value={`${groups.adopted.length}`} />
          <SummaryStat label="已停止" value={`${groups.stopped.length}`} />
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
            actionMode="pending"
            title="待试用"
            items={groups.pending}
            contributions={contributions}
            emptyLabel="当前无待试用任务"
            submittingId={submittingId}
            canExperiment={canExperiment}
            onStart={(item) => updateExperiment(item, 'running', '已进入正式试用。')}
            onStop={(item) => updateExperiment(item, 'stopped', '已停止继续试用。')}
          />
          <ExperimentColumn
            actionMode="pending"
            title="试用中"
            items={groups.running}
            contributions={contributions}
            emptyLabel="当前无试用任务"
            submittingId={submittingId}
            canExperiment={canExperiment}
            onPromote={(item) => updateExperiment(item, 'adopted', '已提升为正式采用。')}
            onStart={(item) => updateExperiment(item, 'running', '已进入正式试用。')}
            onStop={(item) => updateExperiment(item, 'stopped', '已停止继续试用。')}
          />
          <ExperimentColumn
            actionMode="adopted"
            title="已采用"
            items={groups.adopted}
            contributions={contributions}
            emptyLabel="当前无已采用任务"
            submittingId={submittingId}
            canExperiment={canExperiment}
          />
          <ExperimentColumn
            actionMode="adopted"
            title="已停止"
            items={groups.stopped}
            contributions={contributions}
            emptyLabel="当前无已停止任务"
            submittingId={submittingId}
            canExperiment={canExperiment}
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
  actionMode,
  submittingId,
  canExperiment,
  onPromote,
  onStart,
  onStop,
}: {
  title: string;
  items: Experiment[];
  contributions: Contribution[];
  emptyLabel: string;
  actionMode: 'pending' | 'adopted';
  submittingId?: string | null;
  canExperiment: boolean;
  onPromote?: (item: Experiment) => Promise<void>;
  onStart?: (item: Experiment) => Promise<void>;
  onStop?: (item: Experiment) => Promise<void>;
}) {
  function renderActions(item: Experiment) {
    const actions: React.ReactNode[] = [];

    if (item.status === 'pending') {
      actions.push(
        <button
          key={`${item.id}-start`}
          type="button"
          disabled={submittingId === item.id || !canExperiment}
          onClick={() => onStart && void onStart(item)}
          className="rounded-full border border-[#F0C66A]/24 bg-[#F0C66A]/10 px-3 py-1.5 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/16 disabled:opacity-60"
        >
          {canExperiment ? '开始试用' : '当前席位无试用权限'}
        </button>,
      );
    }

    if (item.status !== 'adopted' && item.status !== 'pending') {
      actions.push(
        <button
          key={`${item.id}-promote`}
          type="button"
          disabled={submittingId === item.id || !canExperiment}
          onClick={() => onPromote && void onPromote(item)}
          className="rounded-full border border-[#F0C66A]/24 bg-[#F0C66A]/10 px-3 py-1.5 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/16 disabled:opacity-60"
        >
          {canExperiment ? '标记为已采用' : '当前席位无试用权限'}
        </button>,
      );
    }

    if (item.status !== 'stopped') {
      actions.push(
        <button
          key={`${item.id}-stop`}
          type="button"
          disabled={submittingId === item.id || !canExperiment}
          onClick={() => onStop && void onStop(item)}
          className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-[#D7CCA9] transition hover:border-white/20 hover:bg-white/[0.05] disabled:opacity-60"
        >
          {canExperiment ? '停止试用' : '当前席位无试用权限'}
        </button>,
      );
    }

    if (actions.length === 0) return null;

    return <div className="mt-4 flex flex-wrap gap-2">{actions}</div>;
  }

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
                {actionMode === 'pending' ? renderActions(item) : null}
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
      return '试用中';
    case 'adopted':
      return '已采用';
    case 'stopped':
      return '已停止';
    default:
      return '待试用';
  }
}

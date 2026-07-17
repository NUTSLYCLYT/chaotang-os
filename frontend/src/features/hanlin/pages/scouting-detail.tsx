'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { HanlinRoleBadge } from '@/features/hanlin/components/hanlin-role-badge';
import { hanlinRoleHeaders, hasHanlinCapability, readHanlinRole } from '@/features/hanlin/lib/access';
import { fetchHanlin } from '@/features/hanlin/lib/api';
import { PageBrief } from '@/features/shared/components/page-brief';
import type { ScoutedProject, UpgradeCandidate } from '@/features/hanlin/types';

export function HanlinScoutingDetailPage({ candidateId }: { candidateId: string }) {
  const role = readHanlinRole();
  const canRefresh = hasHanlinCapability(role, 'scouting_refresh');
  const [candidate, setCandidate] = useState<UpgradeCandidate | null>(null);
  const [project, setProject] = useState<ScoutedProject | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not_found' | 'error'>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void (async () => {
      setStatus('loading');
      try {
        const response = await fetchHanlin(`/api/hanlin/scouting/${candidateId}`);
        if (response.status === 404) {
          setStatus('not_found');
          return;
        }
        if (!response.ok) {
          throw new Error('hanlin_candidate_fetch_failed');
        }
        const payload = (await response.json()) as { candidate: UpgradeCandidate; project: ScoutedProject | null };
        setCandidate(payload.candidate);
        setProject(payload.project);
        setStatus(payload.project ? 'ready' : 'not_found');
      } catch {
        setStatus('error');
      }
    })();
  }, [candidateId]);

  async function updateCandidateStatus(nextStatus: UpgradeCandidate['status']) {
    setSubmitting(true);
    setMessage('');
    try {
      const response = await fetchHanlin(`/api/hanlin/scouting/${candidateId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...hanlinRoleHeaders(role) },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        throw new Error('candidate_update_failed');
      }
      const payload = (await response.json()) as { candidate: UpgradeCandidate; project: ScoutedProject | null };
      setCandidate(payload.candidate);
      if (payload.project) {
        setProject(payload.project);
      }
      setMessage(
        nextStatus === 'trialing'
          ? '搜策司已将该候选推进到试用中。'
          : nextStatus === 'accepted'
            ? '搜策司已将该候选标记为已接收。'
            : nextStatus === 'rejected'
              ? '搜策司已将该候选标记为已放弃。'
              : '搜策司已更新候选状态。',
      );
    } catch {
      setMessage('候选状态更新失败，请稍后再试。');
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-[1500px] space-y-5 p-6">
          <GlassPanel tone="elevated" padding="lg">
            <p className="text-[12px] text-[#AEB7D1]">搜策司正在调取该升级候选的完整评估。</p>
          </GlassPanel>
        </div>
      </div>
    );
  }

  if (status === 'not_found' || !candidate || !project) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-[1500px] space-y-5 p-6">
          <GlassPanel tone="elevated" padding="lg">
            <p className="text-[12px] text-[#F6DFA2]">未找到该升级候选，可能已被移出候选榜或本地数据已重置。</p>
          </GlassPanel>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-[1500px] space-y-5 p-6">
          <GlassPanel tone="elevated" padding="lg">
            <p className="text-[12px] text-[#F6DFA2]">升级候选详情暂时未取到，请稍后再试。</p>
          </GlassPanel>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1500px] space-y-5 p-6">
        <PageBrief
          eyebrow="Upgrade Candidate · 升级候选"
          title={project.name}
          subtitle={project.summary}
          hook="不是看 stars 决定值不值得吸收，而是看它能不能让 CourtOS 变强。"
          brief={candidate.notes}
          primaryAction={{ label: '返回搜策司', href: '/hanlin/scouting' }}
          stats={[
            { label: '来源', value: project.source.toUpperCase() },
            { label: '优先级', value: candidate.recommendedPriority },
            { label: '状态', value: statusLabel(candidate.status) },
            { label: 'Stars', value: `${project.repoStars ?? 0}` },
          ]}
        />

        <HanlinRoleBadge
          role={role}
          note={canRefresh ? '当前席位可结合详情继续调整搜策方向。' : '当前席位当前仅查看候选详情，不具备刷新搜策权限。'}
        />

        {message ? (
          <GlassPanel tone="elevated" padding="md">
            <p className="text-[12px] text-[#D7CCA9]">{message}</p>
          </GlassPanel>
        ) : null}

        <GlassPanel tone="elevated" padding="lg">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px] leading-6 text-[#AEB7D1]">
              {project.summary}
              <div className="mt-2 text-[11px] text-[#8F835F]">最近活跃：{project.lastActiveAt}</div>
            </div>
            <Link
              href={project.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full border border-[#F0C66A]/24 bg-[#F0C66A]/10 px-3 py-1.5 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/16"
            >
              查看项目源
            </Link>
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            <Metric label="成熟度" value={candidate.maturityScore} />
            <Metric label="兼容性" value={candidate.compatibilityScore} />
            <Metric label="集成成本" value={candidate.integrationCostScore} inverse />
            <Metric label="战略价值" value={candidate.strategicValueScore} />
            <Metric label="商业价值" value={candidate.commercialValueScore} />
          </div>

          <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-[#8F835F]">搜策评语</div>
            <p className="mt-2 text-[12px] leading-6 text-[#AEB7D1]">{candidate.notes}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canRefresh || submitting || candidate.status === 'trialing'}
                onClick={() => void updateCandidateStatus('trialing')}
                className="rounded-full border border-[#F0C66A]/24 bg-[#F0C66A]/10 px-3 py-1.5 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/16 disabled:opacity-60"
              >
                {!canRefresh ? '当前席位无搜策权限' : '推进试用'}
              </button>
              <button
                type="button"
                disabled={!canRefresh || submitting || candidate.status === 'accepted'}
                onClick={() => void updateCandidateStatus('accepted')}
                className="rounded-full border border-[#F0C66A]/24 bg-[#F0C66A]/10 px-3 py-1.5 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/16 disabled:opacity-60"
              >
                {!canRefresh ? '当前席位无搜策权限' : '标记接收'}
              </button>
              <button
                type="button"
                disabled={!canRefresh || submitting || candidate.status === 'rejected'}
                onClick={() => void updateCandidateStatus('rejected')}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-[#D7CCA9] transition hover:border-white/20 hover:bg-white/[0.05] disabled:opacity-60"
              >
                {!canRefresh ? '当前席位无搜策权限' : '标记放弃'}
              </button>
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

function Metric({ label, value, inverse = false }: { label: string; value: number; inverse?: boolean }) {
  const tone =
    inverse ? (value <= 60 ? 'text-[#7AD3A1]' : 'text-[#F0C66A]') : value >= 80 ? 'text-[#7AD3A1]' : 'text-[#F0C66A]';
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-[#8F835F]">{label}</div>
      <div className={`mt-2 text-[24px] font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

function statusLabel(status: string) {
  switch (status) {
    case 'evaluated':
      return '已评估';
    case 'trialing':
      return '试用中';
    case 'accepted':
      return '已接收';
    case 'rejected':
      return '已放弃';
    default:
      return '已搜策';
  }
}

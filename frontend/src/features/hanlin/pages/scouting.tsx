'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { HanlinRoleBadge } from '@/features/hanlin/components/hanlin-role-badge';
import { hanlinRoleHeaders, hasHanlinCapability, readHanlinRole } from '@/features/hanlin/lib/access';
import { hanlinApi } from '@/features/hanlin/lib/api';
import { PageBrief } from '@/features/shared/components/page-brief';
import type { ScoutedProject, UpgradeCandidate } from '@/features/hanlin/types';

export function HanlinScoutingPage() {
  const role = readHanlinRole();
  const canRefresh = hasHanlinCapability(role, 'scouting_refresh');
  const [projects, setProjects] = useState<ScoutedProject[]>([]);
  const [candidates, setCandidates] = useState<UpgradeCandidate[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string>('');

  async function load() {
    try {
      const response = await fetch(hanlinApi('/api/hanlin/scouting'));
      if (!response.ok) {
        throw new Error('hanlin_scouting_fetch_failed');
      }
      const payload = (await response.json()) as { projects: ScoutedProject[]; candidates: UpgradeCandidate[] };
      setProjects(payload.projects);
      setCandidates(payload.candidates);
      setStatus('ready');
    } catch {
      setStatus('error');
      setRefreshMessage('候选项目暂时未取到，请稍后再试。');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(
    () =>
      candidates
        .map((candidate) => ({
          candidate,
          project: projects.find((item) => item.id === candidate.projectId),
        }))
        .filter((item) => item.project),
    [candidates, projects],
  );

  async function refreshFromGithub() {
    setIsRefreshing(true);
    setRefreshMessage('');
    const response = await fetch(hanlinApi('/api/hanlin/scouting'), { method: 'POST', headers: hanlinRoleHeaders(role) });
    const payload = (await response.json()) as {
      ok: boolean;
      error?: string;
      projects?: ScoutedProject[];
      candidates?: UpgradeCandidate[];
    };
    if (!response.ok || !payload.ok) {
      setStatus('error');
      setIsRefreshing(false);
      setRefreshMessage(payload.error ?? 'refresh_failed');
      return;
    }
    setProjects(payload.projects ?? []);
    setCandidates(payload.candidates ?? []);
    setStatus('ready');
    setIsRefreshing(false);
    setRefreshMessage('GitHub 搜策已刷新');
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1600px] space-y-5 p-6">
        <PageBrief
          eyebrow="Scouting Office · 搜策司"
          title="纪晓岚在这里看 GitHub 和各类 hub，不是为了追热点，而是为了升级 CourtOS。"
          hook="不是所有前沿都该吸收，值得吸收的必须能解释为什么。"
          brief="搜策司负责记录外部前沿项目、评估其成熟度、兼容性、集成成本与商业价值，形成升级候选榜。"
          primaryAction={{ label: '返回翰林院', href: '/hanlin' }}
          secondaryAction={{ label: '查看开榜司', href: '/hanlin/rankings', tone: 'secondary' }}
        />

        <HanlinRoleBadge
          role={role}
          note={canRefresh ? '当前席位可从 GitHub 刷新候选项目。' : '当前席位只能查看候选榜。'}
        />

        <GlassPanel tone="elevated" padding="lg">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="section-eyebrow">升级候选榜</div>
              <h2 className="section-title text-[20px]">先收候选，再决定试用、接收或放弃</h2>
            </div>
            <button
              type="button"
              onClick={() => void refreshFromGithub()}
              disabled={isRefreshing || !canRefresh}
              className="rounded-full border border-[#F0C66A]/24 bg-[#F0C66A]/10 px-3 py-1.5 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/16 disabled:opacity-60"
            >
              {isRefreshing ? '刷新中...' : '从 GitHub 刷新'}
            </button>
          </div>
          {refreshMessage ? (
            <div className="mb-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-[12px] text-[#D7CCA9]">
              {refreshMessage}
            </div>
          ) : null}
          <div className="space-y-3">
            {status === 'loading' ? (
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-[12px] text-[#BFC7DA]">
                搜策司正在整理最新候选项目。
              </div>
            ) : status === 'error' ? (
              <div className="rounded-2xl border border-[#F0C66A]/18 bg-[#F0C66A]/10 px-4 py-4 text-[12px] text-[#F6DFA2]">
                候选项目暂时未取到，请稍后再试。
              </div>
            ) : rows.length > 0 ? (
              rows.map(({ candidate, project }) => (
                <div key={candidate.id} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#8F835F]">
                        {project?.source} · {candidate.recommendedPriority}
                      </div>
                      <div className="mt-1 text-[15px] font-semibold text-[#F5E9C9]">{project?.name}</div>
                      <p className="mt-2 max-w-[820px] text-[12px] leading-6 text-[#AEB7D1]">{project?.summary}</p>
                    </div>
                    <Link
                      href={`/hanlin/scouting/${candidate.id}`}
                      className="inline-flex items-center gap-1 rounded-full border border-[#F0C66A]/22 bg-[#F0C66A]/10 px-3 py-1.5 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/16"
                    >
                      查看评估
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-5">
                    <Metric label="成熟度" value={candidate.maturityScore} />
                    <Metric label="兼容性" value={candidate.compatibilityScore} />
                    <Metric label="集成成本" value={candidate.integrationCostScore} inverse />
                    <Metric label="战略价值" value={candidate.strategicValueScore} />
                    <Metric label="商业价值" value={candidate.commercialValueScore} />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-[12px] text-[#BFC7DA]">
                当前还没有候选项目。可以先点击“从 GitHub 刷新”，把第一批前沿能力吸进搜策司。
              </div>
            )}
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
    <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-[#8F835F]">{label}</div>
      <div className={`mt-2 text-[18px] font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Crown, Sparkles, Telescope } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { hanlinApi } from '@/features/hanlin/lib/api';
import type { Contribution, Experiment, HanlinSummary, ProductizedModule, ScoutedProject, UpgradeCandidate } from '@/features/hanlin/types';

export function HanlinBridgePanel({ mode }: { mode: 'emperor' | 'chancellor' }) {
  const [summaryState, setSummaryState] = useState<HanlinSummary | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [projects, setProjects] = useState<ScoutedProject[]>([]);
  const [candidates, setCandidates] = useState<UpgradeCandidate[]>([]);
  const [modules, setModules] = useState<ProductizedModule[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    void (async () => {
      setStatus('loading');
      try {
        const [summaryRes, contributionRes, experimentRes, scoutingRes, incubationRes] = await Promise.all([
          fetch(hanlinApi('/api/hanlin/summary')),
          fetch(hanlinApi('/api/hanlin/contributions')),
          fetch(hanlinApi('/api/hanlin/experiments')),
          fetch(hanlinApi('/api/hanlin/scouting')),
          fetch(hanlinApi('/api/hanlin/incubation')),
        ]);

        if (!summaryRes.ok || !contributionRes.ok || !experimentRes.ok || !scoutingRes.ok || !incubationRes.ok) {
          throw new Error('hanlin_bridge_fetch_failed');
        }

        const summaryPayload = (await summaryRes.json()) as { summary: HanlinSummary };
        const contributionPayload = (await contributionRes.json()) as { contributions: Contribution[] };
        const experimentPayload = (await experimentRes.json()) as { experiments: Experiment[] };
        const scoutingPayload = (await scoutingRes.json()) as { projects: ScoutedProject[]; candidates: UpgradeCandidate[] };
        const incubationPayload = (await incubationRes.json()) as { modules: ProductizedModule[] };

        setSummaryState(summaryPayload.summary);
        setContributions(contributionPayload.contributions);
        setExperiments(experimentPayload.experiments);
        setProjects(scoutingPayload.projects);
        setCandidates(scoutingPayload.candidates);
        setModules(incubationPayload.modules);
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    })();
  }, []);

  const summary = useMemo(() => {
    const adoptedCount = experiments.filter((item) => item.status === 'adopted').length;
    const activeCandidate = candidates[0];
    const candidateProject = activeCandidate ? projects.find((item) => item.id === activeCandidate.projectId) : null;
    const sellableCount = modules.filter((item) => item.status === 'sellable' || item.status === 'active').length;
    const topContribution = contributions[0];
    return {
      adoptedCount: summaryState?.adoptedContributions ?? adoptedCount,
      activeCandidate,
      candidateProject,
      sellableCount: summaryState?.exportableModules ?? sellableCount,
      topContribution,
    };
  }, [candidates, contributions, experiments, modules, projects, summaryState]);

  const copy =
    mode === 'emperor'
      ? {
          eyebrow: 'Hanlin Feed · 纪晓岚简报',
          title: '纪晓岚线已开始影响主系统：状元、升级候选与可售模块应进入皇帝视野。',
          body: '大殿不需要展开 Hanlin 全部细节，但应该始终知道：哪些内部贡献已被采用、外部哪些项目正在被吸收、哪些能力开始具备出海价值。',
          primaryHref: '/hanlin',
          primaryLabel: '进入翰林院总览',
        }
      : {
          eyebrow: 'Hanlin Signals · 纪晓岚进呈',
          title: '军机处应知道纪晓岚线最近吸收了什么、榜上推了什么，以便决定是否纳入主案。',
          body: '对宰相来说，Hanlin 不是旁支信息，而是升级建议与模块标准化的前置输入。当前值得关注的是：哪些能力适合接到当前命令，哪些模块已经能作为执行标准件。',
          primaryHref: '/hanlin/scouting',
          primaryLabel: '看升级候选',
        };

  return (
    <GlassPanel tone="elevated" padding="lg" className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[860px]">
          <div className="section-eyebrow">{copy.eyebrow}</div>
          <h2 className="mt-2 text-[20px] font-semibold leading-8 text-[#F5E9C9]">{copy.title}</h2>
          <p className="mt-2 text-[12px] leading-6 text-[#BFC7DA]">{copy.body}</p>
        </div>
        <Link
          href={copy.primaryHref}
          className="inline-flex items-center gap-1 rounded-full border border-[#F0C66A]/24 bg-[#F0C66A]/10 px-3 py-1.5 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/16"
        >
          {copy.primaryLabel}
          <ArrowRight size={12} />
        </Link>
      </div>

      {status === 'error' ? (
        <div className="mt-4 rounded-2xl border border-[#F0C66A]/18 bg-[#F0C66A]/10 px-4 py-3 text-[12px] text-[#F6DFA2]">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} />
            <span>纪晓岚简报暂时未取到数据。Hanlin 子系统已接入主线，但当前桥接摘要读取失败。</span>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <SignalCard
          icon={Crown}
          eyebrow="本期贡献"
          title={summary.topContribution?.title ?? (status === 'loading' ? '正在整理本期贡士' : '待更新')}
          body={
            summary.topContribution
              ? `${summary.topContribution.authorName} · 当前状态 ${labelForContribution(summary.topContribution.status)}`
              : status === 'loading'
                ? '纪晓岚正在汇总最新投稿、试用与发榜结果。'
                : '当前还没有贡献进入榜单主视图。'
          }
          href={summary.topContribution ? '/hanlin/rankings' : '/hanlin/contribute'}
        />
        <SignalCard
          icon={Telescope}
          eyebrow="升级候选"
          title={summary.candidateProject?.name ?? (status === 'loading' ? '正在查阅 GitHub 与各类 hub' : '待搜策')}
          body={
            summary.activeCandidate && summary.candidateProject
              ? `优先级 ${summary.activeCandidate.recommendedPriority} · ${summary.candidateProject.summary}`
              : status === 'loading'
                ? '纪晓岚正在收束最新可吸收能力与升级候选。'
                : '当前没有进入主视图的升级候选。'
          }
          href="/hanlin/scouting"
        />
        <SignalCard
          icon={Sparkles}
          eyebrow="修典 / 出海"
          title={
            status === 'loading'
              ? '纪晓岚正在汇总修典与出海进度'
              : `${summary.sellableCount} 个可售候选 · ${summary.adoptedCount} 个已采用贡献`
          }
          body="修典司和出海司已经开始形成标准件与商品候选，不再只是说明页。"
          href="/hanlin/export"
        />
      </div>
    </GlassPanel>
  );
}

function SignalCard({
  icon: Icon,
  eyebrow,
  title,
  body,
  href,
}: {
  icon: typeof Crown;
  eyebrow: string;
  title: string;
  body: string;
  href: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#8F835F]">
        <Icon size={12} className="text-[#F0C66A]" />
        <span>{eyebrow}</span>
      </div>
      <div className="mt-2 text-[14px] font-semibold text-[#F5E9C9]">{title}</div>
      <p className="mt-2 text-[12px] leading-6 text-[#AEB7D1]">{body}</p>
      <Link href={href} className="mt-4 inline-flex items-center gap-1 text-[11px] text-[#F0C66A] transition hover:text-[#FFD98A]">
        查看详情
        <ArrowRight size={12} />
      </Link>
    </div>
  );
}

function labelForContribution(status: Contribution['status']) {
  switch (status) {
    case 'awarded':
      return '已发榜';
    case 'adopted':
      return '已采用';
    case 'experimenting':
      return '试用中';
    case 'recommended':
      return '待推荐';
    default:
      return '已投稿';
  }
}

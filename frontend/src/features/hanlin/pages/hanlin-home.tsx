'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Boxes, Crown, Telescope } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { HanlinRoleBadge } from '@/features/hanlin/components/hanlin-role-badge';
import { PageBrief } from '@/features/shared/components/page-brief';
import { TaiziBrief } from '@/features/hanlin/components/taizi-brief';
import { hanlinRoleHeaders, hasHanlinCapability, readHanlinRole } from '@/features/hanlin/lib/access';
import { hanlinApi } from '@/features/hanlin/lib/api';
import {
  useHanlinOverview,
  useHanlinContributions,
  useHanlinAwards,
  useHanlinScouting,
  useHanlinIncubation,
} from '@/features/hanlin/hooks/use-hanlin-data';

const exportPreview = [
  {
    name: '法律初诊摘要模板包',
    type: 'Service Pack',
    note: '适合对外打包成垂直模板服务。',
  },
  {
    name: '知识同步增量工作流',
    type: 'Workflow Pack',
    note: '适合变成企业知识接入服务的标准件。',
  },
  {
    name: '军机处回执表达组件',
    type: 'UI / Workflow',
    note: '适合沉淀为主系统标准交互资产。',
  },
] as const;

export function HanlinHomePage() {
  const role = readHanlinRole();
  const canRefresh = hasHanlinCapability(role, 'scouting_refresh');
  const canResetDemo = hasHanlinCapability(role, 'demo_reset');
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<string>('');

  // useSWR 替代 useEffect + fetch + setState（数据从 Turso 或 filesystem 加载）
  const { overview, summary, isLoading: overviewLoading, error: overviewError, mutate: mutateOverview } = useHanlinOverview();
  const { contributions, isLoading: contribLoading, mutate: mutateContrib } = useHanlinContributions();
  const { awards, isLoading: awardsLoading, mutate: mutateAwards } = useHanlinAwards();
  const { projects, candidates, isLoading: scoutingLoading, mutate: mutateScouting } = useHanlinScouting();
  const { modules, isLoading: incubationLoading, mutate: mutateIncubation } = useHanlinIncubation();

  const isLoading = overviewLoading || contribLoading || awardsLoading || scoutingLoading || incubationLoading;
  const status: 'loading' | 'ready' | 'error' = isLoading ? 'loading' : overviewError ? 'error' : 'ready';

  async function load() {
    await Promise.all([mutateOverview(), mutateContrib(), mutateAwards(), mutateScouting(), mutateIncubation()]);
  }

  async function resetDemo() {
    setResetting(true);
    setMessage('');
    const response = await fetch(hanlinApi('/api/hanlin/reset-demo'), {
      method: 'POST',
      headers: hanlinRoleHeaders(role),
    });
    if (response.ok) {
      await load();
      setMessage('翰林院演示院卷已恢复到标准初始状态。');
    } else {
      setMessage('演示院卷重置失败，请稍后重试。');
    }
    setResetting(false);
  }

  const stats = useMemo(
    () =>
      summary ?? {
        currentAwardCycle: '未立榜期',
        submittedContributions: contributions.length,
        rankedContributions: awards.length,
        activeCandidates: candidates.length,
        incubatingModules: modules.filter((m) => m.status === 'standardizing' || m.status === 'packaged').length,
        exportableModules: modules.filter((m) => m.status === 'sellable' || m.status === 'active').length,
        adoptedContributions: 0,
        queuedAwards: 0,
        paidAwards: 0,
        awardedAmount: 0,
        rewardPoolRemaining: 0,
        topContributionId: null,
        topCandidateId: null,
      },
    [awards.length, candidates.length, contributions.length, modules, summary],
  );

  const displayStats =
    status === 'loading'
      ? {
          currentAwardCycle: '整理中',
          submittedContributions: '—',
          activeCandidates: '—',
          exportableModules: '—',
          incubatingModules: '—',
        }
      : {
          currentAwardCycle: stats.currentAwardCycle,
          submittedContributions: `${stats.submittedContributions}`,
          activeCandidates: `${stats.activeCandidates}`,
          exportableModules: `${stats.exportableModules}`,
          incubatingModules: `${stats.incubatingModules}`,
        };

  const topAward = awards[0];
  const topContribution =
    overview?.topContribution ??
    contributions.find((item) => item.id === topAward?.contributionId) ??
    contributions[0] ??
    null;
  const topCandidate = overview?.topCandidate ?? candidates[0] ?? null;
  const topProject =
    overview?.topCandidate?.project ??
    (topCandidate ? projects.find((item) => item.id === topCandidate.projectId) ?? null : null);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1600px] space-y-5 p-6">
        <PageBrief
          eyebrow="Hanlin Academy · 翰林院"
          title="纪晓岚总翰林，内开榜、外搜策，把优秀能力收进 CourtOS，再把真正值钱的部分卖出去。"
          subtitle="翰林院是主系统的进化层，不只是榜单页。这里同时管理贡献识别、前沿吸收、模块修典与出海商品化。"
          hook="不是为了好看立一个院，而是给 CourtOS 造未来。"
          brief="先让纪晓岚有真实入口，再让贡献金库和升级候选榜形成闭环。内部优秀贡献被识别和应用，外部前沿能力被筛选和吸收，最终沉淀成可售模块与更强的主系统。"
          philosophy="纪晓岚线的职责不是增加页面，而是让系统持续变强、持续变值钱。"
          stats={[
            { label: '本期榜期', value: displayStats.currentAwardCycle },
            { label: '投稿数', value: displayStats.submittedContributions },
            { label: '候选项目', value: displayStats.activeCandidates },
            { label: '可售模块', value: displayStats.exportableModules },
          ]}
          primaryAction={{ label: '进入开榜司', href: '/hanlin/rankings' }}
          secondaryAction={{ label: '查看升级候选', href: '/hanlin/scouting', tone: 'secondary' }}
        />

        <HanlinRoleBadge
          role={role}
          note={canRefresh ? '当前席位可刷新搜策候选，并统筹翰林院动作。' : '当前席位可浏览翰林院结果，但不具备全部治理动作。'}
        />

        {canResetDemo ? (
          <GlassPanel tone="elevated" padding="md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12px] leading-6 text-[#D7CCA9]">
                演示、QA 或路演前，可将翰林院数据恢复为标准初始状态，避免前序操作污染当前展示。
              </p>
              <button
                type="button"
                disabled={resetting}
                onClick={() => void resetDemo()}
                className="rounded-full border border-[#F0C66A]/24 bg-[#F0C66A]/10 px-3 py-1.5 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/16 disabled:opacity-60"
              >
                {resetting ? '重置中...' : '重置演示院卷'}
              </button>
            </div>
          </GlassPanel>
        ) : null}

        {message ? (
          <GlassPanel tone="elevated" padding="md">
            <p className="text-[12px] text-[#D7CCA9]">{message}</p>
          </GlassPanel>
        ) : null}

        <TaiziBrief
          awardCycle={displayStats.currentAwardCycle}
          submittedContributions={displayStats.submittedContributions}
          activeCandidates={displayStats.activeCandidates}
          incubatingModules={displayStats.incubatingModules}
          exportableModules={displayStats.exportableModules}
        />

        {status === 'error' ? (
          <GlassPanel tone="elevated" padding="md">
            <p className="text-[12px] text-[#F6DFA2]">翰林院首页数据暂时未取到，当前页会回退到已有本地状态后的空视图。</p>
          </GlassPanel>
        ) : null}

        <GlassPanel tone="elevated" padding="lg">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="section-eyebrow">Skill Forge · 炼 Skill 工房</div>
              <h2 className="section-title text-[20px]">把外部前沿拆成证据、学习、Skill、评测和史馆复盘</h2>
              <p className="mt-2 max-w-[820px] text-[12px] leading-6 text-[#AEB7D1]">
                先用 Serenity 瓶颈投资法跑通锦衣卫采证、钦天监蒸馏、翰林炼 Skill、户部门禁和史馆归档的闭环；视频链接默认走 learn-video-to-skill，能装就装，不能装就复刻成本地 Skill。
              </p>
            </div>
            <Link
              href="/hanlin/skill-forge"
              className="inline-flex items-center gap-2 rounded-full border border-[#F0C66A]/24 bg-[#F0C66A]/10 px-4 py-2 text-[12px] text-[#F0C66A] transition hover:bg-[#F0C66A]/16"
            >
              进入炼 Skill
              <ArrowRight size={14} />
            </Link>
          </div>
        </GlassPanel>

        <div className="grid gap-5 xl:grid-cols-3">
          <SummaryPanel
            icon={Crown}
            eyebrow="本期开榜"
            title={topContribution ? `${topContribution.title}` : '本期榜单待启'}
            description={
              topContribution
                ? `当前状元候选来自 ${topContribution.authorName}，已进入 ${topContribution.applicationHint}。`
                : '当前尚无榜单数据。'
            }
            href="/hanlin/rankings"
            meta={topAward ? `奖项 · ${awardLabel(topAward.awardType)} · 奖金 ¥${topAward.finalAmount}` : '待开榜'}
          />
          <SummaryPanel
            icon={Telescope}
            eyebrow="升级候选榜"
            title={topProject ? topProject.name : '候选库待建立'}
            description={
              topProject
                ? `${topProject.summary} 当前优先级 ${topCandidate?.recommendedPriority ?? 'P2'}。`
                : '等待搜策司接入首批候选项目。'
            }
            href="/hanlin/scouting"
            meta={topCandidate ? `状态 · ${candidateLabel(topCandidate.status)}` : '待搜策'}
          />
          <SummaryPanel
            icon={Boxes}
            eyebrow="出海商品榜"
            title="先修典，再出海"
            description="目前先锁定 3 个高潜模块：模板包、工作流包、军机处表达资产。"
            href="/hanlin/export"
            meta={`${stats.exportableModules} 个可售候选`}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <GlassPanel tone="elevated" padding="lg">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="section-eyebrow">修典中的模块</div>
                <h2 className="section-title text-[20px]">先把内部好东西整理干净，再考虑对外出售</h2>
              </div>
              <Link href="/hanlin/incubation" className="text-[11px] text-[#F0C66A] transition hover:opacity-80">
                进入修典司
              </Link>
            </div>
            <div className="space-y-3">
              {exportPreview.map((item) => (
                <div key={item.name} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[12px] font-semibold text-[#F5E9C9]">{item.name}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#8F835F]">{item.type}</div>
                    </div>
                    <div className="rounded-full border border-[#F0C66A]/20 bg-[#F0C66A]/10 px-2.5 py-1 text-[11px] text-[#F0C66A]">
                      待修典
                    </div>
                  </div>
                  <p className="mt-2 text-[12px] leading-6 text-[#AEB7D1]">{item.note}</p>
                </div>
              ))}
            </div>
          </GlassPanel>

          <GlassPanel tone="elevated" padding="lg">
            <div className="mb-4">
              <div className="section-eyebrow">快速去向</div>
              <h2 className="section-title text-[20px]">纪晓岚今日最应该盯的 3 个入口</h2>
            </div>
            <div className="space-y-3">
              <QuickLink
                href="/hanlin/rankings"
                title="开榜司"
                body="看中状元榜、榜眼、探花与待评贡献，先把内部价值评定跑起来。"
              />
              <QuickLink
                href="/hanlin/scouting"
                title="搜策司"
                body="看 GitHub / hub 候选库，把最值得吸收的能力记进升级候选榜。"
              />
              <QuickLink
                href="/hanlin/export"
                title="出海司"
                body="查看哪些内部能力已经值得标准化并包装成可售模块。"
              />
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}

function SummaryPanel({
  icon: Icon,
  eyebrow,
  title,
  description,
  href,
  meta,
}: {
  icon: typeof Crown;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  meta: string;
}) {
  return (
    <GlassPanel tone="elevated" padding="lg">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#8F835F]">
        <Icon size={12} className="text-[#F0C66A]" />
        <span>{eyebrow}</span>
      </div>
      <h2 className="mt-3 text-[20px] font-semibold leading-snug text-[#F5E9C9]">{title}</h2>
      <p className="mt-2 text-[12px] leading-6 text-[#AEB7D1]">{description}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-[11px] text-[#D8C99C]">{meta}</div>
        <Link
          href={href}
          className="inline-flex items-center gap-1 rounded-full border border-[#F0C66A]/22 bg-[#F0C66A]/10 px-3 py-1.5 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/16"
        >
          进入
          <ArrowRight size={12} />
        </Link>
      </div>
    </GlassPanel>
  );
}

function QuickLink({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 transition hover:border-[#F0C66A]/18 hover:bg-white/[0.045]"
    >
      <div className="text-[12px] font-semibold text-[#F5E9C9]">{title}</div>
      <p className="mt-2 text-[12px] leading-6 text-[#AEB7D1]">{body}</p>
    </Link>
  );
}

function awardLabel(awardType: string) {
  switch (awardType) {
    case 'zhuangyuan':
      return '中状元';
    case 'bangyan':
      return '榜眼';
    case 'tanhua':
      return '探花';
    case 'special_contribution':
      return '特别奖';
    case 'application_star':
      return '应用之星';
    default:
      return '提名';
  }
}

function candidateLabel(status: string) {
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

'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Boxes, Crown, Telescope } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { PageBrief } from '@/features/shared/components/page-brief';
import { TaiziBrief } from '@/features/hanlin/components/taizi-brief';
import { deriveHanlinLedgerView } from '@/features/hanlin/lib/read-model';
import {
  useHanlinOverview,
  useHanlinContributions,
  useHanlinAwards,
  useHanlinScouting,
  useHanlinIncubation,
} from '@/features/hanlin/hooks/use-hanlin-data';

export function HanlinHomePage() {
  // useSWR 替代 useEffect + fetch + setState（数据从 Turso 或 filesystem 加载）
  const { overview, summary, isLoading: overviewLoading, error: overviewError } = useHanlinOverview();
  const { contributions, isLoading: contribLoading, error: contribError } = useHanlinContributions();
  const { awards, isLoading: awardsLoading, error: awardsError } = useHanlinAwards();
  const { projects, candidates, isLoading: scoutingLoading, error: scoutingError } = useHanlinScouting();
  const { modules, isLoading: incubationLoading, error: incubationError } = useHanlinIncubation();

  const isLoading = overviewLoading || contribLoading || awardsLoading || scoutingLoading || incubationLoading;
  const hasDataError = Boolean(overviewError || contribError || awardsError || scoutingError || incubationError);
  const status: 'loading' | 'ready' | 'error' = isLoading ? 'loading' : hasDataError ? 'error' : 'ready';
  const trustedOverview = hasDataError ? null : overview;
  const trustedContributions = hasDataError ? [] : contributions;
  const trustedAwards = hasDataError ? [] : awards;
  const trustedProjects = hasDataError ? [] : projects;
  const trustedCandidates = hasDataError ? [] : candidates;
  const trustedModules = hasDataError ? [] : modules;
  const ledgerView = deriveHanlinLedgerView(trustedOverview);

  const stats = useMemo(
    () =>
      (hasDataError ? null : summary) ?? {
        currentAwardCycle: '未立榜期',
        submittedContributions: trustedContributions.length,
        rankedContributions: trustedAwards.length,
        activeCandidates: trustedCandidates.length,
        incubatingModules: trustedModules.filter((m) => m.status === 'standardizing' || m.status === 'packaged').length,
        exportableModules: trustedModules.filter((m) => m.status === 'sellable' || m.status === 'active').length,
        adoptedContributions: 0,
        queuedAwards: 0,
        paidAwards: 0,
        awardedAmount: 0,
        rewardPoolRemaining: 0,
        topContributionId: null,
        topCandidateId: null,
      },
    [hasDataError, summary, trustedAwards.length, trustedCandidates.length, trustedContributions.length, trustedModules],
  );

  const displayStats =
    status !== 'ready'
      ? {
          currentAwardCycle: status === 'loading' ? '整理中' : '不可用',
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

  const topAward = trustedAwards[0];
  const topContribution =
    trustedOverview?.topContribution ??
    trustedContributions.find((item) => item.id === topAward?.contributionId) ??
    trustedContributions[0] ??
    null;
  const topCandidate = trustedOverview?.topCandidate ?? trustedCandidates[0] ?? null;
  const topProject =
    trustedOverview?.topCandidate?.project ??
    (topCandidate ? trustedProjects.find((item) => item.id === topCandidate.projectId) ?? null : null);

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

        <GlassPanel tone="elevated" padding="md">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="section-eyebrow">Truth Ledger · 真值台账</div>
              <h2 className="section-title text-[18px]">
                {ledgerView.isAvailable ? '真实离线判定已接入' : '暂无真实离线判定'}
              </h2>
              <p className="mt-2 max-w-[760px] text-[12px] leading-6 text-[#AEB7D1]">
                {ledgerView.isAvailable
                  ? '数据直接来自后端 truth_ledger，只读展示确定性评测结果。'
                  : '后端账本为空或不可用；当前保持 FALLBACK 空态，不启用本地演示数据。'}
              </p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-[11px] ${ledgerView.isAvailable ? 'border-[#7AD3A1]/25 bg-[#7AD3A1]/10 text-[#9BE7B9]' : 'border-[#F0C66A]/25 bg-[#F0C66A]/10 text-[#F6DFA2]'}`}>
              {ledgerView.sourceLabel}
            </span>
          </div>
          {ledgerView.isAvailable ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LedgerStat label="账本条目" value={ledgerView.totalEntries} />
              <LedgerStat label="确定性判定" value={ledgerView.deterministicEntries} />
              <LedgerStat label="通过 / 未通过" value={`${ledgerView.passed ?? 0} / ${ledgerView.failed ?? 0}`} />
              <LedgerStat label="判定通过率" value={formatRatio(ledgerView.passRate)} />
            </div>
          ) : null}
        </GlassPanel>

        <TaiziBrief
          awardCycle={displayStats.currentAwardCycle}
          submittedContributions={displayStats.submittedContributions}
          activeCandidates={displayStats.activeCandidates}
          incubatingModules={displayStats.incubatingModules}
          exportableModules={displayStats.exportableModules}
        />

        {status === 'error' ? (
          <GlassPanel tone="elevated" padding="md">
            <p className="text-[12px] text-[#F6DFA2]">翰林院首页数据暂时未取到，当前页保持 FALLBACK 空视图，不启用本地演示数据。</p>
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
              {trustedModules.length === 0 ? (
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-[12px] text-[#AEB7D1]">
                  当前没有来自后端读模型的修典模块；不使用本地示例填充。
                </div>
              ) : trustedModules.slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[12px] font-semibold text-[#F5E9C9]">{item.name}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#8F835F]">{item.ownerName}</div>
                    </div>
                    <div className="rounded-full border border-[#F0C66A]/20 bg-[#F0C66A]/10 px-2.5 py-1 text-[11px] text-[#F0C66A]">
                      {moduleStatusLabel(item.status)}
                    </div>
                  </div>
                  <p className="mt-2 text-[12px] leading-6 text-[#AEB7D1]">{item.notes}</p>
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

function formatRatio(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

function moduleStatusLabel(status: string): string {
  switch (status) {
    case 'standardizing':
      return '修典中';
    case 'packaged':
      return '已打包';
    case 'sellable':
      return '可售候选';
    case 'active':
      return '已上架';
    default:
      return '草稿';
  }
}

function LedgerStat({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#8F835F]">{label}</div>
      <div className="mt-2 text-[20px] font-semibold text-[#F5E9C9]">{value ?? '—'}</div>
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

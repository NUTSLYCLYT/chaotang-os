'use client';

import { useEffect, useMemo, useState } from 'react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { HanlinRoleBadge } from '@/features/hanlin/components/hanlin-role-badge';
import { hanlinRoleHeaders, hasHanlinCapability, readHanlinRole } from '@/features/hanlin/lib/access';
import { hanlinApi } from '@/features/hanlin/lib/api';
import { PageBrief } from '@/features/shared/components/page-brief';
import type { AiReview, Award, Contribution, Experiment, RewardPeriod } from '@/features/hanlin/types';

export function HanlinRankingsPage() {
  const role = readHanlinRole();
  const canManageAwards = hasHanlinCapability(role, 'award_manage');
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [reviews, setReviews] = useState<AiReview[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [currentRewardPeriod, setCurrentRewardPeriod] = useState<RewardPeriod | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function load() {
    setStatus('loading');
    try {
      const [contributionRes, reviewRes, experimentRes, awardRes] = await Promise.all([
        fetch(hanlinApi('/api/hanlin/contributions')),
        fetch(hanlinApi('/api/hanlin/reviews')),
        fetch(hanlinApi('/api/hanlin/experiments')),
        fetch(hanlinApi('/api/hanlin/awards')),
      ]);
      if (!contributionRes.ok || !reviewRes.ok || !experimentRes.ok || !awardRes.ok) {
        throw new Error('hanlin_rankings_fetch_failed');
      }
      const contributionPayload = (await contributionRes.json()) as { contributions: Contribution[] };
      const reviewPayload = (await reviewRes.json()) as { reviews: AiReview[] };
      const experimentPayload = (await experimentRes.json()) as { experiments: Experiment[] };
      const awardPayload = (await awardRes.json()) as {
        awards: Award[];
        currentRewardPeriod: RewardPeriod | null;
      };
      setContributions(contributionPayload.contributions);
      setReviews(reviewPayload.reviews);
      setExperiments(experimentPayload.experiments);
      setAwards(awardPayload.awards);
      setCurrentRewardPeriod(awardPayload.currentRewardPeriod);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  useEffect(() => {
    void (async () => {
      setStatus('loading');
      await load();
    })();
  }, []);

  const ranked = useMemo(() => {
    const items = contributions
      .map((contribution) => {
        const review = reviews.find((item) => item.contributionId === contribution.id);
        const experiment = experiments.find((item) => item.contributionId === contribution.id);
        const adoptedBonus = experiment?.status === 'adopted' ? 12 : experiment?.status === 'running' ? 6 : 0;
        const score = (review?.valueScore ?? 0) + (review?.qualityScore ?? 0) + adoptedBonus - (review?.riskScore ?? 0);
        return {
          contribution,
          review,
          experiment,
          score,
        };
      })
      .filter((item) => item.review)
      .sort((a, b) => b.score - a.score);

    return items.slice(0, 3).map((item, index) => ({
      ...item,
      awardLabel: index === 0 ? '中状元' : index === 1 ? '榜眼' : '探花',
      awardType:
        (index === 0 ? 'zhuangyuan' : index === 1 ? 'bangyan' : 'tanhua') as Award['awardType'],
      amount:
        index === 0
          ? item.review!.priceSuggestionMax
          : index === 1
            ? Math.round((item.review!.priceSuggestionMin + item.review!.priceSuggestionMax) / 2)
            : item.review!.priceSuggestionMin,
      issuedAward: awards.find((award) => award.contributionId === item.contribution.id),
    }));
  }, [awards, contributions, reviews, experiments]);

  const pending = useMemo(
    () =>
      contributions
        .filter((item) => item.status !== 'awarded')
        .slice(0, 3),
    [contributions],
  );

  const remainingPool = currentRewardPeriod
    ? Math.max(
        Math.max(currentRewardPeriod.rewardPoolAmount, currentRewardPeriod.guaranteeAmount) -
          currentRewardPeriod.awardedAmount,
        0,
      )
    : 0;
  const displayRewardPeriodName = status === 'loading' ? '整理中' : currentRewardPeriod ? currentRewardPeriod.name : '当前榜期未建立';
  const displayRevenueBase = status === 'loading' ? '—' : `¥${currentRewardPeriod?.revenueAmount ?? 0}`;
  const displayRewardPoolBase =
    status === 'loading'
      ? '—'
      : `¥${Math.max(currentRewardPeriod?.rewardPoolAmount ?? 0, currentRewardPeriod?.guaranteeAmount ?? 0)}`;
  const displayAwardedAmount = status === 'loading' ? '—' : `¥${currentRewardPeriod?.awardedAmount ?? 0}`;
  const displayRemainingPool = status === 'loading' ? '—' : `¥${remainingPool}`;

  async function issueAward(args: {
    contributionId: string;
    awardType: Award['awardType'];
    finalAmount: number;
    awardReason: string;
  }) {
    if (!currentRewardPeriod) return;
    setIssuingId(args.contributionId);
    setMessage('');
    const response = await fetch(hanlinApi('/api/hanlin/awards'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...hanlinRoleHeaders(role) },
      body: JSON.stringify({
        periodId: currentRewardPeriod.id,
        contributionId: args.contributionId,
        awardType: args.awardType,
        finalAmount: args.finalAmount,
        awardReason: args.awardReason,
      }),
    });
    if (response.ok) {
      setMessage('开榜司已完成本次发奖登记，奖金已进入待支付队列。');
      await load();
    } else {
      setMessage('发奖登记失败，请稍后重试。');
    }
    setIssuingId(null);
  }

  async function markAwardPaid(award: Award) {
    setPayingId(award.id);
    setMessage('');
    const response = await fetch(hanlinApi('/api/hanlin/awards'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...hanlinRoleHeaders(role) },
      body: JSON.stringify({
        id: award.id,
        paidStatus: 'paid',
      }),
    });
    if (response.ok) {
      setMessage('户部已将该笔奖金标记为已支付。');
      await load();
    } else {
      setMessage('支付状态更新失败，请稍后重试。');
    }
    setPayingId(null);
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1600px] space-y-5 p-6">
        <PageBrief
          eyebrow="Opening Roll · 开榜司"
          title="先开榜，再发奖，再看哪些贡献真的被主系统采用。"
          hook="状元不是看谁会包装，而是看谁创造了真实价值。"
          brief="开榜司负责把内部贡献经过 AI 价值评定、人工推荐、应用验证之后，沉淀成可公示的中状元榜与历史榜单。"
          primaryAction={{ label: '返回翰林院', href: '/hanlin' }}
          secondaryAction={{ label: '查看升级候选榜', href: '/hanlin/scouting', tone: 'secondary' }}
        />

        <HanlinRoleBadge
          role={role}
          note={canManageAwards ? '当前席位可登记发奖并管理奖池动作。' : '当前席位只能查看榜单与发奖流水。'}
        />

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <GlassPanel tone="elevated" padding="lg">
            <div className="section-eyebrow">奖池总账</div>
            <h2 className="section-title text-[20px]">
              {displayRewardPeriodName}
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Metric label="营收基数" value={displayRevenueBase} />
              <Metric label="奖池基准" value={displayRewardPoolBase} />
              <Metric label="已登记发奖" value={displayAwardedAmount} />
              <Metric label="剩余额度" value={displayRemainingPool} />
            </div>
            <p className="mt-4 text-[12px] leading-6 text-[#AEB7D1]">
              当前 MVP 只做到发奖登记与奖池扣减，不做真实支付。支付状态统一进入 `queued`，后续再接财务或打款层。
            </p>
          </GlassPanel>

          <GlassPanel tone="elevated" padding="lg">
            <div className="section-eyebrow">发奖流水</div>
            <h2 className="section-title text-[20px]">本期已登记奖金</h2>
            <div className="mt-4 space-y-3">
              {awards.length > 0 ? (
                awards.slice(0, 4).map((award) => {
                  const contribution = contributions.find((item) => item.id === award.contributionId);
                  return (
                    <div key={award.id} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[13px] font-semibold text-[#F5E9C9]">
                            {contribution?.title ?? award.contributionId}
                          </div>
                          <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[#8F835F]">
                            {awardLabelFromType(award.awardType)} · {award.paidStatus === 'paid' ? '已支付' : '待支付'}
                          </div>
                        </div>
                        <div className="rounded-full border border-[#F0C66A]/22 bg-[#F0C66A]/10 px-3 py-1 text-[11px] text-[#F0C66A]">
                          ¥{award.finalAmount}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {award.paidStatus === 'paid' ? (
                          <div className="rounded-full border border-[#7AD3A1]/22 bg-[#7AD3A1]/10 px-3 py-1.5 text-[11px] text-[#7AD3A1]">
                            已支付
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={!canManageAwards || payingId === award.id}
                            onClick={() => void markAwardPaid(award)}
                            className="rounded-full border border-[#F0C66A]/24 bg-[#F0C66A]/10 px-3 py-1.5 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/16 disabled:opacity-60"
                          >
                            {!canManageAwards ? '当前席位无支付权限' : payingId === award.id ? '处理中...' : '标记已支付'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-[12px] text-[#BFC7DA]">
                  当前还没有发奖流水。
                </div>
              )}
            </div>
          </GlassPanel>
        </div>

        {message ? (
          <GlassPanel tone="elevated" padding="md">
            <p className="text-[12px] text-[#D7CCA9]">{message}</p>
          </GlassPanel>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
          <GlassPanel tone="elevated" padding="lg">
            <div className="mb-4">
              <div className="section-eyebrow">本期开榜</div>
              <h2 className="section-title text-[20px]">中状元榜 · 榜眼 · 提名</h2>
            </div>
            <div className="space-y-3">
              {status === 'loading' ? (
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-[12px] text-[#BFC7DA]">
                  开榜司正在汇总 AI 评估、应用状态与奖金建议。
                </div>
              ) : status === 'error' ? (
                <div className="rounded-2xl border border-[#F0C66A]/18 bg-[#F0C66A]/10 px-4 py-4 text-[12px] text-[#F6DFA2]">
                  榜单数据暂时未取到，请稍后重试。
                </div>
              ) : ranked.length > 0 ? (
                ranked.map(({ awardLabel, awardType, amount, contribution, experiment, review, issuedAward }) => (
                  <div key={contribution.id} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-[#8F835F]">{awardLabel}</div>
                        <div className="mt-1 text-[15px] font-semibold text-[#F5E9C9]">{contribution.title}</div>
                        <div className="mt-1 text-[12px] text-[#B9C1D6]">{contribution.authorName}</div>
                      </div>
                      <div className="rounded-full border border-[#F0C66A]/22 bg-[#F0C66A]/10 px-3 py-1 text-[11px] text-[#F0C66A]">
                        ¥{amount}
                      </div>
                    </div>
                    <p className="mt-3 text-[12px] leading-6 text-[#AEB7D1]">
                      {review?.explanation}
                      {experiment?.status === 'adopted' ? ' 已进入正式采用，榜单优先级提升。' : ''}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {issuedAward ? (
                        <div className="rounded-full border border-[#F0C66A]/22 bg-[#F0C66A]/10 px-3 py-1.5 text-[11px] text-[#F0C66A]">
                          已登记发奖
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={
                            issuingId === contribution.id ||
                            !currentRewardPeriod ||
                            remainingPool < amount ||
                            !canManageAwards
                          }
                          onClick={() =>
                            void issueAward({
                              contributionId: contribution.id,
                              awardType,
                              finalAmount: amount,
                              awardReason: review?.explanation ?? `${awardLabel} 发奖`,
                            })
                          }
                          className="rounded-full border border-[#F0C66A]/24 bg-[#F0C66A]/10 px-3 py-1.5 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/16 disabled:opacity-60"
                        >
                          {!canManageAwards ? '当前席位无发奖权限' : issuingId === contribution.id ? '登记中...' : '登记发奖'}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-[12px] text-[#BFC7DA]">
                  当前还没有足够的评估结果形成正式榜单，先去贡献金库投稿或推进推荐、试用。
                </div>
              )}
            </div>
          </GlassPanel>

          <GlassPanel tone="elevated" padding="lg">
            <div className="mb-4">
              <div className="section-eyebrow">待评贡献</div>
              <h2 className="section-title text-[20px]">下一轮最值得评估的 3 个投稿</h2>
            </div>
            <div className="space-y-3">
              {pending.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[13px] font-semibold text-[#F5E9C9]">{item.title}</div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-[#8F835F]">{statusLabel(item.status)}</div>
                  </div>
                  <p className="mt-2 text-[12px] leading-6 text-[#AEB7D1]">{item.summary}</p>
                </div>
              ))}
              {pending.length === 0 ? (
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-[12px] text-[#BFC7DA]">
                  当前没有待评贡献，说明这一期投稿和评估已经基本收束。
                </div>
              ) : null}
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-[#8F835F]">{label}</div>
      <div className="mt-2 text-[18px] font-semibold text-[#F5E9C9]">{value}</div>
    </div>
  );
}

function statusLabel(status: string) {
  switch (status) {
    case 'awarded':
      return '已发榜';
    case 'recommended':
      return '待推荐';
    case 'experimenting':
      return '试用中';
    default:
      return '已投稿';
  }
}

function awardLabelFromType(awardType: Award['awardType']) {
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

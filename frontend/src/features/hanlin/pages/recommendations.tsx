'use client';

import { useEffect, useMemo, useState } from 'react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { PageBrief } from '@/features/shared/components/page-brief';
import { AiReviewSummary } from '@/features/hanlin/components/ai-review-summary';
import { HanlinRoleBadge } from '@/features/hanlin/components/hanlin-role-badge';
import { hanlinRoleHeaders, hasHanlinCapability, readHanlinRole } from '@/features/hanlin/lib/access';
import { fetchHanlin } from '@/features/hanlin/lib/api';
import type { AiReview, Contribution, Recommendation } from '@/features/hanlin/types';

export function HanlinRecommendationsPage() {
  const role = readHanlinRole();
  const canRecommend = hasHanlinCapability(role, 'recommend');
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [reviews, setReviews] = useState<AiReview[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');

  async function load() {
    setStatus('loading');
    try {
      const [contributionRes, reviewRes, recommendationRes] = await Promise.all([
        fetchHanlin('/api/hanlin/contributions'),
        fetchHanlin('/api/hanlin/reviews'),
        fetchHanlin('/api/hanlin/recommendations'),
      ]);
      if (!contributionRes.ok || !reviewRes.ok || !recommendationRes.ok) {
        throw new Error('hanlin_recommendations_fetch_failed');
      }

      const contributionPayload = (await contributionRes.json()) as { contributions: Contribution[] };
      const reviewPayload = (await reviewRes.json()) as { reviews: AiReview[] };
      const recommendationPayload = (await recommendationRes.json()) as { recommendations: Recommendation[] };

      setContributions(contributionPayload.contributions);
      setReviews(reviewPayload.reviews);
      setRecommendations(recommendationPayload.recommendations);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const pending = useMemo(
    () =>
      contributions
        .filter((item) => item.status === 'submitted' || item.status === 'recommended' || item.status === 'experimenting')
        .sort((a, b) => {
          const reviewA = reviews.find((entry) => entry.contributionId === a.id);
          const reviewB = reviews.find((entry) => entry.contributionId === b.id);
          return (reviewB?.valueScore ?? 0) - (reviewA?.valueScore ?? 0);
        }),
    [contributions, reviews],
  );

  const recommendedCount = recommendations.length;
  const highValueCount = pending.filter((item) => {
    const review = reviews.find((entry) => entry.contributionId === item.id);
    return (review?.valueScore ?? 0) >= 80;
  }).length;

  async function submitRecommendation(
    contributionId: string,
    action: Recommendation['action'],
  ) {
    setSubmittingId(contributionId);
    setMessage('');
    const labelMap: Record<Recommendation['action'], string> = {
      recommend_experiment: '建议先进入应用池验证',
      recommend_nomination: '建议直接进入提名观察',
      recommend_observe: '建议先进入观察池',
      reject: '当前不建议继续进入本期榜单',
    };
    const response = await fetchHanlin('/api/hanlin/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...hanlinRoleHeaders(role) },
      body: JSON.stringify({
        contributionId,
        reviewerName: '翰林学士·系统默认评审',
        action,
        reason: labelMap[action],
        targetModule: action === 'recommend_experiment' ? '应用实验池' : '开榜司观察池',
      }),
    });
    if (response.ok) {
      await load();
      setMessage(
        action === 'recommend_experiment'
          ? '推荐池已将该贡献送入应用验证方向。'
          : action === 'recommend_nomination'
            ? '推荐池已将该贡献推入提名观察。'
            : action === 'recommend_observe'
              ? '推荐池已将该贡献转入观察池。'
              : '推荐池已记录暂不推荐。'
      );
    } else {
      setMessage('推荐动作提交失败，请稍后重试。');
    }
    setSubmittingId(null);
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1500px] space-y-5 p-6">
        <PageBrief
          eyebrow="Recommendation Pool · 推荐池"
          title="AI 先海选，人工再决定先试用、先观察，还是先提名。"
          hook="人工层不是替代 AI，而是纠偏和决定去向。"
          brief="推荐池承接 AI 高分贡献，给出是否进入应用池、观察池或提名榜的人工判断。"
          primaryAction={{ label: '进入应用实验池', href: '/hanlin/experiments' }}
          secondaryAction={{ label: '返回开榜司', href: '/hanlin/rankings', tone: 'secondary' }}
        />

        <HanlinRoleBadge
          role={role}
          note={canRecommend ? '当前席位可对高分贡献进行人工分流。' : '当前席位只能查看推荐池结果。'}
        />

        {message ? (
          <GlassPanel tone="elevated" padding="md">
            <p className="text-[12px] text-[#D7CCA9]">{message}</p>
          </GlassPanel>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <SummaryStat label="待人工分流" value={`${pending.length}`} />
          <SummaryStat label="高价值候选" value={`${highValueCount}`} />
          <SummaryStat label="已记录推荐" value={`${recommendedCount}`} />
        </div>

        <div className="space-y-5">
          {status === 'loading' ? (
            <GlassPanel tone="elevated" padding="lg">
              <p className="text-[12px] text-[#AEB7D1]">推荐池正在汇总 AI 海选结果与历史推荐动作。</p>
            </GlassPanel>
          ) : status === 'error' ? (
            <GlassPanel tone="elevated" padding="lg">
              <p className="text-[12px] text-[#F6DFA2]">推荐池数据暂时未取到，请稍后重试。</p>
            </GlassPanel>
          ) : pending.map((item) => {
            const review = reviews.find((entry) => entry.contributionId === item.id);
            const recommendation = recommendations.find((entry) => entry.contributionId === item.id);
            return (
              <GlassPanel key={item.id} tone="elevated" padding="lg">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="section-eyebrow">待推荐</div>
                    <h2 className="section-title text-[20px]">{item.title}</h2>
                    <p className="mt-2 text-[12px] leading-6 text-[#BFC7DA]">{item.summary}</p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-[#D7CCA9]">
                    {item.authorName}
                  </div>
                </div>
                {review ? <div className="mt-4"><AiReviewSummary review={review} /></div> : null}
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  {[
                    ['进入应用池', 'recommend_experiment'],
                    ['进入观察池', 'recommend_observe'],
                    ['直接提名', 'recommend_nomination'],
                    ['暂不推荐', 'reject'],
                  ].map(([label, action]) => (
                    <button
                      key={label}
                      type="button"
                      disabled={submittingId === item.id || !canRecommend}
                      onClick={() => void submitRecommendation(item.id, action as Recommendation['action'])}
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left text-[12px] text-[#E8E1C8] transition hover:border-[#F0C66A]/24 hover:bg-[#F0C66A]/8 disabled:opacity-60"
                    >
                      {!canRecommend ? '当前席位无推荐权限' : label}
                    </button>
                  ))}
                </div>
                {recommendation ? (
                  <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-[12px] leading-6 text-[#AEB7D1]">
                    当前推荐：{recommendation.reviewerName} · {recommendation.reason}
                  </div>
                ) : null}
              </GlassPanel>
            );
          })}

          {status === 'ready' && pending.length === 0 ? (
            <GlassPanel tone="elevated" padding="lg">
              <p className="text-[12px] text-[#AEB7D1]">当前推荐池为空，说明这一轮高分投稿已经基本完成分流。</p>
            </GlassPanel>
          ) : null}
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

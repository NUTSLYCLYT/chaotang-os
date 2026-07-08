'use client';

/**
 * 礼部 · 底部 BottomDock — 上下文感知版
 *
 * 模仿户部 HubuBottomDock 模式：
 *   - 无选中战役 → 显示品牌总览 + 通用 prompts
 *   - 有选中战役 → 显示战役上下文 + 针对性 prompts
 *
 * 所有上下文数据根据 selectedCampaign 动态生成。
 */

import { useEffect, useState } from 'react';
import { withBasePath } from '@/lib/base-path';
import { BottomDock } from '@/features/shared/components/bottom-dock';
import { useAgentChat } from '@/features/swarm/lib/use-agent-chat';
import type { RitesCampaign, RitesOverview } from '@/lib/contracts/libu-rites';
import {
  LIBU_AUTO_DISPATCH_PROMPT,
  LIBU_RESIDENT_SKILLS,
  LIBU_RESIDENT_SKILL_GROUP_LABELS,
} from '../lib/resident-skills';

const LIBU_ACCENT = '#6fd0d8';

/** 动态 Quick Prompts */
function buildQuickPromptItems(campaign: RitesCampaign | null): { label: string; prompt: string }[] {
  if (!campaign) {
    return [
      { label: '礼部总调度', prompt: LIBU_AUTO_DISPATCH_PROMPT },
      {
        label: '建设六部',
        prompt: '礼部建设六部：请按户部、兵部、工部、刑部、吏部、锦衣卫分别输出对外口径、企业文化表达、宣传素材、发布门禁和需要其他部门先补的证据。',
      },
      {
        label: '审美确认',
        prompt: '礼部审美设计确认：请按品牌一致、视觉层级、发布质感、交互可用四项门禁审查当前页面/素材/视频/文案，输出可发布、需修改、禁止发布三档结论和具体修改清单。',
      },
      ...LIBU_RESIDENT_SKILLS.map((skill) => ({
        label: skill.quickLabel,
        prompt: skill.readyPrompt,
      })),
      { label: '品牌健康', prompt: '当前品牌健康度趋势如何？哪项指标最该关注？' },
      { label: '下周战役', prompt: '下周该推哪个传播战役？给数据依据。' },
      { label: '竞品反制', prompt: '竞品近期动作是否需要反制？怎么反制？' },
      { label: '舆情处置', prompt: '舆情风险里哪个最该优先处置？为什么？' },
      { label: '海外回应', prompt: '海外评论区集中质疑该怎么回应？' },
      { label: '投放预判', prompt: '新品发布双渠道投放效果预判如何？' },
    ];
  }

  return [
    {
      label: '礼部总调度',
      prompt: `礼部总调度：围绕「${campaign.title}」，自动判断该调用视觉、视频、页面重构、UI 审查或 VaM 角色技能，并输出执行顺序、产物清单和风险边界。`,
    },
    {
      label: '依赖优先级',
      prompt: `「${campaign.title}」当前${campaign.dependencies.length > 0 ? `被 ${campaign.dependencies.length} 项阻塞` : '无阻塞'}，该优先推动哪个依赖？`,
    },
    { label: '声量预期', prompt: `「${campaign.title}」在 ${campaign.channel} 渠道的预期声量能达到多少？` },
    { label: '排期复核', prompt: `「${campaign.title}」的排期 ${campaign.startDate} 是否合理？需要调整吗？` },
    { label: '延期影响', prompt: `若「${campaign.title}」延期，对品牌健康影响多大？` },
    { label: '素材包', prompt: `把「${campaign.title}」交工部执行前，礼部还需准备什么素材？` },
    {
      label: '审美确认',
      prompt: `礼部审美设计确认：请审查「${campaign.title}」的品牌一致、视觉层级、发布质感、交互可用四项门禁，输出可发布、需修改、禁止发布三档结论和具体修改清单。`,
    },
  ];
}

/** 动态 Badges */
function buildBadges(campaign: RitesCampaign | null, overview: RitesOverview | null) {
  const base: { label: string; value: string }[] = [];
  if (overview?.brandHealth) {
    base.push(
      { label: '健康', value: `${overview.brandHealth.brandHealth}%` },
      { label: '声量', value: `${overview.brandHealth.weeklyVolume}万` },
      { label: '舆情', value: `${overview.brandHealth.sentimentRisk}条` },
    );
  }
  if (campaign) {
    base.push(
      { label: '选中', value: campaign.channel },
      { label: '状态', value: campaign.status },
    );
  }
  return base;
}

/** 动态 Focus Panel */
type IntelItem = { topic: string; channel: string; signal: string };

function buildFocusPanel(
  campaign: RitesCampaign | null,
  overview: RitesOverview | null,
  intel?: IntelItem[] | null,
) {
  if (!overview) return null;

  return (
    <div className="space-y-3">
      {campaign ? (
        <>
          {/* 选中战役上下文 */}
          <div>
            <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: LIBU_ACCENT }}>
              决策上下文 · Decision Context
            </div>
            <p className="mt-2 text-[12px] leading-6 text-[#F5E9C9]">
              {campaign.tone === 'red'
                ? '⚠️ 该战役存在高风险因素，建议先解决阻塞依赖再推进发布。'
                : campaign.dependencies.length > 0
                  ? `📋 该战役有 ${campaign.dependencies.length} 项阻塞依赖，建议优先推动解决。`
                  : campaign.status === 'in_progress'
                    ? '✅ 战役进行中，各项指标正常。可按计划推进。'
                    : '📋 该战役可按常规流程推进。'}
            </p>
          </div>

          {/* 依赖 */}
          {campaign.dependencies.length > 0 && (
            <div>
              <div className="mb-1.5 text-[9px] uppercase tracking-[0.2em]" style={{ color: '#FB923C' }}>
                阻塞依赖
              </div>
              <div className="space-y-1">
                {campaign.dependencies.map((dep, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-md border border-white/8 bg-white/[0.02] px-2.5 py-1.5"
                  >
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: '#FB923C' }} />
                    <span className="text-[11px] leading-5 text-[#C6BB9D]">{dep}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 同级状态对比 */}
          {(() => {
            const peers = overview.campaigns
              .filter((c) => c.status === campaign.status && c.id !== campaign.id)
              .slice(0, 3);
            return peers.length > 0 ? (
              <div>
                <div className="mb-1.5 text-[9px] uppercase tracking-[0.2em]" style={{ color: '#6BA0FF' }}>
                  同级战役对比
                </div>
                <div className="space-y-1">
                  {peers.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-md border border-white/8 bg-white/[0.02] px-2.5 py-1.5"
                    >
                      <span className="truncate text-[11px] text-[#C6BB9D]">{p.title}</span>
                      <span className="ml-2 shrink-0 font-mono text-[10px]" style={{ color: LIBU_ACCENT }}>
                        {p.channel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}

          {/* 战役上下文仍保留礼部工房入口 */}
          <div>
            <div className="mb-1.5 text-[9px] uppercase tracking-[0.2em]" style={{ color: LIBU_ACCENT }}>
              礼部工房 · Skill Dispatch
            </div>
            <div className="grid gap-1.5 md:grid-cols-3">
              {LIBU_RESIDENT_SKILLS.slice(1, 4).map((skill) => (
                <div
                  key={skill.id}
                  className="rounded-md border border-white/8 bg-white/[0.02] px-2.5 py-1.5"
                >
                  <div className="truncate text-[11px] font-semibold text-[#F5E9C9]">{skill.quickLabel}</div>
                  <div className="mt-0.5 truncate text-[10px] text-[#9AA3C4]">{skill.output}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* 无选中时 — 品牌总览 */}
          <div>
            <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: LIBU_ACCENT }}>
              品牌总览 · Brand Overview
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-[20px] font-semibold text-[#F5E9C9]">
                {overview.brandHealth.brandHealth}%
              </div>
              <span
                className="rounded-full border px-2 py-0.5 text-[10px]"
                style={{
                  borderColor: `${LIBU_ACCENT}66`,
                  color: LIBU_ACCENT,
                  background: `${LIBU_ACCENT}10`,
                }}
              >
                品牌健康度
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '本周声量', value: `${overview.brandHealth.weeklyVolume} 万`, color: '#3DD68C' },
              { label: '线索转化', value: `${overview.brandHealth.leadConversion} 家`, color: '#6BA0FF' },
              { label: '内容命中', value: `${overview.brandHealth.contentHitRate}%`, color: LIBU_ACCENT },
              { label: '舆情风险', value: `${overview.brandHealth.sentimentRisk} 条`, color: '#F43F5E' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border p-2.5"
                style={{
                  borderColor: `${item.color}33`,
                  background: `linear-gradient(160deg, ${item.color}0a, rgba(0,0,0,0.3))`,
                }}
              >
                <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: item.color }}>
                  {item.label}
                </div>
                <div className="mt-1 font-mono text-[14px] font-semibold text-[#F5E9C9]">
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* 判词 */}
          {overview.brandHealth.recommendation && (
            <div
              className="rounded-lg border px-3 py-2 text-[11px] leading-5"
              style={{
                borderColor: `${LIBU_ACCENT}33`,
                background: `${LIBU_ACCENT}08`,
                color: '#C6BB9D',
              }}
            >
              <span className="mr-1 text-[9px] uppercase tracking-[0.18em]" style={{ color: LIBU_ACCENT }}>
                建议：
              </span>
              {overview.brandHealth.recommendation}
            </div>
          )}

          {/* 常驻技能池 */}
          <div>
            <div className="mb-1.5 text-[9px] uppercase tracking-[0.2em]" style={{ color: LIBU_ACCENT }}>
              常驻技能池 · Ready Skills
            </div>
            <div className="grid gap-1.5 md:grid-cols-2">
              {LIBU_RESIDENT_SKILLS.map((skill) => (
                <div
                  key={skill.id}
                  className="rounded-md border border-white/8 bg-white/[0.025] px-2.5 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-semibold text-[#F5E9C9]">
                      {skill.label}
                    </span>
                    <span className="shrink-0 font-mono text-[9px]" style={{ color: LIBU_ACCENT }}>
                      {LIBU_RESIDENT_SKILL_GROUP_LABELS[skill.group]}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#9AA3C4]">
                    {skill.useWhen}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 舆情监测:锦衣卫真采集(firecrawl 民用公开提及),无则诚实待接,绝不样例冒充 */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em]" style={{ color: '#8A8470' }}>
              舆情监测
              <span className="rounded border px-1 py-0.5 font-mono text-[8px]" style={{ borderColor: `${LIBU_ACCENT}44`, color: LIBU_ACCENT }}>
                {intel && intel.length ? '锦衣卫·真采集' : '待接'}
              </span>
            </div>
            {intel && intel.length ? (
              <div className="space-y-1">
                {intel.slice(0, 3).map((it) => (
                  <div key={it.topic} className="flex items-center justify-between rounded-md border border-white/8 bg-white/[0.025] px-2.5 py-1.5">
                    <span className="truncate text-[11px] text-[#D6CCB0]">{it.topic}</span>
                    <span className="ml-2 shrink-0 font-mono text-[10px] text-[#9AA3C4]">{it.channel}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-white/8 bg-white/[0.025] px-2.5 py-2 text-[10.5px] leading-4 text-[#9AA3C4]">
                真舆情源（锦衣卫采集）接入后显示，暂不以样例数据冒充。
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** 动态 Greeting */
function buildGreeting(campaign: RitesCampaign | null): string {
  if (campaign) {
    return `臣礼部尚书接旨。已加载战役「${campaign.title}」（${campaign.channel} / ${campaign.status}），请陛下示下传播取舍——臣必附数据依据与冲突声明。`;
  }
  return '臣礼部尚书恭请陛下示下。品牌声量/传播战役/舆情态势已核账，可询发布取舍——臣必附数据依据与冲突声明。';
}

/** 动态 Teaser */
function buildTeaser(campaign: RitesCampaign | null): string | undefined {
  if (!campaign) return undefined;
  return `焦点：${campaign.title} · ${campaign.channel} · ${campaign.status}`;
}

/* ═══════════ Avatar ═══════════ */

function LibuAvatar() {
  return (
    <svg viewBox="0 0 36 36" width={28} height={28} fill="none" aria-hidden>
      <circle cx={18} cy={12} r={7} fill="#6fd0d8" opacity={0.85} />
      <path d="M6 34c0-7 5-11 12-11s12 4 12 11" stroke="#6fd0d8" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.7} />
      <path d="M12 7 C12 2, 24 2, 24 7" stroke="#50a8b0" strokeWidth={1.5} fill="none" opacity={0.6} />
    </svg>
  );
}

/* ═══════════ 组件 ═══════════ */

interface LibuBottomDockProps {
  overview: RitesOverview | null;
  selectedCampaign: RitesCampaign | null;
}

export function LibuBottomDock({ overview, selectedCampaign }: LibuBottomDockProps) {
  const { messages, handleSend } = useAgentChat({
    endpoint: '/api/court/dept/market/ask', // 礼部=market(本提交新注册单 agent)；原 /libu/ask 不存在→404 装死，已修
    greeting: buildGreeting(selectedCampaign),
    accent: LIBU_ACCENT,
  });

  // 锦衣卫真采集舆情(firecrawl 民用公开提及);失败/空 → buildFocusPanel 诚实待接。
  const [intel, setIntel] = useState<IntelItem[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(withBasePath('/api/court/jinyiwei/intel'), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => { if (alive && Array.isArray(b?.data?.items)) setIntel(b.data.items); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const quickPromptItems = buildQuickPromptItems(selectedCampaign);
  const badges = buildBadges(selectedCampaign, overview);
  const focusPanel = buildFocusPanel(selectedCampaign, overview, intel);
  const teaser = buildTeaser(selectedCampaign);

  return (
    <BottomDock
      title="Ministry of Rites · 礼部"
      name={selectedCampaign ? `传播台 · ${selectedCampaign.title.slice(0, 12)}` : '礼部尚书 · 传播台'}
      accent={LIBU_ACCENT}
      avatar={<LibuAvatar />}
      quickPrompts={quickPromptItems.map((item) => item.prompt)}
      quickPromptItems={quickPromptItems}
      messages={messages}
      placeholder={
        selectedCampaign
          ? `就「${selectedCampaign.title}」下旨...`
          : '说一个目标，礼部自动分派技能...'
      }
      sendLabel="下旨"
      onSend={handleSend}
      badges={badges}
      focusPanel={focusPanel}
      collapsedTeaser={teaser}
    />
  );
}

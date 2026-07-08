/**
 * 观天台 · 群策 六域预测
 *
 * 政治 / 军事 / 经济 / 商业 / 行业景气 / 流行趋势
 * 来源：锦衣卫信号 + 各部门数据汇总 + 钦天监建模
 */

'use client';

import {
  Crown,
  Swords,
  Coins,
  ShoppingBag,
  Factory,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  Radar,
  BadgeCheck,
  Target,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';

type Trend = 'up' | 'down' | 'flat';

interface DomainScenario {
  label: string;
  probability: number;
  tone: 'optimistic' | 'base' | 'pessimistic';
}

interface DomainSignal {
  source: string;
  text: string;
}

interface DomainCard {
  id: string;
  icon: LucideIcon;
  color: string;
  nameCn: string;
  nameEn: string;
  index: number;
  indexLabel: string;
  trend: Trend;
  trendDelta: string;
  confidence: number;
  summary: string;
  signals: DomainSignal[];
  scenarios: DomainScenario[];
  advice: string;
}

const DOMAINS: DomainCard[] = [
  {
    id: 'politics',
    icon: Crown,
    color: '#F43F5E',
    nameCn: '政治',
    nameEn: 'Politics',
    index: 62,
    indexLabel: '博弈指数',
    trend: 'up',
    trendDelta: '+4.3',
    confidence: 71,
    summary: '美选周期过半 · 地缘紧张边际 · 中期财政刺激概率上升',
    signals: [
      { source: '锦衣卫', text: '两党支持率差缩至 1.8 pp · 2 周内' },
      { source: '礼部', text: '主流媒体议程切换至"稳就业 + 关税"' },
      { source: '兵部', text: '亚太舰队部署微调 · 能源走廊监控加强' },
    ],
    scenarios: [
      { label: '刺激先行', probability: 0.46, tone: 'optimistic' },
      { label: '僵持延续', probability: 0.38, tone: 'base' },
      { label: '外溢升级', probability: 0.16, tone: 'pessimistic' },
    ],
    advice: '对内务实 · 对外低调观察 · 财政端留余地',
  },
  {
    id: 'military',
    icon: Swords,
    color: '#F0C66A',
    nameCn: '军事',
    nameEn: 'Military',
    index: 58,
    indexLabel: '战略张力',
    trend: 'up',
    trendDelta: '+6.1',
    confidence: 65,
    summary: '局部热点风险抬头 · 军贸订单反弹 · 供应链武器化趋势',
    signals: [
      { source: '锦衣卫', text: '红海航运保险费率上调 17%' },
      { source: '远洋台', text: '关键芯片出口管制扩范围' },
      { source: '工部', text: '国防科技项目招标量同比 +22%' },
    ],
    scenarios: [
      { label: '对峙可控', probability: 0.55, tone: 'base' },
      { label: '冲突缓解', probability: 0.22, tone: 'optimistic' },
      { label: '局部升级', probability: 0.23, tone: 'pessimistic' },
    ],
    advice: '供应链双源 · 关键物料 90 日战备 · 地缘标的对冲',
  },
  {
    id: 'economy',
    icon: Coins,
    color: '#3DD68C',
    nameCn: '经济',
    nameEn: 'Economy',
    index: 53,
    indexLabel: '宏观景气',
    trend: 'flat',
    trendDelta: '±0.4',
    confidence: 69,
    summary: 'CPI 温和 · 就业稳健 · 实际利率仍高 · Q3 有降息窗口',
    signals: [
      { source: '度支台', text: '核心 PCE 环比 0.22%，低于预期' },
      { source: '锦衣卫', text: 'Fed 点阵图中位数下调一档' },
      { source: '户部', text: '企业利润率连续 3 个季度环比正' },
    ],
    scenarios: [
      { label: '软着陆延续', probability: 0.52, tone: 'base' },
      { label: '二次通胀', probability: 0.20, tone: 'pessimistic' },
      { label: '加速宽松', probability: 0.28, tone: 'optimistic' },
    ],
    advice: '久期适度拉长 · 成长风格权重抬升 · 防御保有 30%',
  },
  {
    id: 'commerce',
    icon: ShoppingBag,
    color: '#FB923C',
    nameCn: '商业',
    nameEn: 'Commerce',
    index: 67,
    indexLabel: '商业活跃',
    trend: 'up',
    trendDelta: '+3.8',
    confidence: 72,
    summary: '消费分层加剧 · 奢侈与极致性价比双飞 · 中位品牌承压',
    signals: [
      { source: '外交台', text: '高端线 GMV 同比 +19%' },
      { source: '远洋台', text: '跨境 B2C 平台流量再创新高' },
      { source: '礼部', text: '品牌代言人事件两起 · 舆情快速平复' },
    ],
    scenarios: [
      { label: '分层继续', probability: 0.58, tone: 'base' },
      { label: '消费回补', probability: 0.26, tone: 'optimistic' },
      { label: '预算收紧', probability: 0.16, tone: 'pessimistic' },
    ],
    advice: '高端加码体验 · 大众抓极致性价比 · 避中腰',
  },
  {
    id: 'industry',
    icon: Factory,
    color: '#6BA0FF',
    nameCn: '行业景气',
    nameEn: 'Industry',
    index: 60,
    indexLabel: '制造扩张',
    trend: 'up',
    trendDelta: '+2.9',
    confidence: 64,
    summary: '先进制造回暖 · 新能源放缓 · 半导体高景气持续',
    signals: [
      { source: '工部', text: '新订单指数上行至 52.4（扩张区间）' },
      { source: '度支台', text: '制造业 Capex 同比 +11%' },
      { source: '锦衣卫', text: '全球芯片库存周期进入再建补阶段' },
    ],
    scenarios: [
      { label: '温和复苏', probability: 0.5, tone: 'base' },
      { label: '强势回升', probability: 0.28, tone: 'optimistic' },
      { label: '短期回落', probability: 0.22, tone: 'pessimistic' },
    ],
    advice: '先进制造与半导体加仓 · 新能源局部择优 · 传统建材观望',
  },
  {
    id: 'trend',
    icon: Sparkles,
    color: '#F472B6',
    nameCn: '流行趋势',
    nameEn: 'Culture · Trend',
    index: 71,
    indexLabel: '趋势热度',
    trend: 'up',
    trendDelta: '+7.2',
    confidence: 68,
    summary: 'AI 伴侣 · 脑机可穿戴 · 银发数字化 · 三条曲线同时起势',
    signals: [
      { source: '礼部', text: 'UGC 提及量环比 +45%（AI 伴侣）' },
      { source: '外交台', text: 'Z 世代消费偏好调研 · 情感陪伴占 38%' },
      { source: '锦衣卫', text: '脑机可穿戴 App 下载量 MoM +62%' },
    ],
    scenarios: [
      { label: '主线成形', probability: 0.48, tone: 'optimistic' },
      { label: '热度回落', probability: 0.22, tone: 'pessimistic' },
      { label: '分支裂变', probability: 0.30, tone: 'base' },
    ],
    advice: '先占内容心智 · 产品研发跟进 · 合规提前介入',
  },
];

const TONE_COLOR: Record<DomainScenario['tone'], string> = {
  optimistic: '#3DD68C',
  base: '#F0C66A',
  pessimistic: '#F43F5E',
};

export function ForecastDomainsBoard() {
  return (
    <div className="space-y-5">
      <GlassPanel variant="gold" tone="elevated" padding="md">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(240,198,106,0.28), rgba(183,148,244,0.08))',
              border: '1px solid rgba(240,198,106,0.5)',
            }}
          >
            <Radar size={17} className="text-[#F0C66A]" />
          </div>
          <div>
            <div className="page-eyebrow">Multi-Domain Forecast · 群策六域</div>
            <h2 className="mt-1 text-[20px] font-semibold text-[#F5E9C9]">
              政 · 军 · 经 · 商 · 业 · 趋 —— 钦天监合议
            </h2>
            <div className="mt-1 text-[11px] text-[#9AA3C4]">
              源：锦衣卫信号 · 各部门数据 · 钦天监建模 · 每 4 时辰复验一次
            </div>
          </div>
        </div>
      </GlassPanel>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {DOMAINS.map((d) => (
          <DomainCardView key={d.id} card={d} />
        ))}
      </div>
    </div>
  );
}

/* ========================================================================== */

function DomainCardView({ card: c }: { card: DomainCard }) {
  const Icon = c.icon;
  const TrendIcon = c.trend === 'up' ? TrendingUp : c.trend === 'down' ? TrendingDown : Minus;
  const trendColor = c.trend === 'up' ? '#3DD68C' : c.trend === 'down' ? '#F43F5E' : '#F0C66A';

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-5"
      style={{
        borderColor: `${c.color}40`,
        background: `linear-gradient(160deg, ${c.color}12, rgba(20,22,30,0.72))`,
        boxShadow: `0 6px 24px ${c.color}1a`,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 opacity-20"
      >
        <Icon size={140} style={{ color: c.color }} strokeWidth={0.7} />
      </div>

      {/* Header */}
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${c.color}33, ${c.color}0a)`,
              border: `1px solid ${c.color}66`,
              boxShadow: `inset 0 1px 0 ${c.color}40`,
            }}
          >
            <Icon size={17} style={{ color: c.color }} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: c.color }}>
              {c.nameEn}
            </div>
            <div className="text-[17px] font-semibold text-[#F5E9C9]">{c.nameCn}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#6A7299]">
            {c.indexLabel}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-[26px] font-bold" style={{ color: c.color }}>
              {c.index}
            </span>
            <span className="text-[10px]" style={{ color: trendColor }}>
              <TrendIcon size={10} className="inline" /> {c.trendDelta}
            </span>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="relative mt-3 rounded-xl border border-white/8 bg-black/25 px-3 py-2 text-[12px] leading-6 text-[#D6CCB0]">
        {c.summary}
      </div>

      {/* Signals */}
      <div className="relative mt-3">
        <div className="text-[9px] uppercase tracking-[0.22em] text-[#8F835F]">
          Signals · 信号源
        </div>
        <ul className="mt-1.5 space-y-1">
          {c.signals.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-[11px] leading-6 text-[#C8CDD8]">
              <span
                className="mt-[5px] inline-block h-1 w-1 shrink-0 rounded-full"
                style={{ background: c.color }}
              />
              <span className="text-[9px] uppercase tracking-[0.18em]" style={{ color: `${c.color}` }}>
                {s.source}
              </span>
              <span className="min-w-0 flex-1">{s.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Scenarios */}
      <div className="relative mt-3">
        <div className="text-[9px] uppercase tracking-[0.22em] text-[#8F835F]">
          Scenarios · 三策概率
        </div>
        <div className="mt-1.5 space-y-1">
          {c.scenarios.map((s, i) => {
            const tc = TONE_COLOR[s.tone];
            const pct = Math.round(s.probability * 100);
            return (
              <div key={i}>
                <div className="flex items-center justify-between text-[10px]">
                  <span style={{ color: tc }}>{s.label}</span>
                  <span className="font-mono" style={{ color: tc }}>
                    {pct}%
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${tc}, ${tc}88)`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Advice */}
      <div
        className="relative mt-3 flex items-start gap-2 rounded-xl border px-3 py-2"
        style={{
          borderColor: `${c.color}55`,
          background: `${c.color}0c`,
        }}
      >
        <Target size={12} className="mt-0.5 shrink-0" style={{ color: c.color }} />
        <div className="flex-1 text-[11px] leading-6" style={{ color: '#F5E9C9' }}>
          <span className="text-[9px] uppercase tracking-[0.18em]" style={{ color: c.color }}>
            当前建议 ·{' '}
          </span>
          {c.advice}
        </div>
      </div>

      {/* Footer */}
      <div className="relative mt-3 flex items-center justify-between border-t border-white/8 pt-3 text-[10px]">
        <span className="flex items-center gap-1 text-[#9AA3C4]">
          <BadgeCheck size={10} style={{ color: c.color }} />
          置信 {c.confidence}%
        </span>
        <button
          type="button"
          className="flex items-center gap-1 rounded-full border px-2.5 py-1 transition hover:brightness-110"
          style={{
            borderColor: `${c.color}55`,
            background: `${c.color}14`,
            color: c.color,
          }}
        >
          深究
          <ArrowUpRight size={10} />
        </button>
      </div>
    </div>
  );
}

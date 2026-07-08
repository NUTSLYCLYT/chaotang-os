/**
 * 观天台 · 首页 Hub
 *
 * 顶部：ObservatoryScene（山巅观星台夜景）
 * 下：6 主题钩子卡（群策 / 玄机 / 星象 / 天气 / 沙盘 / 史鉴）
 */

'use client';

import {
  Radar,
  Sparkles,
  Telescope,
  Cloud,
  TrendingUp,
  History,
  ArrowRight,
  Crown,
  Swords,
  Coins,
  ShoppingBag,
  Factory,
  Compass,
  Hexagon,
  CircleDot,
  Star,
  Moon,
  Sun as SunIcon,
  BadgeCheck,
  MapPin,
  Thermometer,
  AlertTriangle,
  Target,
  Mountain,
  Wind,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { colors } from '@/config/design-tokens';
import type { ForecastScenario, ScenarioName } from '@/types/forecast';
import { ObservatoryScene } from './observatory-scene';

const GOLD = colors.goldBright;
const PURPLE = colors.gold;

const SCENARIO_LABEL: Record<ScenarioName, string> = {
  optimistic: '上策',
  base: '中策',
  pessimistic: '下策',
};

interface HookChip {
  icon: LucideIcon;
  label: string;
  tint: string;
}

export type ForecastHubId = 'domains' | 'classical' | 'astronomy' | 'weather' | 'scenarios' | 'history';

interface HubTheme {
  id: ForecastHubId;
  accent: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  oneLiner: string;
  headline: string;
  headlineMeta?: string;
  hooks: HookChip[];
  cta: string;
  decor?: LucideIcon;
}

function buildThemes(scenarios: ForecastScenario[]): HubTheme[] {
  const top = [...scenarios].sort((a, b) => b.probability - a.probability)[0];
  const topLabel = top ? SCENARIO_LABEL[top.name] : '中策';

  return [
    {
      id: 'domains',
      accent: GOLD,
      icon: Radar,
      title: '群策',
      subtitle: 'Multi-Domain Forecast',
      oneLiner: '政 / 军 / 经 / 商 / 业 / 趋 · 六域同场推演',
      headline: '6 域景气指数 · 置信 64-72%',
      headlineMeta: '源：锦衣卫 + 各部门 · 每 4 时辰复验',
      hooks: [
        { icon: Crown, label: '政 62 ↑', tint: colors.danger },
        { icon: Swords, label: '军 58 ↑', tint: GOLD },
        { icon: Coins, label: '经 53 ~', tint: colors.success },
        { icon: ShoppingBag, label: '商 67 ↑', tint: colors.warning },
        { icon: Factory, label: '业 60 ↑', tint: colors.blueBright },
        { icon: Sparkles, label: '趋 71 ↑', tint: PURPLE },
      ],
      cta: '观六域',
      decor: Radar,
    },
    {
      id: 'classical',
      accent: PURPLE,
      icon: Sparkles,
      title: '玄机',
      subtitle: 'Classical Arts',
      oneLiner: '周易 · 奇门遁甲 · 六壬 —— 古典推演三式',
      headline: '今日本卦水火既济 · 九宫见天芮',
      headlineMeta: '六壬青龙贵人并临 · 谋利可成',
      hooks: [
        { icon: Hexagon,   label: '周易 既济→未济', tint: GOLD },
        { icon: Compass,   label: '奇门 天辅 · 东南', tint: PURPLE },
        { icon: CircleDot, label: '六壬 青龙乘巳', tint: colors.blueBright },
      ],
      cta: '推玄机',
      decor: Sparkles,
    },
    {
      id: 'astronomy',
      accent: PURPLE,
      icon: Telescope,
      title: '星象',
      subtitle: 'Astronomy',
      oneLiner: '天象盘 · 黄道十二宫 · 今夜可观天象',
      headline: `紫微稳 · ${topLabel}概率最高 · 月盘 86%`,
      headlineMeta: '水星西大距 · 木土相合 · 宝瓶座流星雨',
      hooks: [
        { icon: Star, label: '28 宿', tint: colors.text },
        { icon: SunIcon,label: '黄道 12 宫', tint: GOLD },
        { icon: Moon, label: '今夜 4 象', tint: colors.text },
      ],
      cta: '赏星象',
      decor: Star,
    },
    {
      id: 'weather',
      accent: colors.blueBright,
      icon: Cloud,
      title: '天气',
      subtitle: 'Weather · 节气',
      oneLiner: '六城实时 · 24 节气 · 极端预警',
      headline: '清明节气 · 六城实时可查',
      headlineMeta: '预警 3 条：沙尘 · 暴雨 · 大风',
      hooks: [
        { icon: MapPin, label: '六城', tint: colors.blueBright },
        { icon: Thermometer,  label: '节气 清明', tint: GOLD },
        { icon: AlertTriangle, label: '预警 3', tint: colors.danger },
      ],
      cta: '察气象',
      decor: Cloud,
    },
    {
      id: 'scenarios',
      accent: GOLD,
      icon: TrendingUp,
      title: '沙盘',
      subtitle: 'Scenarios + What-If',
      oneLiner: '上中下三策 · 概率分布 · 沙盘推演 · 风口预备',
      headline: `${scenarios.length} 情景 · 三策概率可视化`,
      headlineMeta: '三条旋钮实时重算 · 风口 + 预备 + 证据',
      hooks: [
        { icon: TrendingUp, label: '上策', tint: colors.success },
        { icon: TrendingUp, label: '中策', tint: GOLD },
        { icon: TrendingUp, label: '下策', tint: colors.danger },
        { icon: Target, label: '预备', tint: colors.success },
        { icon: Wind, label: '风口', tint: colors.danger },
      ],
      cta: '入沙盘',
      decor: Mountain,
    },
    {
      id: 'history',
      accent: GOLD,
      icon: History,
      title: '史鉴',
      subtitle: 'Historical Mirror',
      oneLiner: '历史相似时局走势 · 谨防重蹈覆辙',
      headline: '3 组高相似已比对',
      headlineMeta: '最相似：2018 Q4 紧缩周期',
      hooks: [
        { icon: History,    label: '近 10 年', tint: GOLD },
        { icon: BadgeCheck, label: '相似 ≥ 78%', tint: PURPLE },
      ],
      cta: '照史鉴',
      decor: History,
    },
  ];
}

export interface ForecastHubBoardProps {
  scenarios: ForecastScenario[];
  onJump: (id: ForecastHubId) => void;
}

export function ForecastHubBoard({ scenarios, onJump }: ForecastHubBoardProps) {
  const themes = buildThemes(scenarios);
  const top = [...scenarios].sort((a, b) => b.probability - a.probability)[0];
  const confidence = top ? Math.round(top.confidence * 100) : 67;

  return (
    <div className="space-y-5">
      {/* 首图 · 观星台场景 */}
      <ObservatoryScene
        briefing={
          top
            ? `紫微稳 · ${SCENARIO_LABEL[top.name]}「${top.label}」概率 ${Math.round(top.probability * 100)}% · 今夜宜推演`
            : '紫微稳定 · 三策尚在推演 · 今夜宜观'
        }
        confidence={confidence}
        activeDomains={6}
      />

      {/* 6 主题卡 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {themes.map((t) => (
          <HubCard key={t.id} theme={t} onClick={() => onJump(t.id)} />
        ))}
      </div>
    </div>
  );
}

/* ========================================================================== */

function HubCard({ theme: t, onClick }: { theme: HubTheme; onClick: () => void }) {
  const Icon = t.icon;
  const Decor = t.decor ?? Icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border text-left transition-all hover:-translate-y-0.5"
      style={{
        borderColor: `${t.accent}33`,
        background: `linear-gradient(160deg, ${t.accent}14, rgba(20,22,30,0.72))`,
        boxShadow: `0 4px 24px ${t.accent}14`,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 opacity-20 transition-opacity group-hover:opacity-35"
      >
        <Decor size={120} style={{ color: t.accent }} strokeWidth={0.8} />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(circle at 20% 0%, ${t.accent}16, transparent 55%)` }}
      />
      <div className="relative p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                background: `linear-gradient(135deg, ${t.accent}33, ${t.accent}0a)`,
                border: `1px solid ${t.accent}66`,
                boxShadow: `inset 0 1px 0 ${t.accent}44`,
              }}
            >
              <Icon size={16} style={{ color: t.accent }} />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: t.accent }}>
                {t.subtitle}
              </div>
              <div className="text-[17px] font-semibold" style={{ color: colors.text }}>{t.title}</div>
            </div>
          </div>
          <ArrowRight
            size={14}
            className="transition-transform group-hover:translate-x-0.5"
            style={{ color: t.accent }}
          />
        </div>

        <div className="mt-3 text-[11px]" style={{ color: colors.textDim }}>{t.oneLiner}</div>

        <div
          className="mt-3 rounded-2xl border px-4 py-4"
          style={{ borderColor: `${t.accent}44`, background: `${t.accent}0a` }}
        >
          <div
            className="text-[24px] font-semibold leading-[1.15] md:text-[30px]"
            style={{ color: colors.text }}
          >
            {t.headline}
          </div>
          {t.headlineMeta && (
            <div className="mt-2 text-[12px] font-medium tracking-[0.08em]" style={{ color: t.accent }}>
              {t.headlineMeta}
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {t.hooks.map((h) => {
            const HIcon = h.icon;
            return (
              <span
                key={h.label}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
                style={{
                  borderColor: `${h.tint}44`,
                  background: `${h.tint}12`,
                  color: h.tint,
                }}
              >
                <HIcon size={9} />
                {h.label}
              </span>
            );
          })}
        </div>

        <div
          className="mt-4 flex items-center justify-between border-t pt-3 text-[11px]"
          style={{ borderColor: `${t.accent}22` }}
        >
          <span className="uppercase tracking-[0.18em]" style={{ color: t.accent }}>
            Enter
          </span>
          <span className="font-semibold transition-colors group-hover:text-white" style={{ color: colors.text }}>
            {t.cta} →
          </span>
        </div>
      </div>
    </button>
  );
}

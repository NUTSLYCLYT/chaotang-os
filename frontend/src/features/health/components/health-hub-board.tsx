/**
 * 太医院 · 首页 Hub
 *
 * 主画面 = 太医问诊摘要 + 6 主题亮点钩子（卡片式）
 * 点任一卡片 → 切换对应 Tab
 */

'use client';

import {
  Heart,
  Sparkles,
  Newspaper,
  Users,
  Siren,
  ArrowRight,
  Activity,
  Moon,
  Brain,
  Calendar,
  MapPin,
  Stethoscope,
  Flame,
  Pill,
  Star,
  BadgeCheck,
  Eye,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { colors } from '@/config/design-tokens';

const HEALTH_ACCENT = colors.success;

interface HookChip {
  icon: LucideIcon;
  label: string;
  tint: string;
}

interface HubTheme {
  id: 'checkup' | 'daily' | 'intel' | 'resources' | 'emergency';
  accent: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  oneLiner: string;
  /** 主数据：今日最重要一项 */
  headline: string;
  headlineMeta?: string;
  /** 亮点胶囊：多条小信息 */
  hooks: HookChip[];
  /** 按钮文案 */
  cta: string;
  /** 装饰图标（背景大号） */
  decor?: LucideIcon;
}

const THEMES: HubTheme[] = [
  {
    id: 'checkup',
    accent: colors.success,
    icon: Heart,
    title: '体检',
    subtitle: 'Checkup',
    oneLiner: '看总分 · 脏腑 · 经络三视图，10 秒框定优先级',
    headline: '总分 78 · 风险：关注级',
    headlineMeta: '心肝肾稳定 · 肺脾关注',
    hooks: [
      { icon: Heart, label: '心 86 稳', tint: colors.success },
      { icon: Activity, label: '肺 74 关注', tint: colors.warning },
      { icon: Activity, label: '脾 71 关注', tint: colors.warning },
      { icon: Brain, label: '脏腑图 · 经络图 可查', tint: colors.gold },
    ],
    cta: '进入体检',
    decor: Heart,
  },
  {
    id: 'daily',
    accent: colors.gold,
    icon: Sparkles,
    title: '日常',
    subtitle: 'Daily Care',
    oneLiner: '睡眠/运动/饮食/情绪/皮肤/瑜伽/社群 · 一屏全览',
    headline: '连续打卡 12 天',
    headlineMeta: '今日任务 3/4 完成',
    hooks: [
      { icon: Moon, label: '昨夜 7h12m', tint: colors.blueBright },
      { icon: Activity, label: '今日 8,420 步', tint: colors.goldBright },
      { icon: Pill, label: '用药 2/3', tint: colors.danger },
      { icon: Brain, label: '正念未打卡', tint: colors.warning },
    ],
    cta: '开始打卡',
    decor: Sparkles,
  },
  {
    id: 'intel',
    accent: colors.blueBright,
    icon: Newspaper,
    title: '医讯',
    subtitle: 'Medical Intel',
    oneLiner: 'AI 脑机接口 / 临床突破 / 政策 · 替你盯全球前沿',
    headline: 'Neuralink 二代突破 12 例',
    headlineMeta: '6 小时前 · Nature Neuroscience',
    hooks: [
      { icon: BadgeCheck, label: 'mRNA 心肌', tint: colors.danger },
      { icon: Eye, label: '眼底预测 CV', tint: colors.warning },
      { icon: Activity, label: 'GLP-1 新数据', tint: colors.warning },
      { icon: Brain, label: 'AI 医疗 +3', tint: colors.gold },
    ],
    cta: '看最新医讯',
    decor: Newspaper,
  },
  {
    id: 'resources',
    accent: colors.goldBright,
    icon: Users,
    title: '资源',
    subtitle: 'Experts · Hospitals',
    oneLiner: '院士专家 · 周边医院 · 关注疾病 · 一键挂号',
    headline: '3 位院士可选 · 10 位专家在册',
    headlineMeta: '最近号源：今日 15:00',
    hooks: [
      { icon: Stethoscope, label: '心内 葛均波', tint: colors.danger },
      { icon: Stethoscope, label: '肝胆 吴孟超', tint: colors.warning },
      { icon: MapPin, label: '周边 2.3km 三甲', tint: colors.blueBright },
      { icon: BadgeCheck, label: '疾病百科 · 3 关注', tint: colors.gold },
    ],
    cta: '找医生',
    decor: Users,
  },
  {
    id: 'emergency',
    accent: colors.danger,
    icon: Siren,
    title: '急救',
    subtitle: 'Emergency + Insurance',
    oneLiner: '6 场景急救 · 120/119/110 速拨 · 医疗保险 · 其他服务',
    headline: '医保 + 商业 三层保障已备案',
    headlineMeta: '商业年度余额 ¥ 385,420',
    hooks: [
      { icon: Flame, label: '烫伤 30min', tint: colors.danger },
      { icon: Heart, label: 'CPR 4min', tint: colors.danger },
      { icon: ShieldCheck, label: '年保 400 万', tint: colors.goldBright },
      { icon: Calendar, label: '陪诊/上门检验', tint: colors.blueBright },
    ],
    cta: '查急救贴士',
    decor: Siren,
  },
];

export interface HealthHubBoardProps {
  onJump: (id: HubTheme['id']) => void;
}

export function HealthHubBoard({ onJump }: HealthHubBoardProps) {
  return (
    <div className="space-y-5">
      {/* 顶部条：太医一句开场 + 时间 */}
      <GlassPanel
        variant="gold"
        tone="elevated"
        padding="lg"
        className="relative overflow-hidden"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 0% 0%, rgba(52,211,153,0.14), transparent 55%), radial-gradient(circle at 100% 100%, rgba(240,198,106,0.12), transparent 55%)',
          }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(52,211,153,0.28), rgba(52,211,153,0.06))',
                border: '1px solid rgba(52,211,153,0.6)',
                boxShadow: '0 4px 24px rgba(52,211,153,0.28)',
              }}
            >
              <Stethoscope size={19} style={{ color: HEALTH_ACCENT }} />
            </div>
            <div>
              <div
                className="text-[11px] uppercase tracking-[0.22em]"
                style={{ color: HEALTH_ACCENT }}
              >
                Imperial Physician Brief · 今日脉案
              </div>
              <h2 className="mt-1 text-[20px] font-semibold" style={{ color: colors.text }}>
                心肝肾稳 · 肺脾关注 · 建议本周调理脾经 + 加一次呼吸训练
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px]" style={{ color: colors.textDim }}>
            <Clock size={12} />
            <span>更新于 刚刚</span>
            <span>·</span>
            <span>第 127 次脉案</span>
          </div>
        </div>
      </GlassPanel>

      {/* 6 主题卡 · 2x3 grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {THEMES.map((t) => (
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
        background: `linear-gradient(160deg, ${t.accent}12, rgba(20,22,30,0.7))`,
        boxShadow: `0 4px 24px ${t.accent}10`,
      }}
    >
      {/* Background decor */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 opacity-20 transition-opacity group-hover:opacity-35"
      >
        <Decor size={120} style={{ color: t.accent }} strokeWidth={0.8} />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 20% 0%, ${t.accent}14, transparent 55%)`,
        }}
      />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{
                background: `linear-gradient(135deg, ${t.accent}33, ${t.accent}0a)`,
                border: `1px solid ${t.accent}66`,
                boxShadow: `inset 0 1px 0 ${t.accent}44`,
              }}
            >
              <Icon size={15} style={{ color: t.accent }} />
            </div>
            <div>
              <div
                className="text-[11px] uppercase tracking-[0.22em]"
                style={{ color: t.accent }}
              >
                {t.subtitle}
              </div>
              <div className="text-[16px] font-semibold" style={{ color: colors.text }}>{t.title}</div>
            </div>
          </div>
          <ArrowRight
            size={14}
            className="transition-transform group-hover:translate-x-0.5"
            style={{ color: t.accent }}
          />
        </div>

        <div className="mt-3 text-[11px]" style={{ color: colors.textDim }}>{t.oneLiner}</div>

        {/* Headline */}
        <div
          className="mt-3 rounded-2xl border px-4 py-4"
          style={{
            borderColor: `${t.accent}44`,
            background: `${t.accent}08`,
          }}
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

        {/* Hook chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {t.hooks.map((h) => {
            const HIcon = h.icon;
            return (
              <span
                key={h.label}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
                style={{
                  borderColor: `${h.tint}44`,
                  background: `${h.tint}10`,
                  color: h.tint,
                }}
              >
                <HIcon size={9} />
                {h.label}
              </span>
            );
          })}
        </div>

        {/* CTA */}
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

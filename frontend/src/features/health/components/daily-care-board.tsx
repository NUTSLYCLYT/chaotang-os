/**
 * 太医院 · 日常管理
 *
 * 模块组：睡眠 / 运动 / 饮食 / 情绪 / 皮肤 / 内分泌 / 瑜伽冥想 / 社群
 * 顶部：一键体检 + 用药提醒 + 今日 Check-in
 */

'use client';

import {
  Moon,
  Footprints,
  UtensilsCrossed,
  Smile,
  Sparkles,
  Waves,
  Flower,
  Users,
  Pill,
  CheckCircle2,
  Calendar,
  Plus,
  ArrowRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';

const HEALTH_ACCENT = '#34D399';

interface CareModule {
  id: string;
  icon: LucideIcon;
  color: string;
  title: string;
  todayStatus: string;
  score?: number;
  streak?: number;
  bullets: string[];
  cta: string;
}

const CARE_MODULES: CareModule[] = [
  {
    id: 'sleep',
    icon: Moon,
    color: '#6BA0FF',
    title: '睡眠',
    todayStatus: '昨夜 7h 12m · 深睡占 22%',
    score: 78,
    streak: 5,
    bullets: [
      '就寝时间较前 7 日提前 18 分钟，节律稳定',
      '深睡比例略低于建议（>25%），考虑减少睡前屏幕暴露',
    ],
    cta: '查看睡眠曲线',
  },
  {
    id: 'exercise',
    icon: Footprints,
    color: '#F0C66A',
    title: '锻炼',
    todayStatus: '今日 8,420 步 · 中强度 28 分钟',
    score: 82,
    streak: 12,
    bullets: [
      '本周已达成 4 次有氧 + 2 次力量',
      '心肺区间停留 36%，建议加入 1 次间歇训练',
    ],
    cta: '排下周训练',
  },
  {
    id: 'diet',
    icon: UtensilsCrossed,
    color: '#FB923C',
    title: '饮食',
    todayStatus: '蛋白摄入 72g · 膳食纤维 18g',
    score: 69,
    bullets: [
      '蛋白略低于目标（目标 85g），晚餐可加一份鱼或豆制品',
      '精制糖连续 3 日偏高，建议用全谷物替换',
    ],
    cta: '记一餐',
  },
  {
    id: 'mood',
    icon: Smile,
    color: '#B794F4',
    title: '情绪',
    todayStatus: '今日自评：平稳偏积极',
    score: 75,
    bullets: [
      '本周焦虑度较上周下降 12%',
      '建议每天 5 分钟正念，已连续 3 日未打卡',
    ],
    cta: '开始 5 分钟正念',
  },
  {
    id: 'skin',
    icon: Sparkles,
    color: '#F5A524',
    title: '皮肤',
    todayStatus: '水分 48% · 油脂平衡',
    score: 73,
    bullets: [
      'T 区出油较前 7 日 +8%，建议调整清洁频率',
      'UV 指数 6，外出需防晒 SPF30+',
    ],
    cta: '记录今日肤感',
  },
  {
    id: 'endocrine',
    icon: Waves,
    color: '#34D399',
    title: '内分泌',
    todayStatus: '代谢节律稳定 · 经期预估还有 14 天',
    score: 80,
    bullets: [
      '基础代谢较上月 +2.3%，符合训练节奏',
      '建议补充镁 + B6，缓解经前紧张',
    ],
    cta: '查看周期日历',
  },
  {
    id: 'mindbody',
    icon: Flower,
    color: '#F472B6',
    title: '瑜伽 · 冥想 · 普拉提',
    todayStatus: '本周已练 3 次 · 累计 85 分钟',
    streak: 3,
    bullets: [
      '核心激活度较上周 +15%',
      '推荐今日：普拉提 20 分钟 · 中等强度',
    ],
    cta: '开启今日课程',
  },
  {
    id: 'community',
    icon: Users,
    color: '#60A5FA',
    title: '同好社群',
    todayStatus: '加入 3 个小组 · 2 条新消息',
    bullets: [
      '晨跑群有 2 人今日已打卡',
      '冥想小组今晚 21:00 线上共修',
    ],
    cta: '进入社群',
  },
];

export function DailyCareBoard() {
  return (
    <div className="space-y-5">
      {/* Quick actions · 一键体检 / 用药提醒 / Check-in */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <QuickAction
          icon={CheckCircle2}
          color={HEALTH_ACCENT}
          eyebrow="One-Tap Checkup · 一键体检"
          title="立即发起一次全套体检"
          body="10 分钟完成指标自评 + 生活习惯问卷，自动生成个性化干预建议。"
          cta="开始体检"
        />
        <QuickAction
          icon={Pill}
          color="#F0C66A"
          eyebrow="Medication · 用药提醒"
          title="今日 3 次服药，已完成 2 次"
          body="下一次：21:00 · 甲钴胺 0.5mg / 维生素 D3 1000IU"
          cta="管理提醒"
          progress={2 / 3}
        />
        <QuickAction
          icon={Calendar}
          color="#B794F4"
          eyebrow="Daily Check-in · 每日打卡"
          title="连续打卡 12 天"
          body="今日任务：饮水 · 睡眠 · 情绪 · 运动（已完成 3/4）"
          cta="补打一项"
          progress={3 / 4}
        />
      </div>

      {/* Care modules grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {CARE_MODULES.map((m) => (
          <CareCard key={m.id} module={m} />
        ))}
      </div>
    </div>
  );
}

/* ========================================================================== */

function QuickAction({
  icon: Icon,
  color,
  eyebrow,
  title,
  body,
  cta,
  progress,
}: {
  icon: LucideIcon;
  color: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  progress?: number;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4"
      style={{
        borderColor: `${color}44`,
        background: `linear-gradient(135deg, ${color}12, rgba(20,22,30,0.6))`,
        boxShadow: `0 4px 20px ${color}18`,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-40"
        style={{ background: `radial-gradient(circle, ${color}33, transparent 70%)` }}
      />
      <div className="relative flex items-start gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{
            background: `${color}22`,
            border: `1px solid ${color}66`,
          }}
        >
          <Icon size={17} style={{ color }} />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-[10px] uppercase tracking-[0.22em]"
            style={{ color }}
          >
            {eyebrow}
          </div>
          <div className="mt-1 text-[14px] font-semibold text-[#F5E9C9]">{title}</div>
          <div className="mt-1 text-[11px] leading-6 text-[#9AA3C4]">{body}</div>
          {progress !== undefined && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.round(progress * 100)}%`,
                  background: color,
                  boxShadow: `0 0 8px ${color}`,
                }}
              />
            </div>
          )}
          <button
            type="button"
            className="mt-3 flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] transition hover:brightness-110"
            style={{
              borderColor: `${color}66`,
              background: `${color}14`,
              color,
            }}
          >
            {cta}
            <ArrowRight size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */

function CareCard({ module: m }: { module: CareModule }) {
  const Icon = m.icon;
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] p-4 transition-all hover:border-white/15"
      style={{
        background: `linear-gradient(160deg, ${m.color}0a, transparent 80%)`,
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${m.color}28, ${m.color}08)`,
              border: `1px solid ${m.color}55`,
            }}
          >
            <Icon size={15} style={{ color: m.color }} />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-[#F5E9C9]">{m.title}</div>
            {m.streak !== undefined && (
              <div className="mt-0.5 text-[10px]" style={{ color: m.color }}>
                连续 {m.streak} 天
              </div>
            )}
          </div>
        </div>
        {m.score !== undefined && (
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-[0.2em] text-[#6A7299]">
              Score
            </div>
            <div
              className="font-mono text-[18px] font-bold"
              style={{ color: m.color }}
            >
              {m.score}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 text-[11px] text-[#9AA3C4]">{m.todayStatus}</div>

      <ul className="mt-3 space-y-1.5">
        {m.bullets.map((b) => (
          <li key={b} className="flex items-start gap-1.5 text-[11px] leading-5 text-[#C8CDD8]">
            <span
              className="mt-[7px] inline-block h-1 w-1 shrink-0 rounded-full"
              style={{ background: m.color }}
            />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="mt-3 flex w-full items-center justify-between rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-[11px] text-[#D6CCB0] transition hover:border-white/20 hover:bg-white/5"
      >
        <span>{m.cta}</span>
        <Plus size={12} style={{ color: m.color }} />
      </button>
    </div>
  );
}

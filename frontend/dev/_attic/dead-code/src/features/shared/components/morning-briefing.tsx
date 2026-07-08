/**
 * 朝堂 OS · 陛下晨朝简报 + Streak 徽章
 *
 * 每天第一次登朝（/overview）时，顶部展示一张"昨日实绩/今日待办/连朝天数"卡。
 * 第二次及以后不显示（但 Streak 徽章一直在）。
 *
 * Streak 逻辑（localStorage 驱动，Phase 2 换 Supabase）：
 *   - 连续日：每天至少一次登朝 → +1
 *   - 间断一天 → 重置为 1
 *   - 7 / 30 / 100 日里程碑触发特殊徽章
 *
 * 这是 Phase 2 粘度基建的第一块基石。
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Sunrise,
  Flame,
  Award,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  X,
  Share2,
} from 'lucide-react';
import type { Task } from '@/types/task';

const LAST_VISIT_KEY = 'courtos.streak.lastVisit';
const STREAK_KEY = 'courtos.streak.days';
const BRIEFING_SEEN_KEY = 'courtos.briefing.lastDate';
const YESTERDAY_SNAPSHOT_KEY = 'courtos.briefing.yesterdaySnapshot';

interface DailySnapshot {
  date: string;
  archivedTotal: number;
  criticalSignals: number;
  pendingReviews: number;
}

type Ruler = {
  streak: number;
  milestone: 'new' | 'day-7' | 'day-30' | 'day-100' | null;
};

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function yesterdayStamp() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function formatYesterdayChinese(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 维护 streak · 登场时调用一次 */
function advanceStreak(): Ruler {
  if (typeof window === 'undefined') return { streak: 0, milestone: null };
  const today = todayStamp();
  const yesterday = yesterdayStamp();
  const last = window.localStorage.getItem(LAST_VISIT_KEY);
  const prevStreak = Number.parseInt(
    window.localStorage.getItem(STREAK_KEY) ?? '0',
    10,
  );

  let nextStreak = prevStreak;
  if (!last) {
    nextStreak = 1;
  } else if (last === today) {
    nextStreak = prevStreak || 1;
  } else if (last === yesterday) {
    nextStreak = prevStreak + 1;
  } else {
    nextStreak = 1; // 间断重置
  }

  window.localStorage.setItem(LAST_VISIT_KEY, today);
  window.localStorage.setItem(STREAK_KEY, String(nextStreak));

  let milestone: Ruler['milestone'] = null;
  if (nextStreak === 1 && prevStreak === 0) milestone = 'new';
  else if (nextStreak === 7) milestone = 'day-7';
  else if (nextStreak === 30) milestone = 'day-30';
  else if (nextStreak === 100) milestone = 'day-100';

  return { streak: nextStreak, milestone };
}

/* ========================================================================== *
 *  常驻 Streak 徽章 · 右上角气泡
 * ========================================================================== */

export function StreakBadge() {
  const [ruler, setRuler] = useState<Ruler>({ streak: 0, milestone: null });

  useEffect(() => {
    setRuler(advanceStreak());
  }, []);

  if (ruler.streak <= 0) return null;

  const color =
    ruler.streak >= 100
      ? '#FFD36A'
      : ruler.streak >= 30
        ? '#F0C66A'
        : ruler.streak >= 7
          ? '#F5E9C9'
          : '#C8CDD8';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 350, damping: 24 }}
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em]"
      style={{
        background: `linear-gradient(135deg, ${color}18, rgba(10,7,4,0.6))`,
        borderColor: `${color}55`,
        color,
        boxShadow: `0 2px 12px ${color}22`,
      }}
      title={`连续登朝 ${ruler.streak} 日`}
    >
      <Flame size={11} className="animate-pulse" style={{ color }} />
      <span>连朝 {ruler.streak} 日</span>
      {ruler.streak >= 7 && <Award size={11} style={{ color }} />}
    </motion.div>
  );
}

/* ========================================================================== *
 *  陛下晨朝简报 · 顶部大卡
 * ========================================================================== */

export interface MorningBriefingProps {
  tasks: Task[];
  activeAgents: number;
  totalAgents: number;
  criticalSignals: number;
  pendingReviews: number;
  density?: 'default' | 'compact';
}

export function MorningBriefing({
  tasks,
  activeAgents,
  totalAgents,
  criticalSignals,
  pendingReviews,
  density = 'default',
}: MorningBriefingProps) {
  const [visible, setVisible] = useState(false);
  const [ruler, setRuler] = useState<Ruler>({ streak: 0, milestone: null });
  const [yesterdayMemo, setYesterdayMemo] = useState<DailySnapshot | null>(null);

  // 每次状态变化都写今日快照（无论是否已看简报），保证明日"昨日记忆"是最新值
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const archivedToday = tasks.filter(
        (t) => t.status === 'archived' || t.status === 'reviewed',
      ).length;
      const todaySnap: DailySnapshot = {
        date: todayStamp(),
        archivedTotal: archivedToday,
        criticalSignals,
        pendingReviews,
      };
      window.localStorage.setItem(YESTERDAY_SNAPSHOT_KEY, JSON.stringify(todaySnap));
    } catch {
      /* ignore */
    }
  }, [tasks, criticalSignals, pendingReviews]);

  // 挂载一次：决定是否弹简报 · 加载昨日快照 · 推进 streak
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const snapshotRaw = window.localStorage.getItem(YESTERDAY_SNAPSHOT_KEY);
      if (snapshotRaw) {
        const snapshot = JSON.parse(snapshotRaw) as DailySnapshot;
        if (snapshot.date === yesterdayStamp()) {
          setYesterdayMemo(snapshot);
        }
      }

      const seen = window.localStorage.getItem(BRIEFING_SEEN_KEY);
      if (seen === todayStamp()) return;
      setRuler(advanceStreak());

      const t = setTimeout(() => setVisible(true), 3800);
      return () => clearTimeout(t);
    } catch {
      /* ignore */
    }
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(BRIEFING_SEEN_KEY, todayStamp());
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  // 昨日/今日 statistics
  const stats = useMemo(() => {
    const archivedYesterday = tasks.filter(
      (t) => t.status === 'archived' || t.status === 'reviewed',
    ).length;
    const newToday = tasks.filter((t) =>
      ['planning', 'running', 'aggregating'].includes(t.status),
    ).length;
    return { archivedYesterday, newToday };
  }, [tasks]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return '夜深漏尽 · 陛下登朝';
    if (h < 9) return '晨钟三响 · 陛下登朝';
    if (h < 12) return '日上三竿 · 陛下登朝';
    if (h < 14) return '正午时辰 · 陛下登朝';
    if (h < 18) return '午后日长 · 陛下登朝';
    if (h < 21) return '华灯初上 · 陛下登朝';
    return '夜色深沉 · 陛下登朝';
  }, []);

  const milestoneTitle =
    ruler.milestone === 'day-100'
      ? '⚡ 百日连朝 · 圣君之证'
      : ruler.milestone === 'day-30'
        ? '🏆 三十日连朝 · 朝堂之基'
        : ruler.milestone === 'day-7'
          ? '🌟 七日连朝 · 初具帝王相'
          : ruler.milestone === 'new'
            ? '🎉 首次登朝 · 朝堂之主从此诞生'
            : null;

  const compact = density === 'compact';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          className={`relative overflow-hidden ${compact ? 'rounded-xl border' : 'rounded-2xl border-2'}`}
          style={{
            borderColor: 'rgba(240,198,106,0.35)',
            background:
              'linear-gradient(135deg, rgba(28,22,10,0.95) 0%, rgba(10,7,4,0.98) 65%, rgba(22,16,6,0.95) 100%)',
            boxShadow:
              '0 12px 36px rgba(0,0,0,0.55), 0 0 0 1px rgba(240,198,106,0.15), inset 0 1px 0 rgba(240,198,106,0.2)',
          }}
        >
          {compact ? (
            <>
              <button
                type="button"
                onClick={dismiss}
                className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[#8A92AC] transition hover:bg-white/[0.08] hover:text-[#F5E9C9]"
                aria-label="收起简报"
              >
                <X size={13} />
              </button>

              <div
                aria-hidden
                className="pointer-events-none absolute -right-12 top-1/2 h-[160px] w-[160px] -translate-y-1/2 rounded-full opacity-35"
                style={{
                  background:
                    'radial-gradient(circle, rgba(240,198,106,0.2) 0%, transparent 68%)',
                }}
              />

              <div className="relative z-[1] grid gap-3 px-4 py-3 md:grid-cols-[1.3fr_auto] md:items-center md:px-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#F0C66A]">
                      <Sunrise size={12} />
                      晨朝简报
                    </div>
                    <div
                      className="flex items-center gap-2 rounded-full border px-2.5 py-1"
                      style={{
                        background: 'rgba(240,198,106,0.08)',
                        borderColor: 'rgba(240,198,106,0.35)',
                      }}
                    >
                      <Flame size={12} className="text-[#F0C66A]" />
                      <span className="text-[11px] font-bold text-[#F5E9C9]">
                        连朝 <span className="font-mono text-[#F0C66A]">{ruler.streak}</span> 日
                      </span>
                    </div>
                    {milestoneTitle && (
                      <div className="rounded-full border border-[#F0C66A]/40 bg-[#F0C66A]/10 px-2.5 py-1 text-[10px] font-bold tracking-[0.06em] text-[#F0C66A]">
                        {milestoneTitle}
                      </div>
                    )}
                  </div>

                  <div
                    className="mt-2 line-clamp-1 text-[24px] font-black tracking-[0.08em] text-[#F5E9C9] md:text-[26px]"
                    style={{ fontFamily: '"Noto Serif SC", serif' }}
                  >
                    {greeting}
                  </div>

                  <p className="mt-1 text-[12px] leading-6 text-[#C8CDD8]">
                    昨日归档 <span className="font-bold text-[#F5E9C9]">{stats.archivedYesterday}</span> 件 · 今日待推进{' '}
                    <span className="font-bold text-[#F5E9C9]">{stats.newToday}</span> 件 · 急报{' '}
                    <span className="font-bold text-[#F43F5E]">{criticalSignals}</span> 处。请直接进入今日判断。
                  </p>

                  {yesterdayMemo && (
                    <div className="mt-2 text-[11px] leading-5 text-[#9AA3C4]">
                      昨日记忆：
                      <span className="ml-1 text-[#C8CDD8]">
                        批 {yesterdayMemo.archivedTotal} 件 · 夜巡 {yesterdayMemo.criticalSignals} 急报
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1.5 md:w-[300px]">
                  <MiniTile
                    icon={<Sparkles size={14} />}
                    label="在办"
                    value={`${activeAgents}/${totalAgents}`}
                    color="#F0C66A"
                    compact
                  />
                  <MiniTile
                    icon={<AlertTriangle size={14} />}
                    label="急报"
                    value={String(criticalSignals)}
                    color={criticalSignals > 0 ? '#F43F5E' : '#8A92AC'}
                    pulse={criticalSignals > 0}
                    compact
                  />
                  <MiniTile
                    icon={<CheckCircle2 size={14} />}
                    label="待御批"
                    value={String(pendingReviews)}
                    color={pendingReviews > 0 ? '#F0C66A' : '#8A92AC'}
                    compact
                  />
                  <MiniTile
                    icon={<Award size={14} />}
                    label="目标"
                    value="1 件"
                    color="#3DD68C"
                    compact
                  />
                </div>
              </div>

              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(240,198,106,0.5) 50%, transparent)',
                }}
              />
            </>
          ) : (
            <>
          {/* 金色放射背景 */}
          <div
            aria-hidden
            className={`pointer-events-none absolute left-1/2 -translate-x-1/2 opacity-40 ${compact ? '-top-[180px] h-[280px] w-[280px]' : '-top-1/2 h-[400px] w-[400px]'}`}
            style={{
              background:
                'radial-gradient(circle, rgba(240,198,106,0.24) 0%, transparent 60%)',
              filter: 'blur(2px)',
            }}
          />

          {/* 顶部金线 */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
            style={{
              background:
                'linear-gradient(90deg, transparent, #F0C66A 50%, transparent)',
              boxShadow: '0 1px 8px rgba(240,198,106,0.5)',
            }}
          />

          {/* 关闭按钮 */}
          <button
            type="button"
            onClick={dismiss}
            className={`absolute z-10 flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[#8A92AC] transition hover:bg-white/[0.08] hover:text-[#F5E9C9] ${compact ? 'right-2 top-2 h-6 w-6' : 'right-3 top-3 h-7 w-7'}`}
            aria-label="收起简报"
          >
            <X size={13} />
          </button>

          <div
            className={`relative z-[1] grid ${compact ? 'gap-4 px-4 py-3 md:grid-cols-[1.45fr_0.95fr] md:px-5 md:py-4' : 'gap-6 px-6 py-5 md:grid-cols-[1.3fr_1fr] md:px-8 md:py-6'}`}
          >
            {/* 左 · 问候 + 里程碑 */}
            <div>
              <div className={`flex items-center gap-2 font-semibold uppercase text-[#F0C66A] ${compact ? 'text-[10px] tracking-[0.24em]' : 'text-[11px] tracking-[0.3em]'}`}>
                <Sunrise size={13} />
                晨朝简报 · Morning Briefing
              </div>
              <h2
                className={`font-black leading-[1.1] tracking-[0.08em] ${compact ? 'mt-2 text-[22px] md:text-[25px]' : 'mt-3 text-[30px] md:text-[34px]'}`}
                style={{
                  color: '#F5E9C9',
                  fontFamily: '"Noto Serif SC", serif',
                  textShadow:
                    '0 2px 12px rgba(0,0,0,0.7), 0 0 28px rgba(240,198,106,0.2)',
                }}
              >
                {greeting}
              </h2>

              {/* 连朝徽章 · 大号 */}
              <div className={`flex flex-wrap items-center ${compact ? 'mt-3 gap-2' : 'mt-4 gap-3'}`}>
                <div
                  className={`flex items-center gap-2 rounded-full border ${compact ? 'px-3 py-1' : 'px-4 py-1.5'}`}
                  style={{
                    background: 'rgba(240,198,106,0.08)',
                    borderColor: 'rgba(240,198,106,0.45)',
                  }}
                >
                  <Flame size={14} className="text-[#F0C66A]" />
                  <span
                    className={`font-bold tracking-[0.1em] ${compact ? 'text-[12px]' : 'text-[13px]'}`}
                    style={{ color: '#F5E9C9' }}
                  >
                    连朝{' '}
                    <span className={`font-mono text-[#F0C66A] ${compact ? 'text-[15px]' : 'text-[18px]'}`}>
                      {ruler.streak}
                    </span>{' '}
                    日
                  </span>
                </div>
                {milestoneTitle && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                    className={`rounded-full border border-[#F0C66A]/50 bg-[#F0C66A]/15 font-bold tracking-[0.08em] ${compact ? 'px-2.5 py-1 text-[11px]' : 'border-2 px-3 py-1 text-[12px]'}`}
                    style={{
                      color: '#F0C66A',
                      textShadow: '0 0 8px rgba(240,198,106,0.5)',
                    }}
                  >
                    {milestoneTitle}
                  </motion.div>
                )}
              </div>

              <p
                className={`${compact ? 'mt-3 text-[12.5px] leading-[1.7]' : 'mt-4 text-[13.5px] leading-[1.85]'} tracking-[0.03em]`}
                style={{ color: '#C8CDD8' }}
              >
                昨日朝堂已归档{' '}
                <span className="font-bold text-[#F5E9C9]">
                  {stats.archivedYesterday}
                </span>{' '}
                件 · 今日待推进{' '}
                <span className="font-bold text-[#F5E9C9]">{stats.newToday}</span>{' '}
                件 · 锦衣卫夜巡发现{' '}
                <span className="font-bold text-[#F43F5E]">{criticalSignals}</span>{' '}
                处急报。朝堂已备 ·{' '}
                <span className="font-bold text-[#F0C66A]">请陛下登朝议事</span>。
              </p>

              {/* 昨日记忆 · 帝王回甘 */}
              {yesterdayMemo && (
                <div
                  className={`flex flex-wrap items-center gap-2 rounded-lg border text-[12px] ${compact ? 'mt-2 px-3 py-1.5' : 'mt-3 px-3 py-2'}`}
                  style={{
                    borderColor: 'rgba(240,198,106,0.24)',
                    background: 'rgba(240,198,106,0.05)',
                  }}
                >
                  <span className="text-[11px] font-semibold tracking-[0.32em] text-[#F0C66A]">
                    昨日记忆
                  </span>
                  <span className="text-[#C8CDD8]">
                    陛下昨日共批{' '}
                    <span className="font-mono font-bold text-[#F5E9C9]">
                      {yesterdayMemo.archivedTotal}
                    </span>{' '}
                    件 · 入史馆{' '}
                    <span className="font-mono font-bold text-[#F5E9C9]">
                      {yesterdayMemo.archivedTotal}
                    </span>{' '}
                    份 · 锦衣卫夜巡{' '}
                    <span className="font-mono font-bold text-[#F43F5E]">
                      {yesterdayMemo.criticalSignals}
                    </span>{' '}
                    处急报
                    {yesterdayMemo.archivedTotal > stats.archivedYesterday ? (
                      <span className="ml-2 text-[#F43F5E]">· 今日需加把劲</span>
                    ) : null}
                  </span>
                </div>
              )}
            </div>

            {/* 右 · 4 件事板 */}
            <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
              <div className={`grid grid-cols-2 ${compact ? 'gap-1.5' : 'gap-2'}`}>
                <MiniTile
                  icon={<Sparkles size={14} />}
                  label="在办席位"
                  value={`${activeAgents}/${totalAgents}`}
                  color="#F0C66A"
                  compact={compact}
                />
                <MiniTile
                  icon={<AlertTriangle size={14} />}
                  label="急报"
                  value={String(criticalSignals)}
                  color={criticalSignals > 0 ? '#F43F5E' : '#8A92AC'}
                  pulse={criticalSignals > 0}
                  compact={compact}
                />
                <MiniTile
                  icon={<CheckCircle2 size={14} />}
                  label="待御批"
                  value={String(pendingReviews)}
                  color={pendingReviews > 0 ? '#F0C66A' : '#8A92AC'}
                  compact={compact}
                />
                <MiniTile
                  icon={<Award size={14} />}
                  label="今日目标"
                  value="1 件"
                  color="#3DD68C"
                  compact={compact}
                />
              </div>
              {/* 分享昨日朱批卡 · 裂变钩 */}
              {yesterdayMemo && yesterdayMemo.archivedTotal > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent('court:verdict-card', {
                        detail: {
                          highlights: [
                            `昨日陛下批 ${yesterdayMemo.archivedTotal} 件`,
                            `入史馆 ${yesterdayMemo.archivedTotal} 份 · 夜巡 ${yesterdayMemo.criticalSignals} 急报`,
                            `连朝 ${ruler.streak} 日 · 朝堂之主`,
                          ],
                          primeMinisterVerdict:
                            '陛下励精图治 · 群臣咸服 · 今日再接再厉。',
                          verdict: '准',
                          date: formatYesterdayChinese(),
                        },
                      }),
                    );
                  }}
                  className={`flex w-full items-center justify-center gap-1.5 rounded-md border border-[#F0C66A]/35 bg-[#F0C66A]/8 font-semibold tracking-[0.08em] text-[#F0C66A] transition hover:bg-[#F0C66A]/15 ${compact ? 'px-3 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]'}`}
                >
                  <Share2 size={11} />
                  生成昨日朱批卡
                </button>
              )}
            </div>
          </div>

          {/* 底部金线 */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[1px]"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(240,198,106,0.5) 50%, transparent)',
            }}
          />
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MiniTile({
  icon,
  label,
  value,
  color,
  pulse,
  compact,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  pulse?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex items-center rounded-xl border ${compact ? 'gap-2 px-2.5 py-2' : 'gap-3 px-3 py-2.5'}`}
      style={{
        background: `${color}10`,
        borderColor: `${color}30`,
      }}
    >
      <div
        className={`flex shrink-0 items-center justify-center rounded-md border ${compact ? 'h-7 w-7' : 'h-8 w-8'}`}
        style={{
          background: `${color}20`,
          borderColor: `${color}55`,
          color,
        }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={`font-semibold uppercase tracking-[0.22em] ${compact ? 'text-[10px]' : 'text-[11px]'}`}
          style={{ color: `${color}cc` }}
        >
          {label}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span
            className={`font-mono font-black leading-none ${compact ? 'text-[16px]' : 'text-[18px]'}`}
            style={{
              color: '#F5E9C9',
              textShadow: `0 0 8px ${color}55`,
            }}
          >
            {value}
          </span>
          {pulse && (
            <span
              className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
              style={{ background: color, boxShadow: `0 0 6px ${color}` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

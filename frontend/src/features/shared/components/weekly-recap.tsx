/**
 * 朝堂 OS · 本周朝堂实录
 *
 * 周末复盘 · 粘度飞轮第四件：
 *   - 本周连朝天数
 *   - 本周批示数（approved tasks）
 *   - 本周活跃大臣排行（top 3）
 *   - 本周急报数
 *   - 一句话御评
 *
 * 可点「生成 PDF」触发 window.print()，配合 @media print 样式。
 *
 * 触发方式：挂在 /scribe 页面顶部作为"周末复盘"入口按钮 + 内嵌 modal
 */

'use client';

import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Award,
  Calendar,
  Crown,
  Download,
  Flame,
  Printer,
  Sparkles,
  X,
} from 'lucide-react';
import { useAppStore } from '@/lib/store/app-store';
import { AGENT_META, type AgentCode } from '@/types/agent';
import { DepartmentFlywheelRecap } from '@/features/shared/components/department-flywheel-recap';

function weekRangeLabel(): string {
  const now = new Date();
  const weekday = now.getDay();
  const startOffset = weekday === 0 ? 6 : weekday - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - startOffset);
  const fmt = (d: Date) =>
    `${d.getMonth() + 1}月${d.getDate()}日`;
  return `${fmt(weekStart)} — ${fmt(now)}`;
}

function readStreak(): number {
  if (typeof window === 'undefined') return 0;
  try {
    return Number.parseInt(
      window.localStorage.getItem('courtos.streak.days') ?? '0',
      10,
    );
  } catch {
    return 0;
  }
}

export function WeeklyRecapButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-2 rounded-full border-2 border-[#F0C66A]/40 bg-gradient-to-br from-[#F0C66A]/15 to-[#D4A84B]/10 px-5 py-2.5 text-[13px] font-bold tracking-[0.08em] text-[#F0C66A] shadow-[0_6px_22px_rgba(240,198,106,0.25)] transition hover:brightness-110"
      >
        <Sparkles size={14} className="transition-transform group-hover:rotate-12" />
        本周朝堂实录
        <span className="rounded-full bg-[#F0C66A]/20 px-2 py-0.5 text-[11px] tracking-[0.2em]">
          Weekly Recap
        </span>
      </button>
      <AnimatePresence>
        {open && <WeeklyRecapModal onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}

/* ========================================================================== *
 *  主 Modal
 * ========================================================================== */

function WeeklyRecapModal({ onClose }: { onClose: () => void }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const tasks = useAppStore((s) => s.tasks);
  const runs = useAppStore((s) => s.agentRuns);
  const signals = useAppStore((s) => s.intelSignals);

  const stats = useMemo(() => {
    const streak = readStreak();
    // 本周边界（过去 7 天）
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const thisWeekTasks = tasks.filter((t) => {
      const created = new Date(t.createdAt).getTime();
      return created >= sevenDaysAgo;
    });
    const approvedCount = thisWeekTasks.filter(
      (t) => t.status === 'report_ready' || t.status === 'archived',
    ).length;

    // 大臣活跃度（按 agentRuns 数量简化计算）
    const agentActivity = new Map<AgentCode, number>();
    for (const r of runs) {
      agentActivity.set(r.agentCode, (agentActivity.get(r.agentCode) ?? 0) + 1);
    }
    const topMinisters = Array.from(agentActivity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([code, count]) => ({
        code,
        name: AGENT_META[code]?.nameCn ?? code,
        count,
      }));

    const criticalCount = signals.filter(
      (s) => s.level === 'critical' || s.level === 'warning',
    ).length;

    return {
      streak,
      thisWeekTasks: thisWeekTasks.length,
      approvedCount,
      topMinisters,
      criticalCount,
    };
  }, [tasks, runs, signals]);

  const verdict = useMemo(() => {
    if (stats.approvedCount >= 10)
      return '本周朝政勤勉 · 批示过十 · 史馆记陛下日勤百官。';
    if (stats.approvedCount >= 5) return '本周朝政稳健 · 批示得当 · 群臣各得其所。';
    if (stats.approvedCount >= 1) return '本周朝政初兴 · 初下诸旨 · 值得期待。';
    return '本周朝政尚待勃发 · 请陛下下周多召见群臣。';
  }, [stats.approvedCount]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[170] flex items-center justify-center overflow-y-auto px-4 py-8 backdrop-blur-md print:relative print:inset-auto print:h-auto print:px-0 print:py-0 print:backdrop-blur-none"
      style={{
        background:
          'radial-gradient(ellipse at 50% 30%, rgba(240,198,106,0.12), rgba(0,0,0,0.88))',
      }}
      onClick={onClose}
    >
      {/* ============ 主卷轴 · 打印时占全页 ============ */}
      <motion.div
        ref={sheetRef}
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="weekly-recap-sheet relative w-full max-w-[820px] overflow-hidden rounded-2xl border-2 print:max-w-none print:rounded-none print:border-0"
        style={{
          borderColor: 'rgba(240,198,106,0.4)',
          background:
            'linear-gradient(160deg, #FDF4D8 0%, #F4E1B0 45%, #E9CF8E 100%)',
          boxShadow:
            '0 40px 96px rgba(0,0,0,0.75), 0 0 0 1px rgba(240,198,106,0.25)',
        }}
      >
        {/* 关闭按钮（打印时隐藏） */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[#8A6224]/30 bg-white/40 text-[#5A3E1A] transition hover:bg-white/60 print:hidden"
        >
          <X size={14} />
        </button>

        {/* 纸张装饰 · 顶金线 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[4px]"
          style={{
            background: 'linear-gradient(90deg, #8A6224, #F0C66A 50%, #8A6224)',
          }}
        />

        {/* 顶部 · Weekly Header */}
        <div className="relative px-10 pb-4 pt-10">
          <div className="flex items-center justify-between">
            <div>
              <div
                className="text-[11px] font-bold uppercase tracking-[0.36em]"
                style={{ color: '#8A6224' }}
              >
                Weekly Recap · 朝堂实录
              </div>
              <h1
                className="mt-2 text-[36px] font-black leading-[1.1] tracking-[0.08em]"
                style={{
                  color: '#5A3E1A',
                  fontFamily: '"Noto Serif SC", serif',
                }}
              >
                本周朝堂实录
              </h1>
              <div
                className="mt-1 flex items-center gap-2 text-[12px]"
                style={{ color: '#8A6224' }}
              >
                <Calendar size={11} />
                {weekRangeLabel()}
              </div>
            </div>

            {/* 金印 · 周末正式签章 */}
            <div
              className="flex h-[72px] w-[72px] flex-col items-center justify-center rounded-lg border-2 font-black"
              style={{
                background: 'linear-gradient(135deg, #DC3A3A, #8A1818)',
                borderColor: '#8A1818',
                color: '#FFFFFF',
                fontFamily: '"Noto Serif SC", serif',
                boxShadow: '0 4px 14px rgba(138,24,24,0.4)',
              }}
            >
              <div className="text-[22px] leading-none tracking-widest">史馆</div>
              <div className="mt-1 text-[11px] tracking-[0.2em] opacity-90">
                ARCHIVED
              </div>
            </div>
          </div>
        </div>

        {/* 上下金线间隔 */}
        <div
          aria-hidden
          className="mx-10 my-4 h-[1px]"
          style={{
            background:
              'linear-gradient(90deg, transparent, #8A6224 50%, transparent)',
          }}
        />

        {/* 核心数据 · 4 列 */}
        <div className="grid grid-cols-2 gap-6 px-10 pb-6 md:grid-cols-4 print:grid-cols-4">
          <RecapTile
            icon={<Flame size={18} />}
            label="连朝天数"
            value={String(stats.streak)}
            note={
              stats.streak >= 30
                ? '三十日连朝 · 朝堂之基'
                : stats.streak >= 7
                  ? '七日连朝 · 初具帝王相'
                  : '日积月累 · 必成大器'
            }
          />
          <RecapTile
            icon={<Crown size={18} />}
            label="本周批示"
            value={String(stats.approvedCount)}
            note="金玺所落 · 皆入史馆"
          />
          <RecapTile
            icon={<Sparkles size={18} />}
            label="新下旨意"
            value={String(stats.thisWeekTasks)}
            note="军机处拆 · 群臣并发"
          />
          <RecapTile
            icon={<Award size={18} />}
            label="急报处置"
            value={String(stats.criticalCount)}
            note={
              stats.criticalCount > 0
                ? '锦衣卫通报 · 已入视野'
                : '天下太平 · 四海皆安'
            }
          />
        </div>

        {/* 活跃大臣排行 */}
        <div className="px-10 pb-5">
          <div
            className="text-[11px] font-bold uppercase tracking-[0.3em]"
            style={{ color: '#8A6224' }}
          >
            Top Ministers · 本周最勤大臣
          </div>
          <div className="mt-3 space-y-2">
            {stats.topMinisters.length === 0 ? (
              <div
                className="rounded-lg border-2 border-dashed px-4 py-3 text-[12px] italic"
                style={{
                  borderColor: '#8A6224',
                  color: '#8A6224',
                  background: 'rgba(138,98,36,0.05)',
                }}
              >
                本周群臣尚未奔忙 · 等陛下下一道旨
              </div>
            ) : (
              stats.topMinisters.map((m, i) => {
                const rankColor = i === 0 ? '#D4A84B' : i === 1 ? '#B8946A' : '#8A6224';
                return (
                  <div
                    key={m.code}
                    className="flex items-center gap-3 rounded-lg border px-4 py-3"
                    style={{
                      borderColor: '#8A6224',
                      background: 'rgba(255,255,255,0.45)',
                    }}
                  >
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-full font-mono text-[16px] font-black"
                      style={{
                        background: `linear-gradient(135deg, ${rankColor}, ${rankColor}aa)`,
                        color: '#FFFFFF',
                        boxShadow: `0 2px 8px ${rankColor}55`,
                      }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div
                        className="text-[16px] font-black tracking-[0.08em]"
                        style={{
                          color: '#5A3E1A',
                          fontFamily: '"Noto Serif SC", serif',
                        }}
                      >
                        {m.name}
                      </div>
                      <div className="text-[11px]" style={{ color: '#8A6224' }}>
                        本周奔忙 {m.count} 次
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 部门校准飞轮（点亮已建好的学习飞轮，不改结构仅插一段） */}
        <DepartmentFlywheelRecap />

        {/* 一句御评 */}
        <div className="px-10 pb-6">
          <div
            className="rounded-lg border-2 px-5 py-4"
            style={{
              borderColor: 'rgba(138,98,36,0.5)',
              background:
                'linear-gradient(135deg, rgba(138,98,36,0.1), rgba(138,98,36,0.03))',
            }}
          >
            <div
              className="text-[11px] font-bold uppercase tracking-[0.3em]"
              style={{ color: '#8A6224' }}
            >
              Imperial Verdict · 御评
            </div>
            <div
              className="mt-2 text-[17px] font-bold leading-[1.7]"
              style={{
                color: '#5A3E1A',
                fontFamily: '"Noto Serif SC", serif',
              }}
            >
              {verdict}
            </div>
          </div>
        </div>

        {/* 底部金线 + 签名 */}
        <div
          aria-hidden
          className="mx-10 my-2 h-[1px]"
          style={{
            background:
              'linear-gradient(90deg, transparent, #8A6224 50%, transparent)',
          }}
        />
        <div className="flex items-center justify-between px-10 pb-6 pt-2 text-[11px]" style={{ color: '#8A6224' }}>
          <div>司马迁 秉笔 · 朝堂 OS</div>
          <div>{new Date().toLocaleDateString('zh-CN')}</div>
        </div>

        {/* 底金线 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[4px]"
          style={{
            background: 'linear-gradient(90deg, #8A6224, #F0C66A 50%, #8A6224)',
          }}
        />

        {/* 打印按钮（打印时隐藏） */}
        <div className="flex items-center justify-end gap-2 border-t border-[#8A6224]/30 bg-[#8A6224]/5 px-10 py-3 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#8A6224]/40 bg-white/50 px-4 py-2 text-[12px] font-medium"
            style={{ color: '#5A3E1A' }}
          >
            收起
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-full px-5 py-2 text-[12.5px] font-bold tracking-[0.08em]"
            style={{
              background: 'linear-gradient(135deg, #F0C66A, #D4A84B)',
              color: '#04060E',
              boxShadow: '0 4px 14px rgba(240,198,106,0.4)',
            }}
          >
            <Printer size={13} />
            下载 PDF · 打印装订
          </button>
        </div>
      </motion.div>

      {/* 打印样式 */}
      <style jsx global>{`
        @media print {
          body {
            background: #FFFFFF !important;
          }
          body > * {
            display: none !important;
          }
          body > .weekly-recap-sheet,
          .weekly-recap-sheet {
            display: block !important;
            visibility: visible !important;
          }
          .weekly-recap-sheet {
            position: static !important;
            max-width: 100% !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </motion.div>
  );
}

function RecapTile({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div
      className="rounded-lg border-2 px-4 py-3"
      style={{
        borderColor: 'rgba(138,98,36,0.45)',
        background:
          'linear-gradient(160deg, rgba(255,255,255,0.55) 0%, rgba(240,198,106,0.08) 100%)',
      }}
    >
      <div className="flex items-center gap-1.5" style={{ color: '#8A6224' }}>
        {icon}
        <div className="text-[11px] font-bold uppercase tracking-[0.22em]">
          {label}
        </div>
      </div>
      <div
        className="mt-2 font-mono text-[32px] font-black leading-none"
        style={{
          color: '#5A3E1A',
          textShadow: '0 1px 0 rgba(255,255,255,0.5)',
        }}
      >
        {value}
      </div>
      <div
        className="mt-1 text-[11px] italic leading-[1.5]"
        style={{ color: '#8A6224' }}
      >
        {note}
      </div>
    </div>
  );
}

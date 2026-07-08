'use client';

/**
 * 上书房 · 卷轴台共用原语
 *   - ScrollSection   卷轴信息区（标题 + 计数 + 查看全部 + 内容）
 *   - ScrollSealBadge 朱红印章徽记（准奏 / 驳回 / 状态）
 *   - ActionButton    通用真按钮（ghost / gold / danger）
 *   - DemoBadge       "演示数据" 角标（PRD §6）
 */

import type { ReactNode } from 'react';

const GOLD = '#F0C66A';

/* ════════════ ScrollSection ════════════ */
export function ScrollSection({
  eyebrow,
  title,
  count,
  onViewAll,
  children,
  accent = GOLD,
}: {
  eyebrow?: string;
  title: string;
  count?: string;
  onViewAll?: () => void;
  children: ReactNode;
  accent?: string;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-2xl border"
      style={{
        borderColor: 'rgba(240,198,106,0.18)',
        background:
          'linear-gradient(165deg, rgba(240,198,106,0.05), transparent 55%), rgba(5,16,27,0.84)',
        boxShadow: 'inset 0 1px 0 rgba(240,198,106,0.1)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}66, transparent)` }}
      />
      <header className="flex items-center justify-between gap-3 px-5 pt-4">
        <div className="flex items-baseline gap-2.5">
          <h3 className="display-serif text-[16px] font-bold" style={{ color: '#F5E9C9' }}>
            {title}
          </h3>
          {eyebrow && (
            <span className="text-[11px] tracking-[0.16em]" style={{ color: '#6A7299' }}>
              {eyebrow}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {count && (
            <span className="text-[12px] font-mono" style={{ color: accent }}>
              {count}
            </span>
          )}
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="rounded-md px-2 py-1 text-[11px] transition-colors hover:bg-white/5"
              style={{ color: '#9AA3C4' }}
            >
              查看全部 →
            </button>
          )}
        </div>
      </header>
      <div className="px-5 pb-4 pt-3">{children}</div>
    </section>
  );
}

/* ════════════ ScrollSealBadge — 朱红印章 ════════════ */
export function ScrollSealBadge({
  label,
  tone = 'approved',
}: {
  label: string;
  tone?: 'approved' | 'rejected' | 'review';
}) {
  const styles =
    tone === 'approved'
      ? { fg: '#FBEAD0', bg: 'linear-gradient(145deg,#B23B30,#8E211C)', bd: '#7C1A16' }
      : tone === 'rejected'
        ? { fg: '#C6CEE6', bg: 'rgba(106,114,153,0.25)', bd: '#3A4366' }
        : { fg: '#04060E', bg: 'linear-gradient(145deg,#F0C66A,#D4A84B)', bd: '#8A6A2A' };
  return (
    <span
      className="display-serif inline-flex items-center gap-1 rounded-[5px] px-2.5 py-1 text-[12px] font-bold"
      style={{
        color: styles.fg,
        background: styles.bg,
        border: `1.5px solid ${styles.bd}`,
        boxShadow: 'inset 0 0 6px rgba(0,0,0,0.3)',
        transform: 'rotate(-3deg)',
      }}
    >
      {label}
    </span>
  );
}

/* ════════════ ActionButton ════════════ */
export function ActionButton({
  children,
  onClick,
  variant = 'ghost',
  icon,
  disabled,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'ghost' | 'gold' | 'danger' | 'soft';
  icon?: ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  const styleMap = {
    gold: {
      color: '#04060E',
      background: 'linear-gradient(110deg, #F0C66A 0%, #E5B845 45%, #D4A84B 100%)',
      border: '1px solid rgba(240,198,106,0.5)',
      boxShadow: '0 0 14px rgba(240,198,106,0.28)',
    },
    danger: {
      color: '#F8B7C0',
      background: 'rgba(244,63,94,0.1)',
      border: '1px solid rgba(244,63,94,0.4)',
    },
    soft: {
      color: '#F0C66A',
      background: 'rgba(240,198,106,0.1)',
      border: '1px solid rgba(240,198,106,0.34)',
    },
    ghost: {
      color: '#C6CEE6',
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.1)',
    },
  } as const;
  const s = styleMap[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
      style={s}
    >
      {icon}
      {children}
    </button>
  );
}

/* ════════════ DemoBadge ════════════ */
export function DemoBadge({ className = '' }: { className?: string }) {
  return (
    <span
      title="当前为演示数据，尚未接入真实企业系统"
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`}
      style={{ color: GOLD, background: 'rgba(240,198,106,0.1)', border: '1px solid rgba(240,198,106,0.3)' }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: GOLD }} />
      演示数据
    </span>
  );
}

/* ════════════ 部门徽记小点 ════════════ */
export function DeptDot({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}aa` }} />
      <span className="text-[12px] font-semibold" style={{ color: '#C6CEE6' }}>
        {name}
      </span>
    </span>
  );
}

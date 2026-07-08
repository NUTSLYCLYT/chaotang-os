'use client';

/**
 * 上书房 · 原子组件（合一文件，避免组件爆炸）
 *   1. ImperialButton   · 帝制按钮（gold / primary / secondary / ghost / danger）
 *   2. PriorityTag      · 优先级朱印徽章（急 / 高 / 中 / 低）
 *   3. StatusTag        · 状态标签（待裁决 / 执行中 / 已完成 / 有风险 / 已归档）
 *   4. PortraitHeader   · 立像头部（portrait + 名号 + 司职）
 *   5. GlassPanel       · 半透明深蓝玻璃面板壳（暗金描边 + 四角金角标）
 */

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import type { ImperialStatus, Priority } from '../types';
import { assetUrl } from '@/lib/asset';

/* ──────────────── 1. ImperialButton ──────────────── */

type ButtonVariant = 'gold' | 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

export interface ImperialButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'disabled' | 'onClick' | 'size' | 'type'> {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
  serif?: boolean;
}

const BTN_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-full font-medium tracking-[0.04em] transition-all disabled:cursor-not-allowed disabled:opacity-50';

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-1.5 text-[11.5px]',
  md: 'px-5 py-2 text-[12.5px]',
};

export function ImperialButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled,
  loading,
  icon,
  className = '',
  serif,
  ...buttonProps
}: ImperialButtonProps) {
  const variantStyle: Record<ButtonVariant, string> = {
    gold: 'bg-gradient-to-b from-[#FFE09A] to-[#F0C66A] font-bold text-[#1B1306] hover:brightness-110 shadow-[0_4px_18px_rgba(240,198,106,0.28)]',
    primary:
      'border border-[#F0C66A]/45 bg-[#F0C66A]/[0.08] text-[#F0C66A] hover:bg-[#F0C66A]/15 hover:border-[#F0C66A]/70',
    secondary:
      'border border-white/12 bg-white/[0.03] text-[#D7DFF2] hover:border-[#F0C66A]/45 hover:text-[#F0C66A]',
    ghost: 'text-[#9AA3C4] hover:bg-white/5 hover:text-[#F0C66A]',
    danger: 'border border-[#F43F5E]/45 bg-[#F43F5E]/[0.08] text-[#FCA5B8] hover:bg-[#F43F5E]/15',
  };

  return (
    <button
      {...buttonProps}
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={[BTN_BASE, BTN_SIZE[size], variantStyle[variant], className].join(' ')}
      style={serif ? { fontFamily: 'var(--font-serif)' } : undefined}
    >
      {loading ? (
        <span
          className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent"
          aria-hidden
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}

/* ──────────────── 2. PriorityTag ──────────────── */

const PRIORITY_META: Record<
  Priority,
  { label: string; seal: string; color: string; bg: string; border: string }
> = {
  urgent: { label: '急', seal: '急', color: '#F43F5E', bg: 'rgba(244,63,94,0.10)', border: 'rgba(244,63,94,0.50)' },
  high: { label: '高', seal: '要', color: '#F5A524', bg: 'rgba(245,165,36,0.10)', border: 'rgba(245,165,36,0.48)' },
  medium: { label: '中', seal: '中', color: '#F0C66A', bg: 'rgba(240,198,106,0.10)', border: 'rgba(240,198,106,0.45)' },
  low: { label: '低', seal: '缓', color: '#6BA0FF', bg: 'rgba(107,160,255,0.10)', border: 'rgba(107,160,255,0.42)' },
};

export function PriorityTag({ priority, size = 'sm' }: { priority: Priority; size?: 'sm' | 'md' }) {
  const m = PRIORITY_META[priority];
  const d = size === 'md' ? 26 : 21;
  return (
    <span
      className="inline-flex flex-shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: d,
        height: d,
        fontSize: size === 'md' ? 12.5 : 10.5,
        color: m.color,
        background: m.bg,
        border: `1.5px solid ${m.border}`,
        boxShadow: `0 0 8px ${m.bg}`,
        fontFamily: 'var(--font-serif)',
      }}
      aria-label={`优先级 ${m.label}`}
      title={`优先级 · ${m.label}`}
    >
      {m.seal}
    </span>
  );
}

/* ──────────────── 3. StatusTag ──────────────── */

const STATUS_META: Record<ImperialStatus, { label: string; color: string; bg: string; border: string }> = {
  pending: { label: '待裁决', color: '#F0C66A', bg: 'rgba(240,198,106,0.10)', border: 'rgba(240,198,106,0.40)' },
  running: { label: '执行中', color: '#6BA0FF', bg: 'rgba(107,160,255,0.10)', border: 'rgba(107,160,255,0.40)' },
  completed: { label: '已完成', color: '#3DD68C', bg: 'rgba(61,214,140,0.10)', border: 'rgba(61,214,140,0.40)' },
  risk: { label: '有风险', color: '#F43F5E', bg: 'rgba(244,63,94,0.10)', border: 'rgba(244,63,94,0.40)' },
  archived: { label: '已归档', color: '#9AA3C4', bg: 'rgba(154,163,196,0.08)', border: 'rgba(154,163,196,0.34)' },
};

export function StatusTag({ status }: { status: ImperialStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ color: m.color, background: m.bg, border: `1px solid ${m.border}` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} aria-hidden />
      {m.label}
    </span>
  );
}

/* ──────────────── 4. PortraitBanner（大幅立像头部） ──────────────── */

export interface PortraitBannerProps {
  portrait: string;
  name: string;
  duty: string;
  objectPosition?: string;
  accent?: string;
  /** 名号下方附加（如钦天监的语音波形） */
  belowSlot?: ReactNode;
}

export function PortraitBanner({
  portrait,
  name,
  duty,
  objectPosition = 'center top',
  accent = '#F0C66A',
  belowSlot,
}: PortraitBannerProps) {
  return (
    <div className="relative flex flex-col items-center px-4 pt-2 pb-1.5">
      <span className="z-10 mb-0.5 text-[11px] tracking-[0.12em]" style={{ color: `${accent}99` }} aria-hidden>
        ◈
      </span>
      {/* 立像 · 无边框，柔和金晕 + 渐变蒙版自然融入面板 */}
      <div className="relative h-[128px] w-[118px] xl:h-[156px] xl:w-[136px]">
        {/* 背后柔和金晕（深度） */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 50% 38%, ${accent}26 0%, transparent 68%)`,
            filter: 'blur(8px)',
          }}
        />
        {/* 立像本体 · 蒙版向四周/底部渐隐 */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${assetUrl(portrait)})`,
            backgroundSize: 'cover',
            backgroundPosition: objectPosition,
            backgroundRepeat: 'no-repeat',
            WebkitMaskImage:
              'radial-gradient(118% 94% at 50% 30%, #000 50%, rgba(0,0,0,0.4) 72%, transparent 90%)',
            maskImage:
              'radial-gradient(118% 94% at 50% 30%, #000 50%, rgba(0,0,0,0.4) 72%, transparent 90%)',
          }}
          role="img"
          aria-label={`${name} 立像`}
        />
      </div>
      <div
        className="-mt-1 text-[19px] font-bold leading-none xl:text-[21px]"
        style={{ color: accent, fontFamily: 'var(--font-serif)', letterSpacing: '0.08em' }}
      >
        {name}
      </div>
      <div className="mt-1.5 text-[11px] font-medium tracking-[0.04em] text-[#AEB7D4]">{duty}</div>
      {belowSlot && <div className="mt-1">{belowSlot}</div>}
    </div>
  );
}

/* ──────────────── 5. GlassPanel ──────────────── */

export interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  accent?: string;
  corners?: boolean;
  flush?: boolean;
}

export function GlassPanel({
  children,
  className = '',
  style,
  accent = '#F0C66A',
  corners = true,
  flush = false,
}: GlassPanelProps) {
  return (
    <section
      className={['relative flex flex-col overflow-hidden', flush ? 'rounded-none' : 'rounded-xl', className].join(' ')}
      style={{
        background: flush ? 'transparent' : 'linear-gradient(180deg, rgba(9,13,28,0.92) 0%, rgba(5,8,18,0.97) 100%)',
        border: flush ? '0' : `1px solid ${accent}34`,
        borderRadius: flush ? 0 : undefined,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: flush ? 'none' : `0 20px 55px rgba(0,0,0,0.55), inset 0 1px 0 rgba(245,233,201,0.045), inset 0 0 34px rgba(240,198,106,0.025)`,
        ...style,
      }}
    >
      {corners && (
        <>
          <span className="pointer-events-none absolute left-2 top-2 h-3 w-3 border-l border-t" style={{ borderColor: `${accent}70` }} />
          <span className="pointer-events-none absolute right-2 top-2 h-3 w-3 border-r border-t" style={{ borderColor: `${accent}55` }} />
          <span className="pointer-events-none absolute bottom-2 left-2 h-3 w-3 border-b border-l" style={{ borderColor: `${accent}45` }} />
          <span className="pointer-events-none absolute bottom-2 right-2 h-3 w-3 border-b border-r" style={{ borderColor: `${accent}60` }} />
        </>
      )}
      {children}
    </section>
  );
}

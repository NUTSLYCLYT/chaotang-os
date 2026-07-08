import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

type GlassVariant = 'default' | 'gold' | 'danger' | 'success' | 'info';
type GlassTone = 'flat' | 'elevated' | 'deep';

export interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant;
  tone?: GlassTone;
  hudCorners?: boolean;
  glow?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children?: ReactNode;
}

const VARIANT_STYLE: Record<GlassVariant, { border: string; glow: string }> = {
  default: { border: 'rgba(107, 160, 255, 0.2)', glow: 'rgba(107, 160, 255, 0.12)' },
  gold:    { border: 'rgba(240, 198, 106, 0.4)', glow: 'rgba(240, 198, 106, 0.18)' },
  danger:  { border: 'rgba(244, 63, 94, 0.45)',  glow: 'rgba(244, 63, 94, 0.25)' },
  success: { border: 'rgba(61, 214, 140, 0.35)', glow: 'rgba(61, 214, 140, 0.18)' },
  info:    { border: 'rgba(96, 165, 250, 0.35)', glow: 'rgba(96, 165, 250, 0.18)' },
};

const TONE_BG: Record<GlassTone, string> = {
  flat: 'rgba(10, 14, 30, 0.55)',
  elevated: 'rgba(15, 20, 40, 0.7)',
  deep: 'rgba(20, 26, 52, 0.8)',
};

const PADDING_CLASS: Record<NonNullable<GlassPanelProps['padding']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
};

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  function GlassPanel(
    {
      variant = 'default',
      tone = 'elevated',
      hudCorners = false,
      glow = false,
      padding = 'md',
      className = '',
      style,
      children,
      ...rest
    },
    ref,
  ) {
    const variantStyle = VARIANT_STYLE[variant];
    const bg = TONE_BG[tone];

    const composedStyle: React.CSSProperties = {
      background: bg,
      backdropFilter: 'blur(16px) saturate(140%)',
      WebkitBackdropFilter: 'blur(16px) saturate(140%)',
      border: `1px solid ${variantStyle.border}`,
      borderRadius: '12px',
      boxShadow: glow
        ? `0 0 32px ${variantStyle.glow}, inset 0 1px 0 rgba(255, 255, 255, 0.04)`
        : `0 4px 24px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.04)`,
      position: 'relative',
      ...style,
    };

    return (
      <div
        ref={ref}
        className={`${hudCorners ? 'hud-corner' : ''} ${PADDING_CLASS[padding]} ${className}`.trim()}
        style={composedStyle}
        {...rest}
      >
        {children}
      </div>
    );
  },
);

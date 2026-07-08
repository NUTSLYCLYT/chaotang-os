/**
 * 朝堂 OS V2 · Design Tokens (TypeScript)
 *
 * 与 app/globals.css 的 @theme 块保持同步。
 * TS 侧用来给组件内联样式、Canvas、SVG、动画等提供类型化访问。
 *
 * 修改规则：改颜色必须同时改这里和 globals.css，由 Design System Agent 独占维护。
 */

/* ==========================================================================
   Colors
   ========================================================================== */

export const colors = {
  bg: '#04060E',
  bgDeep: '#02030A',
  surface: '#0A0E1E',
  surface1: '#0F1428',
  surface2: '#141A34',

  border: '#1A2142',
  borderSubtle: '#12182E',
  borderBright: '#2C3560',

  text: '#EAEEFB',
  textWarm: '#FBF7EC',
  textSecondary: '#C8CDD8',
  textDim: '#9AA3C4',
  textMuted: '#6A7299',
  textFaint: '#484F72',

  gold: '#D4A84B',
  goldBright: '#F0C66A',
  goldDeep: '#8A6A2A',

  blue: '#4A82F0',
  blueBright: '#6BA0FF',

  success: '#3DD68C',
  warning: '#F5A524',
  danger: '#F43F5E',
  info: '#60A5FA',
} as const;

export type ColorToken = keyof typeof colors;

/* ==========================================================================
   Semantic color mappings — 让组件表达意图而非直接选色
   ========================================================================== */

export const semantic = {
  riskLow: colors.success,
  riskMedium: colors.info,
  riskHigh: colors.warning,
  riskCritical: colors.danger,

  healthNormal: colors.success,
  healthWatch: colors.info,
  healthWarning: colors.warning,
  healthDanger: colors.danger,

  agentIdle: colors.textMuted,
  agentAssigned: colors.blue,
  agentRunning: colors.gold,
  agentWaiting: colors.info,
  agentSummarizing: colors.blueBright,
  agentCompleted: colors.success,
  agentFailed: colors.danger,
  agentFallback: colors.warning,
  agentArchived: colors.textFaint,
} as const;

/* ==========================================================================
   Spacing, radius, shadows
   ========================================================================== */

export const spacing = {
  xs: '0.25rem',   // 4
  sm: '0.5rem',    // 8
  md: '0.75rem',   // 12
  lg: '1rem',      // 16
  xl: '1.5rem',    // 24
  '2xl': '2rem',   // 32
  '3xl': '3rem',   // 48
} as const;

export const radius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
  md: '0 4px 12px rgba(0, 0, 0, 0.5)',
  lg: '0 8px 32px rgba(0, 0, 0, 0.6)',
  glow: '0 0 24px rgba(240, 198, 106, 0.15)',
  glowBlue: '0 0 24px rgba(107, 160, 255, 0.18)',
  glowDanger: '0 0 24px rgba(244, 63, 94, 0.25)',
  glowSuccess: '0 0 24px rgba(61, 214, 140, 0.2)',
} as const;

/* ==========================================================================
   Motion
   ========================================================================== */

export const motion = {
  /** 常用缓动曲线 */
  easeOutExpo: 'cubic-bezier(0.16, 1, 0.3, 1)',
  easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',

  /** 时长 */
  fast: 150,
  normal: 250,
  slow: 400,
  breathe: 3000,
  rotate: 24000,
} as const;

/* ==========================================================================
   Typography scale
   ========================================================================== */

export const fontSize = {
  xs: '0.6875rem',    // 11 — 细节元（红线最小值：标签/徽章）
  sm: '0.75rem',      // 12 — 次级信息
  base: '0.8125rem',  // 13 — 正文（红线最小值：正文/段落）
  md: '0.875rem',     // 14
  lg: '1rem',         // 16 — 区标题
  xl: '1.25rem',      // 20 — 页级标题
  '2xl': '1.5rem',    // 24
  '3xl': '2rem',      // 32 — Hero
  '4xl': '2.75rem',   // 44 — 视觉锚点
} as const;

/**
 * 字号红线 — C6 契约
 *
 * labelMin (11px): 标签、徽章、辅助信息的最小字号
 * bodyMin  (13px): 正文、段落、可读内容的最小字号
 *
 * 低于 labelMin 的字号禁止新增（存量由 check-font-size-redline.mjs 基线管控）。
 */
export const fontSizeRedLine = {
  labelMinPx: 11,
  bodyMinPx: 13,
} as const;

/* ==========================================================================
   Unified token export
   ========================================================================== */

export const tokens = {
  colors,
  semantic,
  spacing,
  radius,
  shadows,
  motion,
  fontSize,
} as const;

export type Tokens = typeof tokens;

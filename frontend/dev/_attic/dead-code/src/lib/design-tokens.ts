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

export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.5rem',
  '2xl': '2rem',
  '3xl': '3rem',
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

export const motion = {
  easeOutExpo: 'cubic-bezier(0.16, 1, 0.3, 1)',
  easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  fast: 150,
  normal: 250,
  slow: 400,
  breathe: 3000,
  rotate: 24000,
} as const;

export const fontSize = {
  xs: '0.6875rem',
  sm: '0.75rem',
  base: '0.8125rem',
  md: '0.875rem',
  lg: '1rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '2rem',
  '4xl': '2.75rem',
} as const;

export const tokens = { colors, semantic, spacing, radius, shadows, motion, fontSize } as const;
export type Tokens = typeof tokens;

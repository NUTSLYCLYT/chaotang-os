import type { VerdictCfg } from '@/features/shared/office-kit/verdict-card';

/** 礼部 4 司复用的裁决色阶(与 DepartmentPageViewShell 的 COMMAND_STYLE 同一套语义色)。 */
export const VERDICT_TONE: Record<'green' | 'amber' | 'red' | 'blue', VerdictCfg> = {
  green: { color: '#7DE3A8', bg: 'rgba(125,227,168,0.08)', border: 'rgba(125,227,168,0.28)' },
  amber: { color: '#F0C66A', bg: 'rgba(240,198,106,0.08)', border: 'rgba(240,198,106,0.28)' },
  red: { color: '#FF8A8A', bg: 'rgba(255,138,138,0.08)', border: 'rgba(255,138,138,0.28)' },
  blue: { color: '#86A9F2', bg: 'rgba(134,169,242,0.08)', border: 'rgba(134,169,242,0.28)' },
};

/** 锦衣卫协办徽色(暂无登记入 CAPABILITY_MENU,先用固定色,跑通再收口)。 */
export const JINYIWEI_ACCENT = '#6B7A8F';

export const inputClass =
  'w-full rounded-[8px] border border-white/12 bg-[#0b0d16] px-2.5 py-1.5 text-[12px] text-[#F5E9C9] outline-none focus:border-[#C070D0]/55';

/**
 * 兵部 · 后端六司 + CRO 内部席位映射（纯函数 · 2026-06-27）
 *
 * 用户可见口径以后端部门协议为主：销售司、市场司、渠道司、客户司、竞情司、增长司。
 * CRO 引擎内部仍保留 8 个销售席位，用于判词和精细过滤，但不对用户冒充"司"。
 */
import {
  SUB_OFFICE_NAMES,
  classifyBingbuSalesRevenueQuestion,
  selectBingbuSubOffices,
} from '@/core/courtos/bingbu/bingbu-cro-sales-office';
import type { BingbuSubOfficeId } from '@/core/courtos/bingbu/bingbu-types';
import type { BingbuSalesItem } from '@/lib/contracts/bingbu-sales';

export interface BingbuOfficeRole {
  id: BingbuSubOfficeId;
  /** CRO 内部席位名（取自引擎 SSOT） */
  name: string;
  /** 真实销售岗位 */
  role: string;
  /** 职责一句话 */
  duty: string;
}

export type BingbuBackendBureauId = 'sales' | 'market' | 'channel' | 'customer' | 'competitive' | 'growth';

export interface BingbuBackendBureau {
  id: BingbuBackendBureauId;
  name: string;
  role: string;
  scope: string;
  seats: BingbuSubOfficeId[];
}

export const BINGBU_BACKEND_BUREAUS: BingbuBackendBureau[] = [
  {
    id: 'sales',
    name: '销售司',
    role: 'Sales',
    scope: '商机、客户推进、成交路径',
    seats: ['opportunity_pipeline', 'pricing_deal_desk'],
  },
  {
    id: 'market',
    name: '市场司',
    role: 'Marketing',
    scope: '需求、定位、线索、活动',
    seats: ['gtm_strategy', 'opportunity_pipeline'],
  },
  {
    id: 'channel',
    name: '渠道司',
    role: 'Channel',
    scope: '经销商、代理、伙伴',
    seats: ['channel_partner'],
  },
  {
    id: 'customer',
    name: '客户司',
    role: 'Key Account',
    scope: '大客户关系、决策链',
    seats: ['key_account_attack', 'customer_success_growth'],
  },
  {
    id: 'competitive',
    name: '竞情司',
    role: 'Competitive Intel',
    scope: '竞品、价格、打法',
    seats: ['pricing_deal_desk', 'key_account_attack', 'gtm_strategy'],
  },
  {
    id: 'growth',
    name: '增长司',
    role: 'RevOps / Growth',
    scope: '漏斗、转化、复购、预测',
    seats: ['sales_revops', 'customer_success_growth'],
  },
];

export const BINGBU_BACKEND_BUREAU_BY_ID = Object.fromEntries(
  BINGBU_BACKEND_BUREAUS.map((bureau) => [bureau.id, bureau]),
) as Record<BingbuBackendBureauId, BingbuBackendBureau>;

/** CRO 内部 8 席顺序（尚书居首，余按销售漏斗推进顺序）。 */
export const BINGBU_OFFICE_ORDER: BingbuSubOfficeId[] = [
  'cro_chief',
  'gtm_strategy',
  'opportunity_pipeline',
  'key_account_attack',
  'pricing_deal_desk',
  'channel_partner',
  'sales_revops',
  'customer_success_growth',
];

const OFFICE_META: Record<BingbuSubOfficeId, { role: string; duty: string }> = {
  cro_chief: { role: 'CRO / 销售VP', duty: '总裁决 · 定调 · 销售组织' },
  gtm_strategy: { role: 'GTM / 市场策略', duty: '打哪个行业/区域/ICP · 新品上市' },
  opportunity_pipeline: { role: 'SDR / 内勤销售', duty: '线索甄别 · 商机阶段 · 漏斗健康' },
  key_account_attack: { role: '大客户 AE', duty: '决策链 · 关键人 · 多线程攻关' },
  pricing_deal_desk: { role: 'Deal Desk / 定价', duty: '报价 · 折扣 · 底价 · 付款条件' },
  channel_partner: { role: '渠道 / BD', duty: '代理 · 分成 · 客户归属 · 独家' },
  sales_revops: { role: 'RevOps / 销售运营', duty: '预测 · CRM质量 · 提成 · 复盘' },
  customer_success_growth: { role: 'CSM / 客户成功', duty: '续约 · 复购 · QBR · 增长' },
};

/** CRO 内部编制（含真实岗位与职责）。 */
export const BINGBU_ROSTER: BingbuOfficeRole[] = BINGBU_OFFICE_ORDER.map((id) => ({
  id,
  name: SUB_OFFICE_NAMES[id],
  role: OFFICE_META[id].role,
  duty: OFFICE_META[id].duty,
}));

/** 一条销售事项由哪些 CRO 内部席位经手（引擎派席，主办=第一个）。文本取 command 优先。 */
export function officesForItem(item: BingbuSalesItem): BingbuSubOfficeId[] {
  const text = item.command?.trim() || item.title;
  const type = classifyBingbuSalesRevenueQuestion(text);
  return selectBingbuSubOffices(type, text);
}

/** 主办 CRO 席位（队列卡徽章用）。 */
export function leadOfficeForItem(item: BingbuSalesItem): BingbuSubOfficeId {
  const offices = officesForItem(item);
  // cro_chief 永远在列；主办取第一个非 cro_chief 的专业司，没有则 cro_chief。
  return offices.find((o) => o !== 'cro_chief') ?? 'cro_chief';
}

/** 每个 CRO 内部席位今日经手数（聚合派席结果，全真）。 */
export function countByOffice(items: BingbuSalesItem[]): Record<BingbuSubOfficeId, number> {
  const counts = Object.fromEntries(
    BINGBU_OFFICE_ORDER.map((id) => [id, 0]),
  ) as Record<BingbuSubOfficeId, number>;
  for (const item of items) {
    for (const id of officesForItem(item)) counts[id] += 1;
  }
  return counts;
}

export function bureausForItem(item: BingbuSalesItem): BingbuBackendBureauId[] {
  const offices = new Set(officesForItem(item));
  return BINGBU_BACKEND_BUREAUS
    .filter((bureau) => bureau.seats.some((seat) => offices.has(seat)))
    .map((bureau) => bureau.id);
}

export function countByBackendBureau(items: BingbuSalesItem[]): Record<BingbuBackendBureauId, number> {
  const counts = Object.fromEntries(
    BINGBU_BACKEND_BUREAUS.map((bureau) => [bureau.id, 0]),
  ) as Record<BingbuBackendBureauId, number>;
  for (const item of items) {
    for (const id of bureausForItem(item)) counts[id] += 1;
  }
  return counts;
}

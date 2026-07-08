/**
 * 锦衣卫 · 阿里国际站获客适配（ali-intl-feed·骨架）· 2026-07-01
 *
 * ⚠️ 待接真源：需 env `ALI_INTL_APP_KEY` + `ALI_INTL_APP_SECRET`（阿里国际站开放平台 RFQ/询盘 API）。
 * 字段名须对齐国际站 API 文档。未接前不可用。
 *
 * 海外线索 → Lead(channel=overseas, overseas=true) → 统一中台 lead-radar。
 * 🔴 军品红线：军工/军贸相关询盘一律标 militaryRestricted → 合规门拦（军品出口违法，只出民品）。
 */
import { runLeadRadar, type Lead, type LeadCriteria, type LeadRadarResult } from '@/features/jinyiwei/lib/lead-radar';

const MIL_HINTS = ['military', 'defense', 'defence', 'army', 'weapon', 'missile', '军', '军工', '军贸', '武器'];

const cfg = () => {
  const key = process.env.ALI_INTL_APP_KEY;
  const secret = process.env.ALI_INTL_APP_SECRET;
  if (!key || !secret) throw new Error('阿里国际站未配置：需 ALI_INTL_APP_KEY + ALI_INTL_APP_SECRET');
  return { key, secret };
};

/** 国际站询盘/RFQ 原始条目 → Lead。军品迹象自动标 restricted。 */
export function normalizeAliInquiry(raw: Record<string, unknown>): Lead {
  const s = (k: string): string => (raw[k] == null ? '' : String(raw[k]));
  const title = s('subject') || s('productName') || s('title');
  const text = `${title} ${s('description')}`.toLowerCase();
  const amountRaw = (s('quantity') || s('budget') || '').replace(/[,\s]/g, '').match(/[\d.]+/);
  return {
    id: s('id') || s('rfqId'),
    title,
    party: s('buyerCompany') || s('buyerName') || s('company'),
    amount: amountRaw ? Number(amountRaw[0]) : null,
    category: s('category') || '海外',
    channel: 'overseas',
    sourceUrl: s('detailUrl') || s('url'),
    sourceName: 'alibaba.com',
    overseas: true,
    militaryRestricted: MIL_HINTS.some((h) => text.includes(h.toLowerCase())),
    publishedAt: s('gmtCreate') || undefined,
  };
}

/**
 * 拉国际站询盘 → 中台甄别（军品被合规门拦，只出民品线索）。
 * ⚠️ 请求签名/路径按阿里开放平台文档实现；未接前抛"未配置"。
 */
export async function pullAliInquiries(_criteria: LeadCriteria): Promise<LeadRadarResult> {
  cfg(); // 校验配置存在（真实现需 TOP 签名）
  throw new Error('阿里国际站 API 请求待实现：接入开放平台 RFQ 接口 + TOP 签名后，normalizeAliInquiry 归一 → runLeadRadar');
}

/** 已归一好的国际站线索 → 中台（可先用于测试/离线批处理）。 */
export function screenAliLeads(rawInquiries: Array<Record<string, unknown>>, criteria: LeadCriteria): LeadRadarResult {
  return runLeadRadar(rawInquiries.map(normalizeAliInquiry), criteria);
}

/** 海外民品默认筛条件（军品由合规门另拦）。 */
export const DEFAULT_OVERSEAS_CRITERIA: LeadCriteria = {
  keywords: ['lithium battery', 'battery pack', '锂电池', '电池组', 'lifepo4', 'energy storage'],
  excludeKeywords: [],
  maxAmount: undefined,
};

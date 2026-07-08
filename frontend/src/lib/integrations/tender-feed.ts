/**
 * 锦衣卫 · 招标数据源适配（tender-feed·骨架）· 2026-07-01
 *
 * ⚠️ 待接真源：需 env `TENDER_API_URL` + `TENDER_API_KEY`（剑鱼标讯/必联网/千里马任一）。
 * 各家响应字段不同——`normalizeTender` 里按你选的 API 文档对齐字段。未接前不可用，勿当已通。
 *
 * 职责：拉真招标 → 归一成 Tender → 交 tender-radar 过滤/分级/去重 → 合格线索推兵部。
 * 锦衣卫本命：来源可核才入；脏情报由 tender-radar 的可信度门挡在外。
 */
import { runTenderRadar, type Tender, type TenderCriteria } from '@/features/jinyiwei/lib/tender-radar';
import { leadToBingbu, type LeadRadarResult } from '@/features/jinyiwei/lib/lead-radar';

const cfg = () => {
  const url = process.env.TENDER_API_URL;
  const key = process.env.TENDER_API_KEY;
  if (!url || !key) throw new Error('招标源未配置：需 TENDER_API_URL + TENDER_API_KEY（剑鱼/必联网/千里马）');
  return { url: url.replace(/\/$/, ''), key };
};

/** 把某家 API 的原始条目归一成 Tender。⚠️ 字段名按你选的 API 文档改。 */
export function normalizeTender(raw: Record<string, unknown>, sourceName: string): Tender {
  const s = (k: string): string => (raw[k] == null ? '' : String(raw[k]));
  const amountRaw = s('budget') || s('amount') || s('金额');
  const amountNum = amountRaw.replace(/[￥¥,，\s元万亿]/g, '').match(/[\d.]+/);
  return {
    id: s('id') || s('bidId') || s('url'),
    title: s('title') || s('projectName') || s('标题'),
    buyer: s('buyer') || s('purchaser') || s('采购人') || s('采购单位'),
    amount: amountNum ? Number(amountNum[0]) * (amountRaw.includes('万') ? 10_000 : amountRaw.includes('亿') ? 100_000_000 : 1) : null,
    category: s('category') || s('industry') || s('行业'),
    sourceUrl: s('url') || s('link') || s('detailUrl'),
    sourceName,
    deadline: s('deadline') || s('endTime') || undefined,
    publishedAt: s('publishTime') || s('publishedAt') || undefined,
  };
}

/**
 * 拉招标源 → 雷达过滤 → 合格线索。⚠️ 查询参数/路径按你选的 API 文档改。
 * 连真源后即可跑；未接前抛"未配置"。
 */
export async function pullTenders(criteria: TenderCriteria, sourceName = '剑鱼标讯'): Promise<LeadRadarResult> {
  const { url, key } = cfg();
  const q = encodeURIComponent(criteria.keywords.join(' '));
  const res = await fetch(`${url}/search?keywords=${q}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`招标源 ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data?: Array<Record<string, unknown>>; list?: Array<Record<string, unknown>> };
  const rows = json.data ?? json.list ?? [];
  const tenders = rows.map((r) => normalizeTender(r, sourceName));
  return runTenderRadar(tenders, criteria);
}

/** 合格线索 → 兵部/Twenty opportunity 形状（供 twenty-client 建 opportunity）。 */
export function leadsForBingbu(result: LeadRadarResult) {
  return result.qualified.map(leadToBingbu);
}

/** 你的默认筛条件（军工/工业/特种锂电池·你接得了的规模）。 */
export const DEFAULT_TENDER_CRITERIA: TenderCriteria = {
  keywords: ['锂电池', '电池组', '特种电源', '蓄电池', '电源模块'],
  excludeKeywords: ['框架协议', 'GWh', '集采', '储能系统集中采购'],
  maxAmount: 5_000_000, // ¥500万以下=你的甜区；大标另评
};

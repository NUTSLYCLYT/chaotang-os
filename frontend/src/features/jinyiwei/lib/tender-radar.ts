/**
 * 锦衣卫 · 招标渠道映射（tender-radar）· 2026-07-01
 *
 * 招投标只是获客渠道之一：把 Tender 归一成 Lead，甄别全交统一中台 lead-radar（铁律6/3·不留两套甄别）。
 */
import { runLeadRadar, leadToBingbu, type Lead, type LeadCriteria, type LeadRadarResult } from './lead-radar';

export interface Tender {
  id: string;
  title: string;
  buyer: string;
  amount: number | null;
  category: string;
  sourceUrl: string;
  sourceName: string;
  deadline?: string;
  publishedAt?: string;
}

export type TenderCriteria = LeadCriteria;

/** Tender → Lead（channel=tender）。 */
export function tenderToLead(t: Tender): Lead {
  return {
    id: t.id,
    title: t.title,
    party: t.buyer,
    amount: t.amount,
    category: t.category,
    channel: 'tender',
    sourceUrl: t.sourceUrl,
    sourceName: t.sourceName,
    deadline: t.deadline,
    publishedAt: t.publishedAt,
  };
}

/** 招标一轮 = 映射成 Lead 交中台甄别。 */
export function runTenderRadar(tenders: Tender[], criteria: TenderCriteria): LeadRadarResult {
  return runLeadRadar(tenders.map(tenderToLead), criteria);
}

export { leadToBingbu };

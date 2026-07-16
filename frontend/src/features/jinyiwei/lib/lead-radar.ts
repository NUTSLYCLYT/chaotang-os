/**
 * 锦衣卫 · 统一获客线索中台（lead-radar）· 2026-07-01
 *
 * 一套甄别大脑，多渠道插头：招投标/电商询盘/内容种草/海外平台 都归一成 Lead，
 * 走同一条 过滤→可信度分级(挡脏情报)→合规门(军品海外)→去重→打分 → 推兵部建 opportunity。
 *
 * 铁律6：线索甄别只此一处，各渠道 adapter 只负责"拉+归一成 Lead"，不各自造甄别逻辑。
 * 复用 IntelCredibility。纯函数、可单测。
 */
import type { IntelCredibility } from '@/lib/contracts/intel';

export type LeadChannel = 'tender' | 'b2b_platform' | 'content' | 'overseas' | 'inbound';

export interface Lead {
  id: string;
  title: string;
  /** 采购方/客户/询盘方；空=不可核=脏情报。 */
  party: string;
  /** 金额(元)；null=未披露。 */
  amount: number | null;
  category: string;
  channel: LeadChannel;
  /** 来源 URL；空=不可核，挡门。 */
  sourceUrl: string;
  sourceName: string;
  /** 海外线索（触发军品出口红线）。 */
  overseas?: boolean;
  /** 军品/军贸受限（海外则违法，刑部拦）。 */
  militaryRestricted?: boolean;
  deadline?: string;
  publishedAt?: string;
}

export interface LeadCriteria {
  keywords: string[];
  excludeKeywords?: string[];
  maxAmount?: number;
  minAmount?: number;
}

const norm = (s: string): string => (s || '').replace(/\s+/g, '');
const hitAny = (text: string, words: string[]): boolean => {
  const t = norm(text);
  return words.some((w) => w && t.includes(norm(w)));
};

const OFFICIAL = ['军队采购网', '政府采购', 'ccgp', 'plap', '中核', '国家能源', 'alibaba.com', 'made-in-china'];

/** 可信度分级（复用 IntelCredibility）。无来源/无采购方 → low(挡门)。 */
export function gradeLeadCredibility(l: Lead): IntelCredibility {
  if (!l.sourceUrl || !l.party) return 'low';
  const official = hitAny(l.sourceName, OFFICIAL) || hitAny(l.sourceUrl, OFFICIAL);
  if (official && l.amount != null) return 'verified';
  if (l.amount != null) return 'high';
  return 'medium';
}

export function matchesLead(l: Lead, c: LeadCriteria): boolean {
  const text = `${l.title} ${l.category}`;
  if (!hitAny(text, c.keywords)) return false;
  if (c.excludeKeywords && hitAny(text, c.excludeKeywords)) return false;
  if (c.maxAmount != null && l.amount != null && l.amount > c.maxAmount) return false;
  if (c.minAmount != null && l.amount != null && l.amount < c.minAmount) return false;
  return true;
}

/** 合规门（刑部·获客入口）：军品出海=违法，拦。 */
export function complianceBlock(l: Lead): string | null {
  if (l.overseas && l.militaryRestricted) return '军品出口管制——海外线索不可承接（军贸许可，刑部拦）';
  return null;
}

export function dedupeLeads(leads: Lead[]): Lead[] {
  const seen = new Set<string>();
  const out: Lead[] = [];
  for (const l of leads) {
    const key = `${norm(l.party)}|${norm(l.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out;
}

export interface QualifiedLead extends Lead {
  credibility: IntelCredibility;
}

export interface LeadRadarResult {
  /** Client-side heuristic only; never eligible to become a court decision. */
  capabilityMode: 'SHADOW';
  sourceLabel: 'FALLBACK';
  decisionEligible: false;
  qualified: QualifiedLead[];
  rejected: Array<{ title: string; reason: string }>;
  summary: { total: number; qualified: number; dirty: number; irrelevant: number; complianceBlocked: number };
}

/** 中台一轮：去重→合规门→过滤→分级→挡脏→排序。 */
export function runLeadRadar(leads: Lead[], criteria: LeadCriteria): LeadRadarResult {
  const qualified: QualifiedLead[] = [];
  const rejected: Array<{ title: string; reason: string }> = [];
  let dirty = 0;
  let irrelevant = 0;
  let blocked = 0;

  for (const l of dedupeLeads(leads)) {
    const block = complianceBlock(l);
    if (block) {
      rejected.push({ title: l.title, reason: block });
      blocked++;
      continue;
    }
    if (!matchesLead(l, criteria)) {
      rejected.push({ title: l.title, reason: '不符(关键词/规模)' });
      irrelevant++;
      continue;
    }
    const credibility = gradeLeadCredibility(l);
    if (credibility === 'low') {
      rejected.push({ title: l.title, reason: '脏情报(无来源/无采购方)——锦衣卫挡门' });
      dirty++;
      continue;
    }
    qualified.push({ ...l, credibility });
  }
  qualified.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
  return {
    capabilityMode: 'SHADOW',
    sourceLabel: 'FALLBACK',
    decisionEligible: false,
    qualified,
    rejected,
    summary: { total: leads.length, qualified: qualified.length, dirty, irrelevant, complianceBlocked: blocked },
  };
}

/** 合格线索 → 兵部/Twenty opportunity 形状。 */
export function leadToBingbu(l: QualifiedLead): { name: string; companyName: string; amount: number | null; stage: string; channel: LeadChannel; sourceUrl: string; credibility: IntelCredibility } {
  return { name: l.title, companyName: l.party, amount: l.amount, stage: '新线索', channel: l.channel, sourceUrl: l.sourceUrl, credibility: l.credibility };
}

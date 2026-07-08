/**
 * 兵部 对外定价复核 → 盖章呈奏（2026-06-29）
 *
 * 设计↔真引擎的桥（兵部版，对标户部 bom-cost / 工部 pack）。
 * 接续真业务流：户部采购成本 + 兵部销售价 → 毛利显形（computeMargin）→ 盖章定价复核呈奏。
 *
 * 高风险铁律（13.2.5）：对外报价必过人工确认门。本呈奏一律带「未生效·待联审朱批」醒目横幅，
 * 防"看着像定稿"被误当报价外发。毛利缺一侧→诚实标缺，绝不编。
 */

import type { MarginResult } from '@/features/hubu/lib/sales-price-library';
import type { OfficialDocumentProps, DocEvidence } from '@/components/OfficialDocument';

export interface QuotationDocMeta {
  docNo: string;
  date: string;
  handler: string;
  reviewers?: string[];
  /** 毛利红线（%）；低于则风险段告警。默认 20。 */
  marginFloorPct?: number;
}

const fmt = (n: number): string => Math.round(n).toLocaleString('zh-CN');

/** 兵部毛利复核 → 对外定价呈奏 props（高风险门·未生效横幅·缺则标缺不编）。 */
export function marginToDocument(m: MarginResult, meta: QuotationDocMeta): OfficialDocumentProps {
  const floor = meta.marginFloorPct ?? 20;
  const priced = m.sell != null && m.cost != null && m.profit != null;
  const thin = m.marginPct != null && m.marginPct < floor;

  const bluf = priced
    ? `「${m.product}」${m.customer ? `（客户：${m.customer}）` : ''}拟对外报价 ${fmt(m.sell!)} 元（采购成本 ${fmt(m.cost!)} 元，毛利 ${fmt(m.profit!)} 元 / ${m.marginPct}%${thin ? '，低于 ' + floor + '% 红线' : ''}）。本报价为内部复核草案，对外生效须过户部+兵部联审 + 老板朱批（高风险门·铁律13.2.5）。`
    : `「${m.product}」定价暂无法核定——${m.missing.join('、') || '缺买价或卖价'}。兵部不替编毛利，请补齐后再呈。`;

  const evidence: DocEvidence[] = [
    ...(m.cost != null ? [{ text: `采购成本 ${fmt(m.cost)} 元 — 户部采购价库真台账`, source: 'real' as const }] : []),
    ...(m.sell != null ? [{ text: `拟售价 ${fmt(m.sell)} 元 — 兵部销售价库真订单`, source: 'real' as const }] : []),
    ...(priced ? [{ text: `毛利 ${fmt(m.profit!)} 元（${m.marginPct}%）= 卖 − 买`, source: 'real' as const }] : []),
    ...m.missing.map((x): DocEvidence => ({ text: `${x} — 待补`, source: 'missing' })),
    { text: '竞品同规格对外报价基准 — 暂无免费可信外部源，待锦衣卫人工核实', source: 'missing' },
  ];

  const sections = [
    { heading: '定价依据', body: priced ? `卖 ${fmt(m.sell!)} − 买 ${fmt(m.cost!)} = 毛利 ${fmt(m.profit!)} 元（${m.marginPct}%）。买价取户部采购真台账，卖价取兵部销售真订单，毛利据此显形。` : '买价或卖价缺失，定价未核定。' },
    { heading: '处置与建议', body: priced ? [thin ? `毛利 ${m.marginPct}% 低于 ${floor}% 红线，建议复议售价或降本后再报。` : `毛利 ${m.marginPct}% 在红线之上，可提交联审。`, '对外报价须经户部核成本、兵部定策略、老板朱批三道，方可外发。'] : ['先补齐买/卖价再议，兵部不替估。'] },
  ];

  const risks = [
    '对外报价属高风险事项（铁律13.2.5）：本草案未生效，未过户部+兵部联审 + 老板朱批前，严禁外发或对客户承诺。',
    ...(thin ? [`毛利 ${m.marginPct}% 低于 ${floor}% 红线，对外报价有亏损风险。`] : []),
    '竞品基准缺失，售价竞争力待锦衣卫核实，勿凭内部毛利单方定价。',
  ];

  const nextSteps = [
    '户部核采购成本口径，兵部定报价策略与分档。',
    '过联审后呈老板朱批；朱批生效前本呈奏不构成对外报价。',
    '质门：毛利过红线 + 证据齐 + 朱批，方可外发正式报价单。',
  ];

  return {
    deptName: '兵部',
    deptKind: '销售专用章',
    docNo: meta.docNo,
    classification: '内部·商密',
    date: meta.date,
    title: `关于「${m.product}」对外定价复核的呈奏`,
    bluf,
    sections,
    evidence,
    risks,
    nextSteps,
    handler: meta.handler,
    reviewers: meta.reviewers ?? ['户部·成本司', '锦衣卫·情报'],
    statusBanner: '草案 · 对外报价未生效 · 待户部+兵部联审 + 老板朱批 · 禁外发',
  };
}

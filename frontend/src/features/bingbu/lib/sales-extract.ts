/**
 * 兵部 · 销售事实抽取（纯函数 · 2026-06-27）
 *
 * 「数据全 v1」的地基：从用户真问题里抽出结构化销售字段——第一条真实数据来自**用户自己的话**
 * （铁律5：第一条真实数据从哪来 = 任务文本结构化抽取），不靠外部魔法 API、不编。
 *
 * 同时修掉上一版 derive 的 4 窟窿：
 *   ① cleanSalesQuestion 把"请军机处围绕『X』组织会审"擦成 X（清洗下沉到 derive，不只渲染层）
 *   ② extractSalesFacts 真抽 金额/交期/预付/条款/行业/对手方（原破正则客户0%、金额1/55）
 *   ③ gradeSalesRisk 据真条款分级（独家/违约/付款→critical，原版全 critical 失真）
 *   ④ dedupeByQuestion 按清洗后问题去重（55→唯一，重复合成 askedCount）
 *
 * 诚实纪律：抽不到的字段一律 undefined，上层显示 '—'，绝不假填。
 */

import type { SalesRiskLevel } from '@/lib/contracts/bingbu-sales';

/** 从真问题里抽出的结构化销售事实。抽不到 = undefined（诚实空，不编）。 */
export interface SalesFacts {
  /** 涉及金额（万元字符串，如 "120 万"） */
  amount?: string;
  /** 交付/交期天数 */
  deliveryDays?: number;
  /** 预付款（万元字符串） */
  prepayment?: string;
  /** 折扣（如 "八折" / "20%"） */
  discount?: string;
  /** 合同/条款类型（独家、违约金、框架协议…） */
  terms: string[];
  /** 行业线索（新能源、储能、医疗…） */
  industry?: string;
  /** 客户/对手方 */
  counterparty?: string;
  /** 合同/交易类型（供货合同、代理协议…） */
  dealType?: string;
}

/**
 * cleanSalesQuestion —— 把朝堂下达模板剥掉，还原老板真问题。
 * "请军机处围绕『是否签120万合同?』组织会审，重点核查…" → "是否签120万合同?"
 */
export function cleanSalesQuestion(raw: string): string {
  if (!raw) return '';
  // 1) 优先取引号内主体（『』「」""）
  const quoted = raw.match(/[『「“"]([^』」”"]{4,})[』」”"]/);
  if (quoted) return quoted[1].trim();
  // 2) 否则剥掉"请X围绕/会审/复核…"前缀 + "，组织会审…"后缀
  let s = raw.replace(/^请[^，。：:、]{0,12}(围绕|就|对|审查|判断|分析|会审|复核|评估)\s*/, '');
  s = s.replace(/[，,]\s*(组织会审|重点核查|请[^。]*)[。.]?\s*$/, '');
  return s.trim();
}

const TERM_KEYWORDS: Array<[RegExp, string]> = [
  [/独家|排他/, '独家条款'],
  [/违约金|违约责任/, '违约金'],
  [/框架协议/, '框架协议'],
  [/预付/, '预付款'],
  [/分成|抽成/, '分成条款'],
  [/账期|付款条件|付款周期/, '账期条款'],
];

const INDUSTRY_KEYWORDS = [
  '新能源', '储能', '光伏', '电池', '医疗', '半导体', '汽车', '教育',
  '金融', '地产', '快消', '制造', '物流', 'agritech', '芯片', 'SaaS',
];

/** 从问题文本抽结构化销售事实（全部来自用户原话，抽不到留空）。 */
export function extractSalesFacts(text: string): SalesFacts {
  const t = text ?? '';
  const terms: string[] = [];
  for (const [re, label] of TERM_KEYWORDS) if (re.test(t)) terms.push(label);

  // 金额：第一个"N 万"（非预付的）。预付单独抽。
  const prepayM = t.match(/预付(?:款)?\s*([\d.]+)\s*万/);
  const prepayment = prepayM ? `${prepayM[1]} 万` : undefined;
  // 主金额：取所有"N万"里非预付那个（优先合同/订单/报价金额）
  const allWan = [...t.matchAll(/([\d.]+)\s*万/g)].map((m) => m[1]);
  const amount = allWan.find((v) => v !== prepayM?.[1]) ?? (allWan[0] && !prepayM ? allWan[0] : undefined);

  const deliveryM = t.match(/(\d+)\s*天(?:交付|交货|交期)?/);
  const deliveryDays = deliveryM ? Number(deliveryM[1]) : undefined;

  const discountM = t.match(/([一二三四五六七八九]折|\d+\s*折|\d+\s*%\s*(?:折扣)?)/);
  const discount = discountM ? discountM[1].replace(/\s/g, '') : undefined;

  const industry = INDUSTRY_KEYWORDS.find((kw) => t.includes(kw));

  const dealM = t.match(/(供货合同|采购合同|框架协议|代理协议|渠道协议|服务合同|销售合同|订单)/);
  const dealType = dealM ? dealM[1] : undefined;

  const cpM = t.match(/([一-龥A-Za-z0-9]{2,12})(?:客户|公司|集团|甲方|对方)/);
  const counterparty = cpM ? cpM[1] : undefined;

  return {
    amount: amount ? `${amount} 万` : undefined,
    deliveryDays,
    prepayment,
    discount,
    terms,
    industry,
    counterparty,
    dealType,
  };
}

/** 据真条款分级（修正：报价≠critical，只有独家/违约/付款级才 critical）。 */
export function gradeSalesRisk(text: string, facts: SalesFacts): SalesRiskLevel {
  if (facts.terms.includes('独家条款') || facts.terms.includes('违约金') || /付款|预付/.test(text)) {
    return 'critical';
  }
  if (facts.terms.length > 0 || /合同|框架协议|正式报价/.test(text)) return 'high';
  if (/报价|谈判|商机|成交|订单|折扣/.test(text)) return 'medium';
  return 'low';
}

/** 商机阶段（据销售动词，抽不到 '—'）。 */
export function inferStage(text: string): string {
  if (/线索|展会/.test(text)) return '线索';
  if (/续约|复购/.test(text)) return '续约';
  if (/合同|框架协议|签约/.test(text)) return '合同推进';
  if (/报价|折扣|压价|谈判/.test(text)) return '报价/谈判';
  return '—';
}

export interface DedupeResult<T> {
  item: T;
  /** 同一问题被下达的次数（≥1）。 */
  askedCount: number;
}

/**
 * dedupeByQuestion —— 按清洗后问题去重。同一句问题被下达 N 次 → 1 条，askedCount=N。
 * 保留**第一个遇到的**条目（Map first-write 语义）；调用方若要"保留最新"，须在传入前自行按时间降序排好。
 */
export function dedupeByQuestion<T>(
  items: T[],
  questionOf: (t: T) => string,
): DedupeResult<T>[] {
  const map = new Map<string, DedupeResult<T>>();
  for (const it of items) {
    const key = cleanSalesQuestion(questionOf(it)) || questionOf(it);
    const existing = map.get(key);
    if (existing) {
      existing.askedCount += 1;
    } else {
      map.set(key, { item: it, askedCount: 1 });
    }
  }
  return [...map.values()];
}

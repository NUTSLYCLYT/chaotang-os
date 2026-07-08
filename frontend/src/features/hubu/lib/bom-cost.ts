/**
 * 户部 · 成本司 · BOM 成本核算引擎（2026-06-28）
 *
 * 第一条真数据闭环：解析真实 BOM 表(材料清单+单价) → 真总成本 + 成本结构 + 内外对比 + 缺证诚实。
 * 解析按**表头关键词**定位列（鲁棒：跨不同 BOM 排版都能认），不写死列号。
 * 纯函数（parse/analyze 不碰 IO，可测、本地、数据不外传）；缺价则标缺、绝不编。
 */
import { compareInternalExternal, type ExternalComparison } from './dept-external-hook';
import { queryPriceSmart, type PriceRecord, type Freshness } from './price-library';

export interface BomLine {
  name: string;
  qty: number | null;
  unitPrice: number | null;
  amount: number | null; // 金额(合计)；缺则由 qty×unitPrice 估
  spec?: string; // 规格描述(给规格匹配用,如"LFP 32Ah")
}

export interface BomCost {
  product: string;
  totalCost: number | null;
  lines: BomLine[];
  /** 成本结构：按金额降序 + 占比。 */
  breakdown: { name: string; amount: number; pct: number }[];
  /** 最大成本项（老板最该盯的那块料）。 */
  topCostDriver: { name: string; pct: number } | null;
  missing: string[];
}

const HEADER_KEYS = {
  name: ['物料名称', '名称', '品名', '材料', 'item'],
  qty: ['数量', '数 量', 'qty', '用量'],
  price: ['单价', '单 价', 'price', '采购单价'],
  amount: ['合计', '金额', '总计', '小计', 'amount', '总价'],
  spec: ['规格描述', '规格及描述', '规格', '描述', '型号'],
};

function matchCol(cell: unknown, keys: string[]): boolean {
  const s = String(cell ?? '').replace(/\s/g, '').toLowerCase();
  return keys.some((k) => s.includes(k.replace(/\s/g, '').toLowerCase()));
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return v;
  const s = String(v ?? '').replace(/[,，\s¥￥元]/g, '');
  if (!s || !/[\d.]/.test(s)) return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}

/** 从 sheet 行(header:1 二维数组)解析 BOM。纯函数。 */
export function parseBomRows(rows: unknown[][], product = ''): BomCost {
  const missing: string[] = [];
  // 1. 找表头行：含"物料名称/名称" 且 含"单价或合计"
  let headerIdx = -1;
  let col = { name: -1, qty: -1, price: -1, amount: -1, spec: -1 };
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const r = rows[i] ?? [];
    const nameC = r.findIndex((c) => matchCol(c, HEADER_KEYS.name));
    const priceC = r.findIndex((c) => matchCol(c, HEADER_KEYS.price));
    const amountC = r.findIndex((c) => matchCol(c, HEADER_KEYS.amount));
    if (nameC >= 0 && (priceC >= 0 || amountC >= 0)) {
      headerIdx = i;
      col = {
        name: nameC,
        qty: r.findIndex((c) => matchCol(c, HEADER_KEYS.qty)),
        price: priceC,
        amount: amountC,
        spec: r.findIndex((c, ci) => ci !== nameC && matchCol(c, HEADER_KEYS.spec)),
      };
      break;
    }
  }
  if (headerIdx < 0) {
    return { product, totalCost: null, lines: [], breakdown: [], topCostDriver: null, missing: ['未识别到 BOM 表头(物料名称/单价/金额列)'] };
  }
  if (col.price < 0 && col.amount < 0) missing.push('单价/金额列');

  // 2. 抽明细行（表头之后；跳空行 + 合计/备注行）
  const lines: BomLine[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const name = String(r[col.name] ?? '').trim();
    if (!name || /合计|备注|总成本|制表|审核|审批/.test(name)) continue;
    const qty = col.qty >= 0 ? toNum(r[col.qty]) : null;
    const unitPrice = col.price >= 0 ? toNum(r[col.price]) : null;
    let amount = col.amount >= 0 ? toNum(r[col.amount]) : null;
    if (amount == null && qty != null && unitPrice != null) amount = Math.round(qty * unitPrice * 100) / 100;
    const spec = col.spec >= 0 ? String(r[col.spec] ?? '').trim() : '';
    // 有名字就收（含缺价的）→ 缺价物料计入缺证，不静默跳过(诚实)。
    lines.push({ name, qty, unitPrice, amount, spec });
  }

  const withAmount = lines
    .filter((l): l is BomLine & { amount: number } => l.amount != null)
    .map((l) => ({ name: l.name, amount: l.amount }));
  const totalCost = withAmount.length ? Math.round(withAmount.reduce((s, l) => s + l.amount, 0) * 100) / 100 : null;
  const noPriceCount = lines.filter((l) => l.amount == null).length;
  if (noPriceCount > 0) missing.push(`${noPriceCount} 项物料缺单价/金额`);

  const breakdown = totalCost
    ? withAmount
        .map((l) => ({ name: l.name, amount: l.amount, pct: Math.round((l.amount / totalCost) * 1000) / 10 }))
        .sort((a, b) => b.amount - a.amount)
    : [];
  const topCostDriver = breakdown.length ? { name: breakdown[0].name, pct: breakdown[0].pct } : null;

  return { product, totalCost, lines, breakdown, topCostDriver, missing };
}

export interface BomAnalysis {
  totalCost: number | null;
  topCostDriver: { name: string; pct: number } | null;
  /** 毛利（给售价才算）。 */
  grossMargin: { sellPrice: number; profit: number; marginPct: number } | null;
  /** 内外对比：最大成本项占比 vs 行业（外部数据，留口子）。 */
  comparison: ExternalComparison | null;
  verdict: string;
  missing: string[];
}

/** 成本分析 + 毛利(给售价) + 内外对比(给行业占比)。纯函数。 */
export function analyzeBomCost(bom: BomCost, sellPrice?: number | null, industryTopPct?: number | null): BomAnalysis {
  const missing = [...bom.missing];
  let grossMargin: BomAnalysis['grossMargin'] = null;
  if (sellPrice != null && sellPrice > 0 && bom.totalCost != null) {
    const profit = Math.round((sellPrice - bom.totalCost) * 100) / 100;
    grossMargin = { sellPrice, profit, marginPct: Math.round((profit / sellPrice) * 1000) / 10 };
  } else if (sellPrice == null) {
    missing.push('售价(算毛利)');
  }
  const comparison = bom.topCostDriver
    ? compareInternalExternal(`${bom.topCostDriver.name}成本占比`, bom.topCostDriver.pct, industryTopPct ?? null, 'industry_benchmark')
    : null;

  const verdict =
    bom.totalCost == null
      ? '缺单价/金额，无法核算总成本——先补全 BOM 单价'
      : `总成本 ${bom.totalCost} 元；最大成本项「${bom.topCostDriver?.name}」占 ${bom.topCostDriver?.pct}%` +
        (grossMargin ? `；毛利 ${grossMargin.profit} 元（${grossMargin.marginPct}%）` : '；缺售价无法算毛利');

  return { totalCost: bom.totalCost, topCostDriver: bom.topCostDriver, grossMargin, comparison, verdict, missing };
}

export interface FilledLine { name: string; price: number; freshness: Freshness; supplier: string; needsRuling: boolean; ruleReason: string | null; outliers: number[]; }

/**
 * 用采购价库自动填 BOM 缺价物料（流水线：规格匹配 → 剔离群 → 标待裁）。
 * 缺价行 → queryPriceSmart 查规格对的稳健价填上 + 时效灯；模糊的标 needsRuling 进看板待人裁；台账没有→缺证。纯函数。
 */
export function fillBomPricesFromLibrary(bom: BomCost, records: PriceRecord[], asOf: string): { bom: BomCost; filledFromLibrary: FilledLine[] } {
  const filledFromLibrary: FilledLine[] = [];
  const lines: BomLine[] = bom.lines.map((l) => {
    if (l.unitPrice != null || l.amount != null) return l;
    const q = queryPriceSmart(records, l.name, l.spec ?? '', asOf);
    if (!q.matched || q.robustPrice == null) return l;
    const unitPrice = q.robustPrice;
    const amount = l.qty != null ? Math.round(l.qty * unitPrice * 100) / 100 : unitPrice;
    filledFromLibrary.push({ name: l.name, price: unitPrice, freshness: q.freshness, supplier: q.supplier, needsRuling: q.needsHumanRuling, ruleReason: q.ruleReason, outliers: q.outliers });
    return { ...l, unitPrice, amount };
  });
  const withAmount = lines.filter((l): l is BomLine & { amount: number } => l.amount != null).map((l) => ({ name: l.name, amount: l.amount }));
  const totalCost = withAmount.length ? Math.round(withAmount.reduce((s, l) => s + l.amount, 0) * 100) / 100 : null;
  const breakdown = totalCost
    ? withAmount.map((l) => ({ name: l.name, amount: l.amount, pct: Math.round((l.amount / totalCost) * 1000) / 10 })).sort((a, b) => b.amount - a.amount)
    : [];
  const topCostDriver = breakdown.length ? { name: breakdown[0].name, pct: breakdown[0].pct } : null;
  const noPriceCount = lines.filter((l) => l.amount == null).length;
  const missing = bom.missing.filter((m) => !/缺单价|缺.*金额/.test(m));
  if (noPriceCount > 0) missing.push(`${noPriceCount} 项物料采购台账里也没有，需补价`);
  return { bom: { ...bom, lines, totalCost, breakdown, topCostDriver, missing }, filledFromLibrary };
}

/** 从 lines 重算总成本/结构/最大项/缺证（看板人工填价后实时重算用）。纯函数。 */
export function recomputeBomFromLines(product: string, lines: BomLine[], extraMissing: string[] = []): BomCost {
  const withAmount = lines.filter((l): l is BomLine & { amount: number } => l.amount != null).map((l) => ({ name: l.name, amount: l.amount }));
  const totalCost = withAmount.length ? Math.round(withAmount.reduce((s, l) => s + l.amount, 0) * 100) / 100 : null;
  const breakdown = totalCost
    ? withAmount.map((l) => ({ name: l.name, amount: l.amount, pct: Math.round((l.amount / totalCost) * 1000) / 10 })).sort((a, b) => b.amount - a.amount)
    : [];
  const topCostDriver = breakdown.length ? { name: breakdown[0].name, pct: breakdown[0].pct } : null;
  const noPriceCount = lines.filter((l) => l.amount == null).length;
  const missing = [...extraMissing];
  if (noPriceCount > 0) missing.push(`${noPriceCount} 项物料缺价`);
  return { product, totalCost, lines, breakdown, topCostDriver, missing };
}

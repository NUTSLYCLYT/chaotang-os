/**
 * 户部/兵部 · 销售价库 + 毛利引擎（2026-06-28）
 *
 * 价格体系另一半（卖价侧）：从真销售订单/合同抽卖价 → 与采购价库(买价)合龙 → 毛利=卖-买显形。
 * 用户原则：价格体系和销售(兵部)、采购(户部)在一起，毛利永远显形。
 * 复用采购价库的 PriceRecord/queryPrice（产品→material、卖价→unitPrice、客户→supplier）。
 * 纯函数本地。毛利缺任一侧 → 诚实标缺，不编(铁律13.2)。
 */
import { queryPrice, type PriceRecord } from './price-library';

const SALES_HEADER = {
  product: ['项目名称', '产品名称', '品名'],
  price: ['单价', '售价', '成交单价'],
  customer: ['客户名称', '客户', '单位'],
  date: ['签订日期', '成交日期', '下单日期', '日期'],
};

function matchCol(cell: unknown, keys: string[]): boolean {
  const s = String(cell ?? '').replace(/\s|\n/g, '');
  return keys.some((k) => s.includes(k));
}
function toNum(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return v;
  const s = String(v ?? '').replace(/[,，\s¥￥元]/g, '');
  if (!s || !/[\d.]/.test(s)) return null;
  const n = Number(s);
  return isFinite(n) && n > 0 ? n : null;
}

/** 解析销售订单/合同 rows → PriceRecord[]（卖价侧）。产品→material、卖价→unitPrice、客户→supplier。 */
export function parseSalesLedger(rows: unknown[][]): { records: PriceRecord[]; missing: string[] } {
  let headerIdx = -1;
  let col = { product: -1, price: -1, customer: -1 };
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const r = rows[i] ?? [];
    const prodC = r.findIndex((c) => matchCol(c, SALES_HEADER.product));
    const priceC = r.findIndex((c) => matchCol(c, SALES_HEADER.price));
    if (prodC >= 0 && priceC >= 0) {
      headerIdx = i;
      col = { product: prodC, price: priceC, customer: r.findIndex((c) => matchCol(c, SALES_HEADER.customer)) };
      break;
    }
  }
  if (headerIdx < 0) return { records: [], missing: ['未识别到销售表头(产品名称+单价列)'] };

  const records: PriceRecord[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const product = String(r[col.product] ?? '').trim();
    const sellPrice = toNum(r[col.price]);
    if (!product || sellPrice == null || /合计|备注|小计/.test(product)) continue;
    records.push({ material: product, spec: '', unitPrice: sellPrice, supplier: col.customer >= 0 ? String(r[col.customer] ?? '').trim() : '', date: null });
  }
  return { records, missing: records.length === 0 ? ['无可识别的销售记录'] : [] };
}

export interface MarginResult {
  product: string;
  cost: number | null;
  sell: number | null;
  profit: number | null;
  marginPct: number | null;
  customer: string;
  missing: string[];
  note: string;
}

/**
 * 毛利 = 卖价(销售价库) - 买价(采购价库/或传入BOM成本)。纯函数。
 * 缺任一侧 → 诚实标缺(待裁)，绝不编毛利。
 */
export function computeMargin(
  product: string,
  costRecords: PriceRecord[],
  salesRecords: PriceRecord[],
  asOf: string,
  bomCost?: number | null,
): MarginResult {
  const missing: string[] = [];
  // 成本：优先用传入的 BOM 成本(自制品)；否则查采购价库(外购转卖品)
  const costQ = queryPrice(costRecords, product, asOf);
  const cost = bomCost ?? costQ.recentPrice;
  if (cost == null) missing.push('买价/成本(采购价库无,需补)');

  const sellQ = queryPrice(salesRecords, product, asOf);
  const sell = sellQ.recentPrice;
  if (sell == null) missing.push('卖价(销售价库无,需补)');

  let profit: number | null = null;
  let marginPct: number | null = null;
  if (cost != null && sell != null) {
    profit = Math.round((sell - cost) * 100) / 100;
    marginPct = Math.round((profit / sell) * 1000) / 10;
  }

  const note =
    profit != null
      ? `毛利 ${profit} 元（${marginPct}%）= 卖 ${sell} − 买 ${cost}`
      : `毛利待裁：${missing.join('、')}`;
  return { product, cost, sell, profit, marginPct, customer: sellQ.supplier, missing, note };
}

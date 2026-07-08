/**
 * 礼部 · 客户经营查询引擎（sales-ledger）
 *
 * 接真数据：H盘 各部门备份/市场部/天和销售合同统计表.xlsx（真销售合同台账）。
 * 对标户部 bom-cost：真表 → 解析 → 客户聚合(成交额/次数/产品) → 客户经营视图。
 * 诚实：金额解析不出 → 记 null 不估；空台账 → 空组合，不编客户。
 *
 * 纯函数（入参已解析 rows，IO/xlsx 由适配层）→ 可单测、不碰 fs。
 */
export interface SalesContract {
  no: number;
  customer: string;
  date: string;
  contractNo: string;
  product: string;
  amount: number | null;
}

const str = (v: unknown): string => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());

/** "￥151,800 " → 151800；解析不出返 null（不估）。 */
function parseAmount(v: unknown): number | null {
  const raw = String(v ?? '').replace(/[￥¥,，\s]/g, '');
  const m = raw.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** 解析销售合同表：定位表头，逐行取；客户名跨行为空则向下填充（同客户多合同）。 */
export function parseSalesContracts(rows: unknown[][]): SalesContract[] {
  let h = -1;
  const col: Record<string, number> = {};
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const row = (rows[i] ?? []).map(str);
    const find = (re: RegExp) => row.findIndex((c) => re.test(c));
    const cust = find(/客户/);
    const amt = find(/金额|合同额|总额/);
    if (cust >= 0 && amt >= 0) {
      h = i;
      col.customer = cust;
      col.amount = amt;
      col.date = find(/日期|签订/);
      col.contractNo = find(/合同编号|合同号|编号/);
      col.product = find(/产品/);
      break;
    }
  }
  if (h < 0) return [];

  const out: SalesContract[] = [];
  let lastCustomer = '';
  for (let i = h + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const amount = parseAmount(row[col.amount]);
    const customerCell = str(row[col.customer]);
    const product = col.product >= 0 ? str(row[col.product]) : '';
    // 跳过纯空行（无金额且无产品）
    if (amount == null && !product) continue;
    if (customerCell) lastCustomer = customerCell; // 向下填充
    out.push({
      no: out.length + 1,
      customer: lastCustomer,
      date: col.date >= 0 ? str(row[col.date]) : '',
      contractNo: col.contractNo >= 0 ? str(row[col.contractNo]) : '',
      product,
      amount,
    });
  }
  return out;
}

export interface CustomerAccount {
  customer: string;
  contractCount: number;
  totalAmount: number;
  products: string[];
}

export interface SalesPortfolio {
  contracts: SalesContract[];
  customers: CustomerAccount[];
  summary: { contractCount: number; totalAmount: number; customerCount: number };
}

/** 合同 → 客户聚合（成交额降序，看大客户优先）。 */
export function buildSalesPortfolio(contracts: SalesContract[]): SalesPortfolio {
  const byCustomer = new Map<string, CustomerAccount>();
  for (const c of contracts) {
    const key = c.customer || '（未署名客户）';
    const acc = byCustomer.get(key) ?? { customer: key, contractCount: 0, totalAmount: 0, products: [] };
    acc.contractCount += 1;
    acc.totalAmount += c.amount ?? 0;
    if (c.product && !acc.products.includes(c.product)) acc.products.push(c.product);
    byCustomer.set(key, acc);
  }
  const customers = [...byCustomer.values()].sort((a, b) => b.totalAmount - a.totalAmount);
  const totalAmount = contracts.reduce((s, c) => s + (c.amount ?? 0), 0);
  return {
    contracts,
    customers,
    summary: { contractCount: contracts.length, totalAmount, customerCount: customers.length },
  };
}

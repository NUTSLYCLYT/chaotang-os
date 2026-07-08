/**
 * 户部 · 采购价库（2026-06-28）
 *
 * 从真采购台账(物料/单价/日期/供应商)抽真价 → BOM 自动填真成本。让户部成本变"真"的地基。
 * 天才设计：
 *   ① 时效衰减灯：电芯价剧烈波动，每个价按日期标 🟢近3月/🟡3-12月/🔴超1年(可能已变)，不拿旧价当真。
 *   ② 同料多价 → 给区间+趋势(min-max + 最近价)，揭示涨没涨、议价空间，不给孤立数误导。
 *   ③ 模糊匹配 + 命中度：BOM"电芯" vs 台账"LFP32Ah电芯"按关键词匹配，匹配不到→缺证(不估)。
 * 纯函数本地，数据不外传。来源链(供应商+日期+台账)可追溯(Schneier)。
 */

export interface PriceRecord {
  material: string;
  spec: string;
  unitPrice: number;
  supplier: string;
  /** ISO 日期(YYYY-MM-DD)；台账缺日期则 null。 */
  date: string | null;
}

const HEADER_KEYS = {
  // 精确:不用裸"名称"(会误匹配"供应商名称")。
  material: ['物料名称', '品名', '料品'],
  spec: ['型号规格', '规格', '品牌', '描述'],
  price: ['单价', '采购单价'],
  qty: ['采购数量', '数量'],
  supplier: ['供应商名称', '供应商', '厂家'],
  date: ['采购日期', '日期', '下单日期'],
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

/** Excel 序列日期 → ISO(YYYY-MM-DD)。Excel: 25569 = 1970-01-01。 */
export function excelDateToISO(v: unknown): string | null {
  const n = typeof v === 'number' ? v : Number(String(v ?? ''));
  if (!isFinite(n) || n < 1 || n > 100000) {
    // 也容忍已是 "2024-01-02" / "2024/1/2" 文本
    const s = String(v ?? '').trim();
    const m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    return null;
  }
  const ms = (n - 25569) * 86400000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** 解析采购台账 rows → PriceRecord[]。按表头关键词鲁棒定位列。 */
export function parsePriceLedger(rows: unknown[][]): { records: PriceRecord[]; missing: string[] } {
  let headerIdx = -1;
  let col = { material: -1, spec: -1, price: -1, supplier: -1, date: -1 };
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const r = rows[i] ?? [];
    const matC = r.findIndex((c) => matchCol(c, HEADER_KEYS.material));
    const priceC = r.findIndex((c) => matchCol(c, HEADER_KEYS.price));
    if (matC >= 0 && priceC >= 0) {
      headerIdx = i;
      col = {
        material: matC,
        spec: r.findIndex((c) => matchCol(c, HEADER_KEYS.spec)),
        price: priceC,
        supplier: r.findIndex((c) => matchCol(c, HEADER_KEYS.supplier)),
        date: r.findIndex((c) => matchCol(c, HEADER_KEYS.date)),
      };
      break;
    }
  }
  if (headerIdx < 0) return { records: [], missing: ['未识别到采购台账表头(物料名称+单价列)'] };

  const records: PriceRecord[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const material = String(r[col.material] ?? '').trim();
    const unitPrice = toNum(r[col.price]);
    if (!material || unitPrice == null) continue;
    records.push({
      material,
      spec: col.spec >= 0 ? String(r[col.spec] ?? '').trim() : '',
      unitPrice,
      supplier: col.supplier >= 0 ? String(r[col.supplier] ?? '').trim() : '',
      date: col.date >= 0 ? excelDateToISO(r[col.date]) : null,
    });
  }
  return { records, missing: records.length === 0 ? ['台账无可识别的采购记录'] : [] };
}

export type Freshness = 'fresh' | 'aging' | 'stale' | 'unknown';

/** 时效灯：date vs asOf。<3月🟢fresh / 3-12月🟡aging / >1年🔴stale / 无日期unknown。 */
export function priceFreshness(date: string | null, asOf: string): Freshness {
  if (!date) return 'unknown';
  const d = new Date(date).getTime();
  const now = new Date(asOf).getTime();
  if (isNaN(d) || isNaN(now)) return 'unknown';
  const months = (now - d) / (1000 * 60 * 60 * 24 * 30);
  if (months < 3) return 'fresh';
  if (months <= 12) return 'aging';
  return 'stale';
}

export interface PriceQuery {
  matched: boolean;
  material: string;
  /** 最近一次采购单价（决策用这个）。 */
  recentPrice: number | null;
  recentDate: string | null;
  freshness: Freshness;
  /** 同料多价区间。 */
  range: { min: number; max: number } | null;
  /** 趋势:最近 vs 最早。 */
  trend: 'up' | 'down' | 'flat' | 'single' | null;
  supplier: string;
  recordCount: number;
  note: string;
}

/** 从规格文本抽判别 token：容量(32ah)/电压(60v)/化学(lfp/磷酸铁锂/三元)/串数(20串)。 */
export function extractSpecTokens(spec: string): string[] {
  const s = (spec || '').toLowerCase().replace(/\s/g, '');
  const tokens: string[] = [];
  const cap = s.match(/(\d+(?:\.\d+)?)a?h/);
  if (cap) tokens.push(`${cap[1]}ah`);
  const volt = s.match(/(\d+(?:\.\d+)?)v/);
  if (volt) tokens.push(`${volt[1]}v`);
  for (const chem of ['磷酸铁锂', 'lfp', '三元', 'ncm', 'nca', '钛酸锂', 'lto']) if (s.includes(chem)) tokens.push(chem);
  const series = s.match(/(\d+)串/) || s.match(/(\d+)s(?!\d)/);
  if (series) tokens.push(`${series[1]}串`);
  return tokens;
}

export interface SmartPriceQuery {
  matched: boolean;
  recordCount: number;
  /** 稳健价：规格匹配 + 剔离群后的中位数（决策用这个）。 */
  robustPrice: number | null;
  recentDate: string | null;
  freshness: Freshness;
  range: { min: number; max: number } | null;
  /** 剔掉的离群价（打样/开发费/赠送等极端值）。 */
  outliers: number[];
  supplier: string;
  /** 引擎拿不准 → 需人一键裁（看板）。 */
  needsHumanRuling: boolean;
  ruleReason: string | null;
  note: string;
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * 流水线查价（规格匹配 → 剔离群 → 标待裁）。天才设计①③④落地为确定性引擎：
 *   1. 规格匹配：specHint 有容量/化学/电压 token → 收窄到对型号的记录（13.6元的小电芯被过滤）。
 *   2. 剔离群：中位数±5倍外的(打样/开发费/赠送)剔除，给稳健价。
 *   3. 标待裁：剔离群后仍跨度大/多规格 → needsHumanRuling=true，进看板待人一键裁(不静默猜)。
 * 纯函数本地。
 */
export function queryPriceSmart(records: PriceRecord[], materialName: string, specHint: string, asOf: string): SmartPriceQuery {
  const key = materialName.replace(/\s/g, '');
  let hits = records.filter((r) => {
    const m = r.material.replace(/\s/g, '');
    return m.includes(key) || key.includes(m);
  });
  if (hits.length === 0) {
    return { matched: false, recordCount: 0, robustPrice: null, recentDate: null, freshness: 'unknown', range: null, outliers: [], supplier: '', needsHumanRuling: false, ruleReason: null, note: `台账没找到「${materialName}」→ 缺证` };
  }
  // 1. 规格匹配：容量(Xah)是最强判别——有容量要求则必须容量匹配(磷酸铁锂18650≠LFP32Ah)；否则任一token命中。
  const tokens = extractSpecTokens(specHint);
  const capToken = tokens.find((t) => t.endsWith('ah'));
  let specRequestedButMissing = false;
  if (tokens.length) {
    const specHits = hits.filter((h) => {
      const text = (h.material + h.spec).toLowerCase().replace(/\s/g, '');
      return capToken ? text.includes(capToken) : tokens.some((t) => text.includes(t));
    });
    if (specHits.length) hits = specHits;
    else specRequestedButMissing = true; // 要了规格但台账没有 → 别静默退回错型号(人是裁判)
  }
  // 2. 剔离群：中位数 ±5 倍外（打样/开发费/赠送）
  const med = median(hits.map((h) => h.unitPrice));
  const clean = hits.filter((h) => h.unitPrice >= med / 5 && h.unitPrice <= med * 5);
  const outliers = hits.filter((h) => !clean.includes(h)).map((h) => h.unitPrice);
  const pool = clean.length ? clean : hits;
  const cleanPrices = pool.map((h) => h.unitPrice);
  const robustPrice = Math.round(median(cleanPrices) * 100) / 100;
  // 取最近一笔 clean 记录的日期/供应商
  const datedClean = pool.filter((h) => h.date).sort((a, b) => (a.date! < b.date! ? 1 : -1));
  const recent = datedClean[0] ?? pool[0];
  const fresh = priceFreshness(recent.date, asOf);
  // 3. 标待裁：①要了规格台账却没有(命中的是别的型号,价不可用) ②剔离群后仍跨度>3倍 ③没给规格但多种价
  const spread = Math.max(...cleanPrices) / Math.max(1, Math.min(...cleanPrices));
  const needsHumanRuling = specRequestedButMissing || spread > 3;
  const ruleReason = !needsHumanRuling
    ? null
    : specRequestedButMissing
      ? `台账无「${specHint}」规格的采购记录(命中的是其他型号,此价${robustPrice}元不可当该规格成本)，需补该规格采购价`
      : tokens.length
        ? `该规格仍有 ${pool.length} 种价(${Math.min(...cleanPrices)}-${Math.max(...cleanPrices)}元)，需指定`
        : `「${materialName}」有多种规格/价，未给规格无法定，需指定型号`;
  const freshCn = fresh === 'fresh' ? '🟢近期' : fresh === 'aging' ? '🟡3-12月' : fresh === 'stale' ? '🔴超1年' : '⚪无日期';
  return {
    matched: true,
    recordCount: hits.length,
    robustPrice,
    recentDate: recent.date,
    freshness: fresh,
    range: { min: Math.min(...cleanPrices), max: Math.max(...cleanPrices) },
    outliers,
    supplier: recent.supplier,
    needsHumanRuling,
    ruleReason,
    note: `${freshCn} 稳健价 ${robustPrice}元${outliers.length ? `（剔${outliers.length}个离群:${outliers.slice(0, 3).join('/')}）` : ''}${needsHumanRuling ? ' ⚠️需你定规格' : ''}`,
  };
}

/** 查一个物料的真采购价（模糊匹配 + 时效灯 + 多价区间 + 趋势）。纯函数。 */
export function queryPrice(records: PriceRecord[], materialName: string, asOf: string): PriceQuery {
  const key = materialName.replace(/\s/g, '');
  const hits = records.filter((r) => {
    const m = r.material.replace(/\s/g, '');
    return m.includes(key) || key.includes(m) || (r.spec && (key.includes(r.spec.replace(/\s/g, '')) || r.spec.replace(/\s/g, '').includes(key)));
  });
  if (hits.length === 0) {
    return { matched: false, material: materialName, recentPrice: null, recentDate: null, freshness: 'unknown', range: null, trend: null, supplier: '', recordCount: 0, note: `采购台账里没找到「${materialName}」→ 缺证，需补该料采购价` };
  }
  const dated = hits.filter((h) => h.date).sort((a, b) => (a.date! < b.date! ? 1 : -1)); // 新→旧
  const recent = dated[0] ?? hits[0];
  const prices = hits.map((h) => h.unitPrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const oldest = dated[dated.length - 1] ?? recent;
  const trend: PriceQuery['trend'] = dated.length < 2 ? 'single' : recent.unitPrice > oldest.unitPrice * 1.03 ? 'up' : recent.unitPrice < oldest.unitPrice * 0.97 ? 'down' : 'flat';
  const fresh = priceFreshness(recent.date, asOf);
  const freshCn = fresh === 'fresh' ? '🟢近期价' : fresh === 'aging' ? '🟡3-12月价' : fresh === 'stale' ? '🔴超1年·可能已变' : '⚪无日期';
  const rangeStr = min === max ? `${min}元` : `${min}-${max}元`;
  const trendStr = trend === 'up' ? '·价在涨' : trend === 'down' ? '·价在跌' : '';
  return {
    matched: true,
    material: materialName,
    recentPrice: recent.unitPrice,
    recentDate: recent.date,
    freshness: fresh,
    range: { min, max },
    trend,
    supplier: recent.supplier,
    recordCount: hits.length,
    note: `${freshCn} 最近 ${recent.unitPrice}元（${rangeStr}${trendStr}，${hits.length}笔，供应商:${recent.supplier || '—'}）`,
  };
}

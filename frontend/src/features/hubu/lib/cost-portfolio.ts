/**
 * 户部 · 成本数据管道（cost-portfolio）
 *
 * 把"指一个文件夹 → 批量出真成本 + 御史巡查"的手工链，收编成真函数（2026-07-01）。
 * 一条真链的函数化：BOM rows → parseBomRows(真成本) → assessCostSanity(御史巡查) → 分类聚合。
 *
 * 纯函数（入参已解析的 rows，IO/xlsx 由薄适配层负责）→ 可单测、不碰 fs、不碰坏 dev。
 * 诚实：缺价 → uncosted（不估）；命脉非电芯 → flagged（疑模具费污染）；干净 → clean。
 */
import { parseBomRows, type BomCost } from './bom-cost';
import { assessCostSanity, costSanityVerdict, splitNreFromCost, type CostSanityLevel, type CostSanityFinding } from './cost-sanity';

export interface CostPortfolioEntry {
  file: string;
  product: string;
  totalCost: number | null;
  topDriver: string | null;
  driverPct: number | null;
  lineCount: number;
  missing: string[];
  sanity: CostSanityLevel;
  findings: CostSanityFinding[];
  /** 剥掉一次性费(模具/工装)后的真单台料本；无 NRE 时 = totalCost。 */
  unitCostExNre: number | null;
  /** 被剥出的一次性费合计。 */
  nreCost: number;
  /** 剥 NRE 后命脉仍非电芯 = 含糊/数据错，需人工核（不硬猜）。 */
  stillSuspect: boolean;
}

export interface CostPortfolio {
  entries: CostPortfolioEntry[];
  /** 已核出成本 + 御史 ok（可信，可直接作报价底座）。 */
  clean: CostPortfolioEntry[];
  /** 已核出成本但御史 flag/warn（疑模具费污染/离谱，需复核）。 */
  flagged: CostPortfolioEntry[];
  /** 缺价未核定（户部不估）。 */
  uncosted: CostPortfolioEntry[];
  summary: { total: number; costed: number; clean: number; flagged: number; uncosted: number };
}

/** 单个 BOM：解析真成本 + 御史巡查。 */
export function assessBom(file: string, product: string, rows: unknown[][]): CostPortfolioEntry {
  const cost: BomCost = parseBomRows(rows, product);
  const findings = assessCostSanity(cost);
  const nre = splitNreFromCost(cost);
  return {
    file,
    product,
    totalCost: cost.totalCost,
    topDriver: cost.topCostDriver?.name ?? null,
    driverPct: cost.topCostDriver?.pct ?? null,
    lineCount: cost.lines.length,
    missing: cost.missing,
    // 未核定不评（assessCostSanity 返回空）→ 归 uncosted，成色记 'ok' 占位（不参与 clean/flagged 判定）
    sanity: cost.totalCost == null ? 'ok' : costSanityVerdict(findings),
    findings,
    unitCostExNre: nre.unitCost,
    nreCost: nre.nreCost,
    stillSuspect: nre.stillSuspect,
  };
}

/** 批量：一摞 BOM → 组合报告（可信/待复核/未核定 三分）。 */
export function buildCostPortfolio(boms: Array<{ file: string; product: string; rows: unknown[][] }>): CostPortfolio {
  const entries = boms.map((b) => assessBom(b.file, b.product, b.rows));
  const costed = entries.filter((e) => e.totalCost != null);
  const uncosted = entries.filter((e) => e.totalCost == null);
  const clean = costed.filter((e) => e.sanity === 'ok');
  const flagged = costed.filter((e) => e.sanity !== 'ok');
  // 可信降序（成本高到低），便于报价优先看大单
  clean.sort((a, b) => (b.totalCost ?? 0) - (a.totalCost ?? 0));
  flagged.sort((a, b) => (b.totalCost ?? 0) - (a.totalCost ?? 0));
  return {
    entries,
    clean,
    flagged,
    uncosted,
    summary: { total: entries.length, costed: costed.length, clean: clean.length, flagged: flagged.length, uncosted: uncosted.length },
  };
}

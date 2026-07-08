/**
 * 锦衣卫·内查司 · 巡城兵#1 — 成本合理性巡查（cost-sanity）
 *
 * 御史台监察制衡体系 ①层（巡城·守卫·确定性·零 LLM）。固化 2026-07-01 真抓到的病：
 * 真跑 63 个 H 盘带价 BOM，37 个"单台成本"被电池盒/模具费盖过电芯——一次性费(NRE/模具)
 * 误计入单台料本 → 单台虚高(¥94,529/台)→ 按此报价系统性高估、巨亏。
 *
 * 本巡查只**采证 + 评级，不定性**（铁律：侦查/审判分离，定性归御史台）。纯函数、可单测。
 */
import type { BomCost } from './bom-cost';

export type CostSanityLevel = 'ok' | 'warn' | 'flag';

export interface CostSanityFinding {
  level: CostSanityLevel;
  code: string;
  message: string;
}

/** 电芯命脉关键词（电池单台成本命脉理应在此）。 */
const CELL_HINTS = ['电芯', '电池芯', 'cell', '磷酸铁锂', '铁锂', '三元', '锂电'];
/** 一次性费（NRE/模具）关键词——应按套数摊销，不入单台料本。 */
const NRE_HINTS = ['模具', '工装', '治具', 'NRE', '一次性', '开发费', '打样', '样品费', '开模'];

const hit = (name: string, hints: string[]): boolean => hints.some((h) => name.includes(h));

/**
 * 巡查一份已核定的 BOM 成本，返回异动证据（御史据此断罪）。
 * 未核定（缺价）不评——巡城兵不对没数的事说话。
 */
export function assessCostSanity(cost: Pick<BomCost, 'totalCost' | 'topCostDriver' | 'breakdown'>): CostSanityFinding[] {
  if (cost.totalCost == null) return [];
  const findings: CostSanityFinding[] = [];
  const driver = cost.topCostDriver;

  // ① 命脉非电芯 → 疑一次性费污染（本轮真抓到的主病）
  if (driver && !hit(driver.name, CELL_HINTS)) {
    const looksNre = hit(driver.name, NRE_HINTS);
    findings.push({
      level: 'flag',
      code: 'driver_not_cell',
      message: `成本命脉是「${driver.name}」(${driver.pct}%)非电芯——电池单台成本命脉理应是电芯。${
        looksNre ? '疑一次性费(模具/NRE)误计入单台料本，' : '疑数据异常或一次性费混入，'
      }单台成本恐虚高，按此报价将系统性高估。御史拦，转采购司核「一次性费按套数摊销、不入单台」。`,
    });
  }

  // ② 显式一次性费行混入单台
  const nreLines = (cost.breakdown ?? []).filter((b) => hit(b.name, NRE_HINTS));
  if (nreLines.length) {
    findings.push({
      level: 'warn',
      code: 'nre_in_unit',
      message: `检出 ${nreLines.length} 项一次性费（${nreLines.map((l) => l.name).join('、')}）计入了单台料本，应按套数摊销。`,
    });
  }

  // ③ 单台料本离谱偏高（电池单台料本极少 > 2 万；粗判，提示人工复核）
  if (cost.totalCost > 20000) {
    findings.push({
      level: 'warn',
      code: 'cost_outlier',
      message: `单台料本 ¥${Math.round(cost.totalCost).toLocaleString('zh-CN')} 异常偏高，御史建议人工复核（是否含一次性费 / 单位错 / 整批当单台）。`,
    });
  }

  return findings.length ? findings : [{ level: 'ok', code: 'sane', message: '成本结构合理：电芯为命脉、无显式一次性费混入。' }];
}

/** 一句话总评（给奏折/列表用）。flag > warn > ok。 */
export function costSanityVerdict(findings: CostSanityFinding[]): CostSanityLevel {
  if (findings.some((f) => f.level === 'flag')) return 'flag';
  if (findings.some((f) => f.level === 'warn')) return 'warn';
  return 'ok';
}

export interface NreSplit {
  /** 剥掉一次性费后的真单台料本（模具/工装应按套数摊销、不入单台）。 */
  unitCost: number | null;
  /** 被剥出的一次性费合计。 */
  nreCost: number;
  /** 被剥出的一次性费行。 */
  nreLines: Array<{ name: string; amount: number }>;
  /** 剥后单台成本结构（降序），命脉据此重判。 */
  unitBreakdown: Array<{ name: string; amount: number; pct: number }>;
  topUnitDriver: { name: string; pct: number } | null;
  /** 剥后命脉仍非电芯 = 含糊项/数据错，只能人工核（不硬猜）。 */
  stillSuspect: boolean;
}

/**
 * 根治#2：把**明确标注的一次性费**（模具/工装/开模…）从单台料本剥出来，还原真单台成本。
 * 诚实边界：只剥命中 NRE 关键词的行；含糊项（如"电池盒"未标是否模具）**不硬猜**——
 * 剥后命脉若仍非电芯，标 stillSuspect，交御史/人工核，绝不替用户判定。
 */
export function splitNreFromCost(cost: Pick<BomCost, 'totalCost' | 'breakdown'>): NreSplit {
  const breakdown = cost.breakdown ?? [];
  const nreLines = breakdown.filter((b) => hit(b.name, NRE_HINTS)).map((b) => ({ name: b.name, amount: b.amount }));
  const nreCost = Math.round(nreLines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  if (cost.totalCost == null) {
    return { unitCost: null, nreCost: 0, nreLines: [], unitBreakdown: [], topUnitDriver: null, stillSuspect: false };
  }
  const unitLines = breakdown.filter((b) => !hit(b.name, NRE_HINTS));
  const unitCost = Math.round((cost.totalCost - nreCost) * 100) / 100;
  const unitBreakdown = unitCost > 0
    ? unitLines
        .map((b) => ({ name: b.name, amount: b.amount, pct: Math.round((b.amount / unitCost) * 1000) / 10 }))
        .sort((a, b) => b.amount - a.amount)
    : [];
  const topUnitDriver = unitBreakdown.length ? { name: unitBreakdown[0].name, pct: unitBreakdown[0].pct } : null;
  const stillSuspect = topUnitDriver != null && !hit(topUnitDriver.name, CELL_HINTS);
  return { unitCost, nreCost, nreLines, unitBreakdown, topUnitDriver, stillSuspect };
}

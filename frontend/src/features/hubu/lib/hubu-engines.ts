/**
 * 户部 · 三引擎（ROI / 风险敞口 / 优先级评分 → 四裁决）· 纯函数 · 2026-06-27
 *
 * 来源：`docs/legacy-os-reference/HUBU_BUDGET_PLATFORM_DESIGN.md` §4-5 的三引擎/四裁决，
 * 移植为本仓纯函数（legacy 实现在 chaotang-os，不在本仓，故新建非平行 SSOT）。
 *
 * 命门纪律（trustworthy by construction）：
 *   - 有输入 → 算真值；缺输入 → **不编数字**，进 `missing` 显性缺证，裁决自然落「缓议补证」。
 *   - 每个数字配一句人话注解（随卡教学，grounded 在该卡真数据上）。
 *   - 纯函数无副作用 → 前端可算（咨询）；触碰真实付款/报价 → 转后端 jiqun(铁律9)。
 */
import type { FinanceRiskLevel, HubuProject } from '@/lib/contracts/hubu';

export type HubuVerdict = 'approve' | 'adjust' | 'hold' | 'reject';

export const HUBU_VERDICT_CN: Record<HubuVerdict, string> = {
  approve: '准奏',
  adjust: '削减分阶段',
  hold: '缓议补证',
  reject: '驳回',
};

const RISK_COEFF: Record<FinanceRiskLevel, number> = { low: 0.2, medium: 0.5, high: 0.8, critical: 1 };
const RISK_CN: Record<FinanceRiskLevel, string> = { low: '低', medium: '中', high: '高', critical: '紧急' };

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/** "120 万"/"120万"/裸数字(元) → 元；不可解析(含"—") → null。 */
export function parseWan(s: string | null | undefined): number | null {
  if (!s) return null;
  const wan = s.match(/([\d.]+)\s*万/);
  if (wan) return Math.round(parseFloat(wan[1]) * 10000);
  const bare = s.trim().match(/^([\d.]+)$/);
  const n = bare ? parseFloat(bare[1]) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** "2.3x" → 2.3（回报倍数）；"22%" → 1.22；"—" → null。 */
export function parseRoiMultiple(s: string | null | undefined): number | null {
  if (!s) return null;
  const x = s.match(/([\d.]+)\s*x/i);
  if (x) return parseFloat(x[1]);
  const pct = s.match(/([\d.]+)\s*%/);
  if (pct) return 1 + parseFloat(pct[1]) / 100;
  return null;
}

/** 回报倍数 → 0-100 归一（3x 满分）。 */
function roiNormFrom(roiMultiple: number): number {
  return Math.round(clamp(roiMultiple / 3, 0, 1) * 100);
}

export type HubuQuadrant = 'prefer' | 'caution' | 'watch' | 'reject';

export const HUBU_QUADRANT: Record<HubuQuadrant, { label: string; color: string }> = {
  prefer: { label: '绿·优先投', color: '#5FB97A' },
  caution: { label: '黄·谨慎', color: '#E5B84D' },
  watch: { label: '灰·观望', color: '#8B93A7' },
  reject: { label: '红·否决', color: '#E5604D' },
};

/** ROI×风险四象限分类：高回报=roiNorm≥50，高风险=敞口≥50。缺数据→null（不臆造）。 */
export function quadrantOf(roiMultiple: number | null, exposure: number | null): HubuQuadrant | null {
  if (roiMultiple === null || exposure === null) return null;
  const highRoi = roiNormFrom(roiMultiple) >= 50;
  const highRisk = exposure >= 50;
  if (highRoi && !highRisk) return 'prefer';
  if (highRoi && highRisk) return 'caution';
  if (!highRoi && !highRisk) return 'watch';
  return 'reject';
}

/** 单向门关键词（贝索斯）：不可逆/巨额代价的承诺，须人工亲裁（铁律13.2.5）。 */
const ONE_WAY_KEYWORDS = ['预付', '独家', '违约金', '对外报价', '对外承诺', '供应商锁定', '保证金', '定金', '不可撤', '买断', '垫资'];

export interface OneWayDoor {
  oneWay: boolean;
  reasons: string[];
}

/** 检测单向门：命中不可逆关键词，或大额(≥100万)。 */
export function detectOneWayDoor(p: HubuProject): OneWayDoor {
  const text = `${p.title} ${p.command}`;
  const reasons = ONE_WAY_KEYWORDS.filter((k) => text.includes(k));
  const budget = parseWan(p.requested_budget);
  if (budget !== null && budget >= 1_000_000) reasons.push('大额(≥100万)');
  return { oneWay: reasons.length > 0, reasons };
}

export interface HubuEvaluation {
  budgetYuan: number | null;
  roiMultiple: number | null;
  /** 风险敞口 0-100（预算规模 × 风险系数）；缺预算则 null。 */
  exposure: number | null;
  /** 优先级评分 0-100；缺回报或预算则 null。 */
  score: number | null;
  verdict: HubuVerdict;
  verdictCn: string;
  /** ROI×风险四象限分类（缺数据→null）。 */
  quadrant: HubuQuadrant | null;
  /** 单向门（不可逆/大额）→ 须人工亲裁。 */
  oneWayDoor: OneWayDoor;
  /** 缺哪些证据（显性，禁静默）。 */
  missing: string[];
  /** 现金压力/缺口显形：小老板最致命的是现金断流，不能埋在文本里（压测抓出）。 */
  cashStress: boolean;
  cashNote: string | null;
  /** 质检/防幻觉显形：N 项有据 / M 项缺证；引擎确定性、缺则标缺、绝不编。 */
  quality: { grounded: number; total: number; missing: number };
  /** 随卡注解：字段 → 一句人话（grounded 在真数字上）。 */
  explain: { roi: string; exposure: string; score: string; verdict: string };
}

/** 现金压力关键词（出现即认现金吃紧/缺口，红字顶前，不替老板埋雷）。 */
const CASH_STRESS_RE = /缺|不够|不足|吃紧|紧张|付不起|垫|周转|压力|要借|要贷|贷款|分期/;

/** 裁决规则（legacy §5）：评分+敞口 → 四裁决；缺关键输入 → hold(缓议补证)。 */
function recommendVerdict(score: number | null, exposure: number | null, roi: number | null): HubuVerdict {
  if (score === null || exposure === null) return 'hold';
  if (roi !== null && roi <= 1) return 'reject'; // 回报 ≤ 1x 即不赚
  if (score >= 75 && exposure < 50) return 'approve';
  if (score >= 60) return 'adjust';
  if (score >= 40 || exposure > 70) return 'hold';
  return 'reject';
}

export function evaluateProject(p: HubuProject): HubuEvaluation {
  const budgetYuan = parseWan(p.requested_budget);
  const roiMultiple = parseRoiMultiple(p.estimated_roi);
  const riskCoeff = RISK_COEFF[p.risk_level];
  const riskCn = RISK_CN[p.risk_level];

  const missing: string[] = [];
  if (budgetYuan === null) missing.push('预算金额');
  if (roiMultiple === null) missing.push('预期回报/ROI');
  if (!p.cash_flow_pressure || p.cash_flow_pressure === '—') missing.push('现金流影响');

  // 现金压力显形：填了现金状况且含吃紧/缺口关键词 → 红字顶前(小老板最致命的是现金断流)。
  const cashFilled = !!p.cash_flow_pressure && p.cash_flow_pressure !== '—';
  const cashStress = cashFilled && CASH_STRESS_RE.test(p.cash_flow_pressure);
  const cashNote = cashStress ? `现金压力：${p.cash_flow_pressure}` : null;
  // 质检/防幻觉显形：3 项核心数据(预算/回报/现金)有几项有据。引擎缺则标缺、绝不编。
  const quality = { grounded: 3 - missing.length, total: 3, missing: missing.length };

  // 风险敞口：预算规模(100万=满刻度) × 风险系数 × 100
  const exposure =
    budgetYuan === null ? null : Math.round(clamp(budgetYuan / 1_000_000, 0, 1) * riskCoeff * 100);

  // 回报归一：3x 满分
  const roiNorm = roiMultiple === null ? null : Math.round(clamp(roiMultiple / 3, 0, 1) * 100);

  // 优先级评分：0.4·回报 + 0.3·战略(缺→中性50) + 0.3·(100−敞口)
  const STRATEGIC_NEUTRAL = 50;
  const score =
    roiNorm === null || exposure === null
      ? null
      : Math.round(0.4 * roiNorm + 0.3 * STRATEGIC_NEUTRAL + 0.3 * (100 - exposure));

  const verdict = recommendVerdict(score, exposure, roiMultiple);
  const verdictCn = HUBU_VERDICT_CN[verdict];

  const verdictReason =
    verdict === 'approve'
      ? `评分${score}≥75 且敞口${exposure}<50，可按申请批`
      : verdict === 'adjust'
        ? `评分${score} 中上，建议削减预算或分阶段放行`
        : verdict === 'reject'
          ? roiMultiple !== null && roiMultiple <= 1
            ? `回报 ${roiMultiple}x ≤ 1，本就不赚`
            : `评分${score} 过低`
          : missing.length
            ? `缺${missing.join('、')}，先补证再议`
            : `评分${score}/敞口${exposure} 处中段，须补论证`;

  return {
    budgetYuan,
    roiMultiple,
    exposure,
    score,
    verdict,
    verdictCn,
    quadrant: quadrantOf(roiMultiple, exposure),
    oneWayDoor: detectOneWayDoor(p),
    missing,
    cashStress,
    cashNote,
    quality,
    explain: {
      roi:
        roiMultiple === null
          ? 'ROI 缺证：命令里没给预期回报，无法核算（户部不替你猜）'
          : `回报 ${roiMultiple}x（>1 即赚）→ 折算 ${roiNorm}/100，3x 为满分`,
      exposure:
        exposure === null
          ? '敞口缺证：预算金额未知，无法量风险'
          : `敞口 ${exposure} = 预算规模 × 风险(${riskCn})；<50 可控、>70 危险`,
      score:
        score === null
          ? '评分缺证：回报或预算缺失，无法定优先级'
          : `评分 ${score} = 0.4·回报 + 0.3·战略 + 0.3·(100−敞口)`,
      verdict: `${verdictCn}：${verdictReason}`,
    },
  };
}

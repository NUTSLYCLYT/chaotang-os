/**
 * 钦天监 · 死法地图适配器（纯函数 · 2026-06-27）
 *
 * 把决策卡的真信号映射成 ruin 敞口，喂给钦天监引擎 `assessRuin`（SSOT，铁律2/9：
 * 不在此重写承保人逻辑，只做「决策字段 → RuinExposure」的纯映射）。
 *
 * 设计源：钦天监是承保人不是算命的——只认「亏不起/框不住/传得开」三条不可逆红线，
 * 命中即一票否决（不看期望收益多漂亮，tail-audit.ts §死法地图）。
 *
 * 真数据：红线信号全部来自决策卡已抽出的真字段（兵部 terms/预付、户部 risk），不编。
 */
import { assessRuin, type RuinAssessment } from '@/core/courtos/qintian/tail-audit';
import type { BingbuSalesItem } from '@/lib/contracts/bingbu-sales';
import type { HubuProject } from '@/lib/contracts/hubu';

/** 销售事项 → 死法地图判定。红线取自 sales-extract 已抽的真条款/风险。 */
export function ruinForSalesItem(item: BingbuSalesItem): RuinAssessment {
  const hasPenalty = item.terms.includes('违约金');
  const hasExclusive = item.terms.includes('独家条款');
  return assessRuin([], {
    // 亏不起：仅认违约金（方向明确=我方违约即赔）。**不认"预付"**——会审 HIGH：
    // sales-extract 的 prepayment 不分方向，"客户预付给我方"是利好却会被误判死局，故剔除。
    irreversiblePayment: hasPenalty,
    // 框不住：critical 风险 = blast-radius 超阈（卡上真风险级，非编造）
    blastRadiusOverThreshold: item.risk_level === 'critical',
    // 传得开：独家锁定 = 对外不可逆承诺
    externalCommitment: hasExclusive,
  });
}

/**
 * 户部项目 → 死法地图判定（保守映射，避免给每笔预算都判否决造成噪声）。
 * 户部字段无独家/违约语义，仅据真风险级判 blast-radius；其余红线诚实留 false。
 */
export function ruinForHubuProject(p: HubuProject): RuinAssessment {
  return assessRuin([], {
    irreversiblePayment: false,
    blastRadiusOverThreshold: p.risk_level === 'critical',
    externalCommitment: false,
  });
}

export interface RuinBadge {
  veto: boolean;
  /** 命中的红线（中文，逐条）。 */
  redlines: string[];
  /** 一句话理由（来自引擎）。 */
  reason: string;
}

/** 引擎判定 → 卡片展示徽标。pass 时 veto=false（卡不显示死法地图行）。 */
export function ruinBadge(assessment: RuinAssessment): RuinBadge {
  return {
    veto: assessment.verdict === 'veto',
    // 去括号注释（"亏不起(不可逆付款/违约金)"→"亏不起"）防 compact 卡折行（会审 LOW）。
    redlines: assessment.redlinesHit.map((r) => r.replace(/\(.*?\)/g, '').trim()),
    reason: assessment.reason,
  };
}

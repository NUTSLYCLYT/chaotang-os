/**
 * 朝堂 OS · 钦天监核心原语「尾部审计 + 逆周期温度计」(server-safe 纯函数,零副作用)
 *
 * 设计依据:dev/notes/qintian-design.md(Taleb/Howard Marks/Kahneman/Andrew Ng/Munger 一致)。
 * 钦天监不是算命的,是承保人:从不预测车祸,只定费率(温度计调审查旋钮)和拒保线(死法地图一票否决)。
 * 本模块只【判定】不预测、不写库、不调模型:
 *   1. computeCycleHeat —— 逆周期温度计(5 路已发生信号→0-100→三档审查旋钮,越顺越热越紧)
 *   2. assessRuin       —— 死法地图(reverse stress test,correlation 取最坏=1,三条 ruin 红线命中即否决)
 *
 * 信号的 DB 提取与回填弧由上游负责(待主 Loop 数据拉动);本模块只吃归一化后的纯数。
 */

// ── 逆周期温度计 ───────────────────────────────────────────────────────────
/** 5 路信号,全部归一化到 0-1 的「危险度」(已由上游从真实事件流算出,不含任何前瞻预测)。 */
export interface CycleSignals {
  /** 相关性奔1:各决策依赖证据塌缩到同一信源/假设的程度(evidenceIds 重合度) */
  correlationToOne: number;
  /** 连胜危险度:史馆连续"采纳且 confirmed、零 refuted"链长的饱和危险度(用 streakToDanger 算) */
  winStreakDanger: number;
  /** 复制速度:太子裂变/方案复刻环比加速度 */
  replicationAccel: number;
  /** 估值热度:承诺回报÷参考类中位 + blast-radius 近30天爬升斜率 */
  valuationHeat: number;
  /** 缺证率倒挂:决策推进速度 vs 证据补全速度的差(信心涨得比证据快) */
  evidenceDeficit: number;
}

/** 五神交集后定的权重(相关性奔1 与 连胜 并列最高,各 25)。 */
export const SIGNAL_WEIGHTS: Record<keyof CycleSignals, number> = {
  correlationToOne: 25,
  winStreakDanger: 25,
  replicationAccel: 20,
  valuationHeat: 15,
  evidenceDeficit: 15,
};

export type CycleTier = 'normal' | 'warm' | 'hot';

/** 审查旋钮档位:温度计唯一产出(不预测涨跌,只调审查严格度)。 */
export interface ReviewKnobs {
  /** p10 地板倍数:过热自动抬高 */
  p10FloorMultiplier: number;
  /** 人工确认门是否下移一级(更早要人工) */
  manualGateShiftDown: boolean;
  /** 是否需双证 */
  requireDoubleEvidence: boolean;
  /** reverse stress test 是否转必跑 */
  forceReverseStress: boolean;
  /** 高相关敞口是否强制拆分 */
  splitHighCorrelationExposure: boolean;
}

export interface CycleHeat {
  /** 0-100 热度分 */
  score: number;
  tier: CycleTier;
  knobs: ReviewKnobs;
}

const clamp01 = (x: number): number => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);

/**
 * 连胜链长→饱和危险度(0-1)。连胜是过度自信的麻醉剂,越长越危险,但饱和(再长也封顶 1)。
 * tau=4:连胜 4 次约 0.63 危险度,8 次约 0.86。
 */
export function streakToDanger(winStreak: number, tau = 4): number {
  const n = Number.isFinite(winStreak) && winStreak > 0 ? winStreak : 0;
  return 1 - Math.exp(-n / tau);
}

function knobsForTier(tier: CycleTier): ReviewKnobs {
  switch (tier) {
    case 'hot':
      return {
        p10FloorMultiplier: 1.5,
        manualGateShiftDown: true,
        requireDoubleEvidence: true,
        forceReverseStress: true,
        splitHighCorrelationExposure: true,
      };
    case 'warm':
      return {
        p10FloorMultiplier: 1.2,
        manualGateShiftDown: true,
        requireDoubleEvidence: true,
        forceReverseStress: false,
        splitHighCorrelationExposure: false,
      };
    default:
      return {
        p10FloorMultiplier: 1.0,
        manualGateShiftDown: false,
        requireDoubleEvidence: false,
        forceReverseStress: false,
        splitHighCorrelationExposure: false,
      };
  }
}

/**
 * 逆周期温度计:5 路信号加权 → 0-100 → 三档审查旋钮。越顺(信号越高)越热,审查越紧。
 * 纯后视镜密度计,不含任何"未来/预计/将"的前瞻语义。
 */
export function computeCycleHeat(signals: CycleSignals): CycleHeat {
  const keys = Object.keys(SIGNAL_WEIGHTS) as (keyof CycleSignals)[];
  let weighted = 0;
  let totalWeight = 0;
  for (const k of keys) {
    const w = SIGNAL_WEIGHTS[k];
    weighted += clamp01(signals[k]) * w;
    totalWeight += w;
  }
  const score = totalWeight > 0 ? Math.round((weighted / totalWeight) * 100) : 0;
  const tier: CycleTier = score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'normal';
  return { score, tier, knobs: knobsForTier(tier) };
}

// ── 死法地图(reverse stress test) ─────────────────────────────────────────
/** 致死条件:一旦同时成立朝堂就死在这一项;alreadyTrue 由史馆真实事件勾选。 */
export interface DeathCondition {
  description: string;
  alreadyTrue: boolean;
}

/** 三条 ruin 红线敞口(命中任一即否决,靠后果不可逆而非概率高低)。 */
export interface RuinExposure {
  /** 亏不起:不可逆付款/违约金/预付款 */
  irreversiblePayment: boolean;
  /** 框不住:blast-radius 超阈 */
  blastRadiusOverThreshold: boolean;
  /** 传得开:对外承诺/独家锁定 */
  externalCommitment: boolean;
}

export interface RuinAssessment {
  verdict: 'veto' | 'pass';
  /** 命中的 ruin 红线 */
  redlinesHit: string[];
  /** 已成立的致死条件数 / 总数(离死多近) */
  conditionsAlreadyMet: number;
  totalConditions: number;
  reason: string;
}

/**
 * 死法地图:correlation 取最坏=1(所有致死条件视为完全相关),从 ruin 倒推。
 * 任一 ruin 红线命中即一票否决(不看期望收益多漂亮);否则 pass 但回报"离死多近"。
 */
export function assessRuin(deathConditions: DeathCondition[], exposure: RuinExposure): RuinAssessment {
  const redlinesHit: string[] = [];
  if (exposure.irreversiblePayment) redlinesHit.push('亏不起(不可逆付款/违约金)');
  if (exposure.blastRadiusOverThreshold) redlinesHit.push('框不住(blast-radius 超阈)');
  if (exposure.externalCommitment) redlinesHit.push('传得开(对外承诺/独家锁定)');

  const conditionsAlreadyMet = deathConditions.filter((c) => c.alreadyTrue).length;
  const totalConditions = deathConditions.length;
  const veto = redlinesHit.length > 0;

  return {
    verdict: veto ? 'veto' : 'pass',
    redlinesHit,
    conditionsAlreadyMet,
    totalConditions,
    reason: veto
      ? `触 ruin 红线 [${redlinesHit.join(' / ')}],一票否决(后果不可逆,不看期望收益);致死条件已成立 ${conditionsAlreadyMet}/${totalConditions}`
      : `无 ruin 红线;致死条件已成立 ${conditionsAlreadyMet}/${totalConditions}(离死越近越该备 preAction 对冲)`,
  };
}

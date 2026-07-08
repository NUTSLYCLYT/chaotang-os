/**
 * 史馆归档 → 储君考绩 adapter(P2 · 2026-07-01)
 *
 * 把史馆已归档 + 兑现回填的真案,映射成 CrownPrinceCaseRecord 喂就绪度仪表。
 * 数据源:listArchives()(courtos-decision-store)返回的完整 archive_json。
 *
 * 诚实关键(deming/russell):史馆存的是**军机处 verdict**,不是太子自预测 →
 * 一律标 predictorSource='court'(只填案量+灰显系统校准基线,绝不计入册封一致率)。
 * 四使致命旗标 + 认错字段史馆没有 → 历史回灌恒 false(占位,太子上线自治后才由真信号覆盖)。
 *
 * 纯函数,确定性,可单测(铁律4)。真接线点=listArchives();此处只做映射。
 */

import type { CrownPrinceCaseRecord, RiskClass } from './crown-prince-track-record.ts';

/** listArchives() 一条记录的最小可用形状(容忍缺字段)。 */
export interface ShiguanArchiveInput {
  id: string;
  /** '达成' | '未达成' | '部分' | 'not_started' | null。 */
  retrospective_status?: string | null;
  archive?: {
    learning_record?: { verdict?: string; overallSignal?: string } | null;
    risk_flags?: string[] | null;
  } | null;
}

/** 不可逆类 risk_flag(碰这些 = 单向门/高风险)。 */
const IRREVERSIBLE_FLAGS = ['legal_commitment_risk', 'formal_quote_risk', 'supplier_lock_risk', 'prepayment_risk', 'irreversible'];

/**
 * 结果矩阵:预测方向(verdict 是否 APPROVE)vs 实际兑现(是否达成)。
 * 达成+APPROVE=matched;达成+非APPROVE=mismatched;未达成+APPROVE=mismatched;未达成+非APPROVE=matched;部分=保守 mismatched。
 */
function deriveOutcome(status: string | null | undefined, verdict: string | undefined): CrownPrinceCaseRecord['outcome'] {
  if (!status || status === 'not_started') return 'pending';
  if (status === '部分') return 'mismatched';
  const predictedGo = verdict === 'APPROVE';
  const realized = status === '达成';
  return realized === predictedGo ? 'matched' : 'mismatched';
}

function deriveConfidence(signal: string | undefined): CrownPrinceCaseRecord['predictionConfidence'] {
  if (signal === 'RED') return 'high';
  if (signal === 'YELLOW') return 'medium';
  return 'low';
}

/** 单条史馆归档 → 考绩案(historyproxy · predictorSource='court')。 */
export function shiguanArchiveToCrownPrinceCase(a: ShiguanArchiveInput): CrownPrinceCaseRecord {
  const verdict = a.archive?.learning_record?.verdict;
  const flags = a.archive?.risk_flags ?? [];
  const riskClass: RiskClass = flags.some((f) => IRREVERSIBLE_FLAGS.includes(f)) ? 'irreversible' : 'reversible';
  return {
    caseId: a.id,
    predictorSource: 'court', // 历史=军机处预测,不是太子自预测(诚实核心)
    riskClass,
    highStakes: flags.length > 0,
    outcome: deriveOutcome(a.retrospective_status, verdict),
    predictionConfidence: deriveConfidence(a.archive?.learning_record?.overallSignal),
    concededWhenOverruled: true, // 占位:军机处历史无此语义
    // 四使致命旗标:史馆无信号 → 历史回灌恒 false(太子上线自治后由真信号覆盖)
    yushiEvidenceFabricated: false,
    qintianRuinMissed: false,
    irreversibleMisApproved: false,
    jinyiweiAnomaly: false,
  };
}

export function shiguanArchivesToCases(archives: readonly ShiguanArchiveInput[]): CrownPrinceCaseRecord[] {
  return archives.map(shiguanArchiveToCrownPrinceCase);
}

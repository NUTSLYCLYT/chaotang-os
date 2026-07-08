/**
 * clause-history —— 刑部"先外后内":条款风险扫描 + 史馆踩坑 base rate。
 *
 * 串起两块已建件:clause-risk(本命·规则匹配)+ reference-class(史馆 base rate)。
 * 先外:这份合同的最高危条款,你史馆里同类条款的真实结局(踩坑率 = failed/blocked 占比)。
 * 后内:再叠加本份扫描的具体风险。
 * 纯函数。样本<5 时 reference-class 只给类比不给假概率(防"3 个旧合同算出的假踩坑率")。
 */

import { scanClauses, type ClauseRiskType, type ClauseScanResult } from './clause-risk';
import { referenceClass, type PastCase, type ReferenceClassResult } from './reference-class';

/** 条款类型 → 史馆检索关键词(喂 reference-class 做相似匹配)。 */
const TYPE_QUERY: Record<ClauseRiskType, string> = {
  unlimited_liability: '无限责任 连带责任 赔偿',
  unilateral: '单方解除 单方终止 随时解除',
  penalty_excessive: '违约金 过高 畸高',
  auto_renew: '自动续约 自动展期',
  exclusive: '独家 排他 唯一',
  prepayment: '预付 全款 付款前置',
  ip_assignment: '知识产权 归属 转让',
  jurisdiction: '管辖 对方所在地 异地诉讼',
  deposit_no_return: '押金 定金 不退 概不退还',
  liability_shift: '责任 费用 一切 由乙方 承担',
  final_interpretation: '最终解释权 格式条款 单方解释',
};

const SEV_RANK = { high: 3, medium: 2, low: 1 } as const;

export interface ClauseHistoryResult {
  scan: ClauseScanResult;
  /** 最高危条款类型(无风险则 null)。 */
  topRiskType: ClauseRiskType | null;
  /** 该类条款的史馆 base rate(先外视角;无最高危或无样本则 null）。 */
  topRiskHistory: ReferenceClassResult | null;
}

/**
 * @param contractText 客户端解析后的合同条款文本
 * @param pastContractCases 史馆里本租户的过往合同案(summary 含条款描述, outcome: success=没踩坑 / failed|blocked=踩坑)
 * @param nowIso 当前时间(reference-class 算新近)
 */
export function scanWithHistory(
  contractText: string,
  pastContractCases: PastCase[],
  nowIso: string,
): ClauseHistoryResult {
  const scan = scanClauses(contractText);
  if (scan.risks.length === 0) {
    return { scan, topRiskType: null, topRiskHistory: null };
  }
  // 取最高危条款(severity 优先,同级取先命中)
  const top = [...scan.risks].sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity])[0];
  const history = referenceClass(TYPE_QUERY[top.type], pastContractCases, { nowIso });
  return { scan, topRiskType: top.type, topRiskHistory: history };
}

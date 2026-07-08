/**
 * lifu-crisis —— 礼部商务公关司·危机响应(吸收 SCCT,纯查表)。
 *
 * 吸收(开源研究块4,捞框架非整搬):
 *  · SCCT 情境危机沟通(Coombs 2007):3 危机簇(victim/accidental/preventable 按归责升序)
 *    → 姿态(deny/diminish/rebuild);前科(crisis history)修正为更 accommodative。
 *  · 严重度分层(PRSA):reach×harm×legalRisk×velocity → tier 1-4 → {SLA 时钟, 通知序列, 谁签字}。
 * 纯函数·状态机友好。诚实(铁律3/4):危机簇判定是【人工裁量】,错判会系统性跑偏,输出带 humanJudged。
 * 边界:舆情采集/监测调锦衣卫(不自采,铁律6);本引擎只做"定姿态+定响应规格"。
 */

export type CrisisCluster = 'victim' | 'accidental' | 'preventable';
export type CrisisPosture = 'deny' | 'diminish' | 'rebuild';

export interface CrisisInput {
  /** 危机簇(人工判断:归责越重越靠 preventable)。 */
  cluster: CrisisCluster;
  /** 有无同类前科(有→更需 accommodative)。 */
  priorCrisisHistory: boolean;
  /** 以下 0-1 人工估,算严重度。 */
  reach: number;
  harm: number;
  legalRisk: number;
  velocity: number;
}

export interface CrisisResponse {
  posture: CrisisPosture;
  postureReason: string;
  severityTier: 1 | 2 | 3 | 4;
  sla: string;
  /** 通知序列(内部→受影响→监管→公众,按 tier 截断)。 */
  notify: string[];
  /** 高严重度→必过人工确认门。 */
  needsSignoff: boolean;
  humanJudged: string[];
}

const BASE_POSTURE: Record<CrisisCluster, CrisisPosture> = {
  victim: 'deny',
  accidental: 'diminish',
  preventable: 'rebuild',
};
// 有前科 → 升一档 accommodative(deny→diminish→rebuild)
const ESCALATE: Record<CrisisPosture, CrisisPosture> = { deny: 'diminish', diminish: 'rebuild', rebuild: 'rebuild' };

const NOTIFY_CHAIN = ['内部团队', '受影响客户', '监管/主管部门', '公众/媒体'];
const SLA_BY_TIER: Record<number, string> = { 4: '黄金1小时内', 3: '4小时内', 2: '24小时内', 1: '48小时内' };

export function crisisResponse(i: CrisisInput): CrisisResponse {
  let posture = BASE_POSTURE[i.cluster];
  let postureReason = `危机簇 ${i.cluster} → ${posture}`;
  if (i.priorCrisisHistory) {
    posture = ESCALATE[posture];
    postureReason += `;有前科,升级为更负责姿态 ${posture}`;
  }

  const score = (i.reach + i.harm + i.legalRisk + i.velocity) / 4;
  const severityTier: 1 | 2 | 3 | 4 = score >= 0.75 ? 4 : score >= 0.5 ? 3 : score >= 0.25 ? 2 : 1;
  const notify = NOTIFY_CHAIN.slice(0, severityTier);
  const needsSignoff = severityTier >= 3;

  return {
    posture,
    postureReason,
    severityTier,
    sla: SLA_BY_TIER[severityTier],
    notify,
    needsSignoff,
    humanJudged: ['危机簇判定为人工裁量', 'reach/harm/legalRisk/velocity 为人工估值'],
  };
}

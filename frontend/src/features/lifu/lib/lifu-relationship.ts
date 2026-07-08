/**
 * lifu-relationship —— 礼部「关系台账司」本命:对外关系图谱(复利资产)。
 *
 * 接地点=老板真实的对外关系(政府/合作方/媒体/客户高层/投资人)。纯函数。
 * Bezos:关系是复利资产——核心价值=别让关系"凉掉",surface「谁该跟进了 + 下一步」。
 * 诚实:只算阶段/新近/待办,不臆测关系好坏;缺接触记录标"未知"。
 * 边界:对方背景情报调锦衣卫(不自采);合作合规调刑部 lens(铁律6 单 owner)。
 */

export type StakeholderType = 'gov' | 'partner' | 'media' | 'client_exec' | 'investor' | 'other';

/** 关系阶段(CRM 漏斗式)。 */
export type RelationshipStage = 'cold' | 'contacted' | 'engaged' | 'negotiating' | 'partner' | 'dormant';

export interface Stakeholder {
  id: string;
  name: string;
  type: StakeholderType;
  stage: RelationshipStage;
  /** 上次接触 ISO 时间(缺=从未接触)。 */
  lastContact?: string;
  /** 下一步动作(缺=无计划)。 */
  nextAction?: string;
}

export interface RelationshipAlert {
  id: string;
  name: string;
  reason: string;
}

export interface RelationshipHealth {
  total: number;
  byStage: Partial<Record<RelationshipStage, number>>;
  /** 该跟进的(久未联系 或 无下一步)。 */
  needsFollowUp: RelationshipAlert[];
}

/** 活跃阶段超过 N 天没联系=该跟进(dormant/cold 不催)。 */
const STALE_DAYS = 30;
const ACTIVE_STAGES: RelationshipStage[] = ['contacted', 'engaged', 'negotiating', 'partner'];

function daysBetween(aIso: string, bIso: string): number {
  return Math.floor((Date.parse(bIso) - Date.parse(aIso)) / 86_400_000);
}

/**
 * @param nowIso 当前时间(调用方传,本层不调 Date)
 */
export function relationshipHealth(stakeholders: Stakeholder[], nowIso: string): RelationshipHealth {
  const byStage: Partial<Record<RelationshipStage, number>> = {};
  const needsFollowUp: RelationshipAlert[] = [];

  for (const s of stakeholders) {
    byStage[s.stage] = (byStage[s.stage] ?? 0) + 1;
    if (!ACTIVE_STAGES.includes(s.stage)) continue;

    if (!s.lastContact) {
      needsFollowUp.push({ id: s.id, name: s.name, reason: '活跃关系但无接触记录,尽快首联' });
    } else if (daysBetween(s.lastContact, nowIso) >= STALE_DAYS) {
      needsFollowUp.push({ id: s.id, name: s.name, reason: `已 ${daysBetween(s.lastContact, nowIso)} 天未联系,关系将凉,该跟进` });
    } else if (!s.nextAction) {
      needsFollowUp.push({ id: s.id, name: s.name, reason: '近期有联系但无下一步,补一个推进动作' });
    }
  }
  return { total: stakeholders.length, byStage, needsFollowUp };
}

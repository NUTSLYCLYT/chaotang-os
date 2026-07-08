import type { FormationType, SwarmFormation } from './estate-types.ts';

export const FORMATION_REGISTRY: Record<FormationType, SwarmFormation> = {
  SCOUT: formation('formation_scout', 'SCOUT', '探路阵', '密旨快速预研，判断是否值得上朝公开会审。', ['intent_refinement_swarm', 'evidence_swarm', 'redteam_swarm'], [], 30, false, false, ['SecretMemo', 'PromotionRecommendation']),
  RED_BLUE: formation('formation_red_blue', 'RED_BLUE', '红蓝阵', '争议问题对抗，形成红蓝对抗卡。', ['redteam_swarm', 'evidence_swarm'], ['worst_case_swarm'], 60, false, false, ['RedBlueCard']),
  EVIDENCE: formation('formation_evidence', 'EVIDENCE', '锁证阵', '查证据、找缺口、匹配上传材料和史馆旧案。', ['evidence_swarm', 'archive_swarm'], ['playbook_learning_swarm'], 60, false, false, ['EvidenceChain', 'MissingEvidence']),
  RISK: formation('formation_risk', 'RISK', '风险阵', '合同、股权、付款、对外承诺等高风险暗审。', ['justice_risk_swarm', 'contract_clause_swarm', 'worst_case_swarm', 'yushitai_audit_swarm'], ['equity_risk_swarm'], 90, false, true, ['RiskFinding', 'HumanApprovalChecklist']),
  CAMPAIGN: formation('formation_campaign', 'CAMPAIGN', '攻坚阵', '客户、销售、竞争和 90 天路径。', ['war_growth_swarm', 'ritual_expression_swarm', 'personnel_execution_swarm'], ['customer_decision_chain_swarm'], 90, false, false, ['CampaignPlan']),
  DELIVERY: formation('formation_delivery', 'DELIVERY', '交付阵', 'BOM、交付、供应链、验收和不可承诺事项。', ['works_delivery_swarm', 'finance_roi_swarm', 'justice_risk_swarm'], ['bom_supply_chain_swarm'], 90, false, true, ['DeliveryReview']),
  WAR_ROOM: formation('formation_war_room', 'WAR_ROOM', '大朝会阵', '重大合作、投资、合同、股权等正式大决策。', ['personnel_execution_swarm', 'finance_roi_swarm', 'ritual_expression_swarm', 'war_growth_swarm', 'justice_risk_swarm', 'works_delivery_swarm', 'yushitai_audit_swarm', 'report_synthesis_swarm', 'archive_swarm'], ['redteam_swarm', 'worst_case_swarm'], 180, true, true, ['FormalMemorial']),
};

function formation(
  id: string,
  formationType: FormationType,
  name: string,
  purpose: string,
  requiredSwarms: string[],
  optionalSwarms: string[],
  maxRuntimeSeconds: number,
  asyncRequired: boolean,
  humanApprovalRequired: boolean,
  outputs: string[],
): SwarmFormation {
  return { id, formationType, name, purpose, requiredSwarms, optionalSwarms, maxRuntimeSeconds, asyncRequired, humanApprovalRequired, outputs };
}

export function getFormation(type: FormationType): SwarmFormation {
  return FORMATION_REGISTRY[type];
}

export function listFormations(): SwarmFormation[] {
  return Object.values(FORMATION_REGISTRY);
}

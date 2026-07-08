import type { CommandType, SwarmCapabilityCard } from './estate-types.ts';

const ALL_COMMANDS: CommandType[] = ['PUBLIC_DECREE', 'SECRET_EDICT', 'MINISTRY_REQUEST', 'AUDIT_ORDER', 'TRAINING_ORDER'];
const SECRET_SAFE_COMMANDS: CommandType[] = ['PUBLIC_DECREE', 'SECRET_EDICT', 'MINISTRY_REQUEST', 'TRAINING_ORDER'];

export const SWARM_CAPABILITY_REGISTRY: Record<string, SwarmCapabilityCard> = {
  intent_refinement_swarm: card('intent_refinement_swarm', '拟旨蜂群', ['拟旨', '意图拆解'], ['丞相', '军机处'], ALL_COMMANDS, 'LOW', true, false, false, ['DraftIntent'], '拟旨蜂群正在拆解密旨目标'),
  evidence_swarm: card('evidence_swarm', '证据蜂群', ['证据', '查缺口'], ['全局'], ALL_COMMANDS, 'MEDIUM', true, false, false, ['EvidenceChain', 'MissingEvidence'], '证据蜂群正在核对材料与缺口'),
  redteam_swarm: card('redteam_swarm', '红队蜂群', ['反方', '漏洞'], ['御史台', '军机处'], ALL_COMMANDS, 'MEDIUM', true, true, false, ['RedTeamChallenge'], '红队蜂群正在寻找失败场景'),
  yushitai_audit_swarm: card('yushitai_audit_swarm', '御史审计蜂群', ['审计', '质门'], ['御史台'], ['PUBLIC_DECREE', 'SECRET_EDICT', 'AUDIT_ORDER'], 'HIGH', true, true, true, ['AuditResult'], '御史台正在暗审密奏风险'),
  report_synthesis_swarm: card('report_synthesis_swarm', '奏折合成蜂群', ['合成', '奏折'], ['军机处'], SECRET_SAFE_COMMANDS, 'MEDIUM', false, true, false, ['MemorialDraft'], '奏折合成蜂群正在压缩分歧'),
  archive_swarm: card('archive_swarm', '史馆归档蜂群', ['归档', '旧案'], ['史馆'], ALL_COMMANDS, 'LOW', true, false, false, ['ArchiveHint'], '史馆蜂群正在召回旧案'),

  personnel_execution_swarm: card('personnel_execution_swarm', '吏部执行蜂群', ['DRI', 'RACI', '执行'], ['吏部'], SECRET_SAFE_COMMANDS, 'MEDIUM', true, false, false, ['ExecutionPlan'], '吏部执行蜂群正在核对责任链'),
  finance_roi_swarm: card('finance_roi_swarm', '户部财务蜂群', ['ROI', '预算', '现金流'], ['户部'], SECRET_SAFE_COMMANDS, 'MEDIUM', true, false, false, ['RoiReview'], '户部财务蜂群正在核查 ROI 与现金流'),
  ritual_expression_swarm: card('ritual_expression_swarm', '礼部表达蜂群', ['话术', '客户表达', '品牌'], ['礼部'], SECRET_SAFE_COMMANDS, 'MEDIUM', true, true, false, ['MessageReview'], '礼部表达蜂群正在审查对外口径'),
  war_growth_swarm: card('war_growth_swarm', '兵部增长蜂群', ['客户链', '竞争', '攻坚'], ['兵部'], SECRET_SAFE_COMMANDS, 'MEDIUM', true, false, false, ['CampaignPlan'], '兵部增长蜂群正在推演客户路径'),
  justice_risk_swarm: card('justice_risk_swarm', '刑部风控蜂群', ['合同', '股权', '付款'], ['刑部'], ['PUBLIC_DECREE', 'SECRET_EDICT', 'MINISTRY_REQUEST', 'AUDIT_ORDER'], 'HIGH', true, true, true, ['RiskRegister'], '刑部风控蜂群正在检查股权和预付款'),
  works_delivery_swarm: card('works_delivery_swarm', '工部交付蜂群', ['BOM', '交期', '验收'], ['工部'], SECRET_SAFE_COMMANDS, 'MEDIUM', true, false, false, ['DeliveryReview'], '工部交付蜂群正在核查 BOM 与交期'),

  contract_clause_swarm: card('contract_clause_swarm', '合同条款蜂群', ['合同条款', '违约', '退出机制'], ['刑部', '户部', '礼部'], ['PUBLIC_DECREE', 'SECRET_EDICT', 'MINISTRY_REQUEST', 'AUDIT_ORDER'], 'HIGH', true, true, true, ['ClauseRiskList'], '合同条款蜂群正在检查红线条款'),
  equity_risk_swarm: card('equity_risk_swarm', '股权风险蜂群', ['股权', '分红', '退出'], ['刑部', '户部'], ['PUBLIC_DECREE', 'SECRET_EDICT', 'MINISTRY_REQUEST', 'AUDIT_ORDER'], 'HIGH', true, true, true, ['EquityRiskList'], '股权风险蜂群正在核对不可逆责任'),
  cashflow_swarm: card('cashflow_swarm', '现金流蜂群', ['现金流', '付款', '回款'], ['户部'], SECRET_SAFE_COMMANDS, 'MEDIUM', true, false, false, ['CashflowReview'], '现金流蜂群正在核查付款节点'),
  bom_supply_chain_swarm: card('bom_supply_chain_swarm', 'BOM供应链蜂群', ['BOM', '供应链', '物料'], ['工部'], SECRET_SAFE_COMMANDS, 'MEDIUM', true, false, false, ['SupplyChainReview'], 'BOM供应链蜂群正在核查物料与交期'),
  customer_decision_chain_swarm: card('customer_decision_chain_swarm', '客户决策链蜂群', ['客户决策链', '预算', '试点'], ['兵部', '礼部'], SECRET_SAFE_COMMANDS, 'MEDIUM', true, false, false, ['CustomerChain'], '客户决策链蜂群正在确认拍板路径'),
  message_redteam_swarm: card('message_redteam_swarm', '话术红队蜂群', ['话术红队', '对外承诺'], ['礼部', '刑部'], ['PUBLIC_DECREE', 'SECRET_EDICT', 'MINISTRY_REQUEST', 'AUDIT_ORDER'], 'HIGH', true, true, true, ['MessageRisk'], '话术红队蜂群正在寻找越界表达'),
  worst_case_swarm: card('worst_case_swarm', '最坏情况蜂群', ['最坏情况', '红线', '反方'], ['御史台', '军机处'], ALL_COMMANDS, 'HIGH', true, true, true, ['WorstCase'], '最坏情况蜂群正在推演失败场景'),
  playbook_learning_swarm: card('playbook_learning_swarm', '史馆学习蜂群', ['经验', '复盘', 'Playbook'], ['史馆'], ALL_COMMANDS, 'LOW', true, false, false, ['LearningSignal'], '史馆学习蜂群正在提炼可复用规则'),
};

function card(
  id: string,
  name: string,
  capabilityTags: string[],
  supportedMinistries: string[],
  allowedCommandTypes: CommandType[],
  riskLevel: SwarmCapabilityCard['riskLevel'],
  canRunSecret: boolean,
  requiresAudit: boolean,
  requiresHumanApproval: boolean,
  outputTypes: string[],
  userFacingActivity: string,
): SwarmCapabilityCard {
  return {
    id,
    name,
    capabilityTags,
    supportedMinistries,
    allowedCommandTypes,
    riskLevel,
    canRunSecret,
    requiresAudit,
    requiresHumanApproval,
    outputTypes,
    sourceLabelRequired: true,
    userFacingActivity,
  };
}

export function getSwarmCapability(id: string): SwarmCapabilityCard | null {
  return SWARM_CAPABILITY_REGISTRY[id] ?? null;
}

export function listSwarmCapabilities(): SwarmCapabilityCard[] {
  return Object.values(SWARM_CAPABILITY_REGISTRY);
}

import type { SourceLabel } from '../types.ts';
import { listDepartments } from '../unified/department-registry.ts';
import type { DepartmentCapability, UnifiedDepartmentId } from '../unified/unified-types.ts';
import { buildDeepOfficeOpinionV1 } from './offices.ts';

export type DepartmentParticipation = 'intelligence_first' | 'risk_triggered' | 'always' | 'routed' | 'high_risk' | 'disabled_placeholder' | string;

export interface CourtDepartmentRegistryEntry {
  id: UnifiedDepartmentId;
  protocol_id: string;
  runtime_id: UnifiedDepartmentId;
  name: string;
  type: string;
  enabled: boolean;
  display_role: string;
  review_skill: string;
  office_profile?: string;
  output_schema: 'IntelligencePackV1' | 'DepartmentOpinionV1';
  route_keywords: string[];
  risk_triggers: string[];
  required_evidence: string[];
  swarm_bundle: string | null;
  default_participation: DepartmentParticipation;
  complexity_profile: string;
  user_visible_summary: string;
}

export interface DepartmentOpinionV1 {
  schema_version: 'DepartmentOpinionV1';
  task_id: string;
  department_id: string;
  signal: 'GREEN' | 'YELLOW' | 'RED' | 'GRAY';
  verdict: 'APPROVE' | 'NEED_EVIDENCE' | 'RECHECK' | 'REJECT';
  summary: string;
  evidence: Array<{
    schema_version: 'EvidenceItemV1';
    id: string;
    label: string;
    summary: string;
    reliability: 'high' | 'medium' | 'low' | 'unknown';
    source_label: SourceLabel;
  }>;
  missing_evidence: string[];
  risks: string[];
  next_order: string;
  human_confirmation_required: boolean;
  source_label: SourceLabel;
}

const PROTOCOL_ID_BY_ID: Record<UnifiedDepartmentId, string> = {
  jinyiwei: 'jinyiwei_intelligence',
  finance: 'hubu_cfo',
  war: 'bingbu_sales',
  personnel: 'libu_hr_admin',
  justice: 'xingbu_legal_risk',
  ritual: 'rites_brand_comms',
  works: 'gongbu_delivery',
};

const REVIEW_SKILL_BY_ID: Record<UnifiedDepartmentId, string> = {
  jinyiwei: 'skill.department.jinyiwei.intelligence_office_review',
  finance: 'skill.department.hubu.cfo_office_review',
  war: 'skill.department.bingbu.cro_sales_office_review',
  personnel: 'skill.department.libu.chro_cao_office_review',
  justice: 'skill.department.xingbu.clo_cco_office_review',
  ritual: 'skill.department.rites_brand_comms.office_review',
  works: 'skill.department.gongbu.cto_cpo_delivery_office_review',
};

const OFFICE_PROFILE_BY_ID: Record<UnifiedDepartmentId, string> = {
  jinyiwei: 'jinyiwei_intelligence_office',
  finance: 'hubu_cfo_office',
  war: 'bingbu_cro_sales_office',
  personnel: 'libu_chro_cao_office',
  justice: 'xingbu_clo_cco_office',
  ritual: 'rites_cmo_cco_office',
  works: 'gongbu_cto_cpo_delivery_office',
};

const SWARM_BUNDLE_BY_ID: Record<UnifiedDepartmentId, string> = {
  jinyiwei: 'jinyiwei_intelligence_office_v0',
  finance: 'hubu_cfo_office_v0',
  war: 'bingbu_cro_sales_office_v0',
  personnel: 'libu_chro_cao_office_v0',
  justice: 'xingbu_clo_cco_office_v0',
  ritual: 'rites_brand_comms_office_v0',
  works: 'gongbu_cto_cpo_delivery_office_v0',
};

function toRegistryEntry(department: DepartmentCapability): CourtDepartmentRegistryEntry {
  const id = department.id;
  return {
    id,
    protocol_id: PROTOCOL_ID_BY_ID[id],
    runtime_id: id,
    name: department.name,
    type: 'department',
    enabled: department.enabled,
    display_role: department.modernRole,
    review_skill: REVIEW_SKILL_BY_ID[id],
    office_profile: OFFICE_PROFILE_BY_ID[id],
    output_schema: department.outputContract,
    route_keywords: department.triggerKeywords,
    risk_triggers: department.highRiskKeywords,
    required_evidence: department.requiredEvidence,
    swarm_bundle: SWARM_BUNDLE_BY_ID[id],
    default_participation: id === 'jinyiwei' ? 'intelligence_first' : 'risk_triggered',
    complexity_profile: 'adaptive',
    user_visible_summary: department.mission,
  };
}

function includesAny(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => keyword && normalized.includes(keyword.toLowerCase()));
}

function matchingRiskTriggers(entry: CourtDepartmentRegistryEntry, question: string): string[] {
  const normalized = question.toLowerCase();
  return entry.risk_triggers.filter((trigger) => trigger && normalized.includes(trigger.toLowerCase()));
}

/**
 * 运行时部门 SSOT（铁律2）。
 * 注意：本函数从代码内置的 DEPARTMENT_REGISTRY（unified/department-registry.ts）构造，
 * **不读** config/departments.registry.yaml —— 那份 yaml 仅供 scripts/validate-*.mjs 做契约校验。
 * entry.id 是短码（jinyiwei/finance/war/...）；yaml 里的长码（jinyiwei_intelligence 等）对应 entry.protocol_id，是另一维度。
 * 选部门（selectRegistryDepartments）只认短码 entry.id，与本仓硬编码一致，**不是漂移 bug**。
 * 旧名 loadDepartmentRegistryFromYaml 是误导命名（曾诱使审阅者把短码/长码误判成 CRITICAL bug），已更名（2026-06-30）。
 */
export function loadCourtDepartmentRegistry(): CourtDepartmentRegistryEntry[] {
  return listDepartments().map(toRegistryEntry);
}

export function selectRegistryDepartments(params: {
  question: string;
  registry?: CourtDepartmentRegistryEntry[];
  includeDisabledPlaceholders?: boolean;
}): CourtDepartmentRegistryEntry[] {
  const registry = params.registry ?? loadCourtDepartmentRegistry();
  const selected = new Map<string, CourtDepartmentRegistryEntry>();

  for (const entry of registry) {
    if (!entry.enabled && !params.includeDisabledPlaceholders) continue;
    const intelligenceFirst = entry.default_participation === 'intelligence_first' || entry.id === 'jinyiwei';
    const routed = includesAny(params.question, entry.route_keywords);
    const riskTriggered = matchingRiskTriggers(entry, params.question).length > 0;
    if (intelligenceFirst || routed || riskTriggered) selected.set(entry.id, entry);
  }

  if (selected.size === 0) {
    for (const entry of registry) {
      if (['jinyiwei', 'finance', 'justice'].includes(entry.id)) selected.set(entry.id, entry);
    }
  }

  return registry.filter((entry) => selected.has(entry.id));
}

function missingEvidence(entry: CourtDepartmentRegistryEntry, question: string, knownFacts: string[]): string[] {
  const haystack = [question, ...knownFacts].join('\n');
  const missing = entry.required_evidence.filter((item) => !haystack.includes(item));
  return missing.length > 0 ? missing : ['可归档证据链'];
}

function risksFor(entry: CourtDepartmentRegistryEntry, question: string): string[] {
  const matched = matchingRiskTriggers(entry, question);
  if (matched.length > 0) return matched.map((trigger) => `${entry.name}风险触发：${trigger}`);
  if (entry.id === 'finance' && /报价|成本|毛利|付款/.test(question)) return ['报价依据不足'];
  if (entry.id === 'war' && /客户|报价|销售/.test(question)) return ['客户阶段未确认'];
  if (entry.id === 'justice' && /正式报价|合同|承诺/.test(question)) return ['对外承诺风险'];
  if (entry.id === 'ritual' && /话术|宣传|客户回复/.test(question)) return ['对外表达风险'];
  return [];
}

// 边界(2026-07-03 阶段3 侦察定论)：这是三个"部门意见"启发式引擎之一——
//   #1 本函数(浅桩 regex) → 先委托 #2 buildDeepOfficeOpinionV1(offices.ts·另一套 OFFICE_PROFILES regex)，
//   为空才落浅桩；#3 是 C栈真 office(core/courtos/{bingbu,hubu,...}·被 unified-decision-loop 用)。
// 三者并存**不是 bug**：#1/#2 是 A栈本地 shape(DepartmentOpinionV1)，产出只在 memorial 的 FALLBACK
// 降级路径可见——live 成功时 igniteLiveMemorial→buildLiveMemorial 会覆盖内容。收敛到 #3 需
// DepartmentOpinion→DepartmentOpinionV1 适配器 + 部门码映射(war→bingbu…) + 覆盖缺口回退
// (C栈无 jinyiwei/personnel office)，判为高风险×低价值(只改降级态外观)，故**不收敛**。详见 dev/notes 执行清单。
export function buildShallowDepartmentOpinionsV1(params: {
  taskId: string;
  question: string;
  knownFacts: string[];
  sourceLabel: SourceLabel;
  registry?: CourtDepartmentRegistryEntry[];
}): DepartmentOpinionV1[] {
  const departments = selectRegistryDepartments({ question: params.question, registry: params.registry });
  return departments.map((entry) => {
    const deepOpinion = buildDeepOfficeOpinionV1({
      taskId: params.taskId,
      question: params.question,
      knownFacts: params.knownFacts,
      sourceLabel: params.sourceLabel,
      entry,
    });
    if (deepOpinion) return deepOpinion;

    const evidenceFacts = params.knownFacts.length > 0 ? params.knownFacts : [`用户原问：${params.question}`];
    const evidence = evidenceFacts.map((fact, index) => ({
      schema_version: 'EvidenceItemV1' as const,
      id: `dept_evidence_${params.taskId}_${entry.id}_${index + 1}`,
      label: index === 0 ? '皇上原问' : '已知事实',
      summary: fact,
      reliability: 'medium' as const,
      source_label: params.sourceLabel,
    }));
    const missing = missingEvidence(entry, params.question, params.knownFacts);
    const risks = risksFor(entry, params.question);
    const highRisk = risks.length > 0 && /正式报价|合同|股权|签字|承诺|付款|预付款|外发/.test(params.question);
    return {
      schema_version: 'DepartmentOpinionV1',
      task_id: params.taskId,
      department_id: entry.id,
      signal: highRisk ? 'YELLOW' : missing.length > 0 ? 'YELLOW' : 'GRAY',
      verdict: missing.length > 0 ? 'NEED_EVIDENCE' : highRisk ? 'RECHECK' : 'APPROVE',
      summary: `${entry.name}浅层意见：${entry.user_visible_summary}`,
      evidence,
      missing_evidence: missing,
      risks,
      next_order: missing.length > 0 ? `先补齐${missing.slice(0, 3).join('、')}` : '可进入下一步复核',
      human_confirmation_required: highRisk,
      source_label: params.sourceLabel,
    };
  });
}

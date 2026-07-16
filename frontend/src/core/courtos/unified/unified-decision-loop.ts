/** @deprecated P4c: test/eval-only decision engine; production imports are forbidden. */
import type { SourceLabel } from '../types';
import { mergeSourceLabels } from '../source-label.ts';
import { detectHighRisk } from '../harness/human-approval-gate.ts';
import { loopTraceIdForTask } from '../loop-trace.ts';
import { buildBingbuDepartmentOpinion } from '../bingbu/bingbu-cro-sales-office.ts';
import type { BingbuDepartmentWorkOrder } from '../bingbu/bingbu-types.ts';
import { buildGongbuDepartmentOpinion } from '../gongbu/gongbu-cto-cpo-office.ts';
import type { GongbuDepartmentWorkOrder } from '../gongbu/gongbu-types.ts';
import { buildHubuDepartmentOpinion } from '../hubu/hubu-cfo-office.ts';
import type { HubuDepartmentWorkOrder } from '../hubu/hubu-types.ts';
import { buildRitesDepartmentOpinion } from '../rites/rites-brand-comms-office.ts';
import type { RitesDepartmentWorkOrder } from '../rites/rites-types.ts';
import { buildXingbuDepartmentOpinion } from '../xingbu/xingbu-clo-cco-office.ts';
import type { XingbuDepartmentWorkOrder } from '../xingbu/xingbu-types.ts';
import { DEPARTMENT_REGISTRY, enabledDepartmentIds, getDepartment, listDepartments } from './department-registry.ts';
import type {
  DepartmentOpinion,
  IntelligencePack,
  InteractionCard,
  UnifiedDepartmentWorkOrders,
  UnifiedConflict,
  UnifiedDepartmentId,
  UnifiedDraftEdict,
  UnifiedLoopResult,
  UnifiedMemorial,
  UnifiedReviewPlan,
  UnifiedSignal,
  UnifiedVerdict,
} from './unified-types.ts';

const LOOP_ID = 'court_unified_decision_loop_v1' as const;

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function hasAny(text: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function hasFinanceIntent(text: string): boolean {
  return /户部|预算|ROI|成本|报价|金额|现金流|回款|付款|预付|预付款|毛利|投资|请款|审批|财务/.test(text);
}

function hasSalesIntent(text: string): boolean {
  return /客户|销售|市场|渠道|成交|商机|正式报价|报价|合作|采购意向/.test(text);
}

function hasLegalIntent(text: string): boolean {
  return /合同|法务|合规|签字|盖章|正式报价|承诺|独家|违约|预付|预付款|股权|法律责任/.test(text);
}

function makeTaskId(question: string): string {
  const hash = Array.from(question).reduce((acc, char) => (acc * 33 + char.charCodeAt(0)) >>> 0, 5381);
  return `unified_${hash.toString(36)}`;
}

function inferDecisionType(text: string): string {
  if (/报价|正式报价|成本|ROI|预算/.test(text)) return '报价与投入判断';
  if (/合同|股权|签字|法务/.test(text)) return '合同与风险判断';
  if (/客户|销售|渠道|成交|合作/.test(text)) return '客户推进判断';
  if (/负责人|执行|组织|DRI|90天/.test(text)) return '组织执行判断';
  return '经营决策判断';
}

export function draftUnifiedEdict(rawQuestion: string, sourceLabel: SourceLabel = 'MIXED'): UnifiedDraftEdict {
  const question = normalizeText(rawQuestion);
  const highRisk = detectHighRisk(question);
  return {
    originalQuestion: question,
    refinedQuestion: `请军机处组织已启用部门会审：${question}。重点核查事实来源、证据缺口、部门分歧、风险边界和唯一下一步。`,
    decisionType: inferDecisionType(question),
    knownFacts: question ? [`用户原问：${question}`] : [],
    unknownGaps: highRisk.isHighRisk
      ? ['缺少高风险事项的人工确认记录', '缺少可归档证据链']
      : ['缺少可归档证据链'],
    expectedOutput: ['圣裁', '分奏', '证据', '风险', '后令', '质门', '来源'],
    sourceLabel,
  };
}

export function planUnifiedReview(params: {
  taskId: string;
  draftEdict: UnifiedDraftEdict;
  sourceLabel?: SourceLabel;
}): UnifiedReviewPlan {
  const text = `${params.draftEdict.originalQuestion}\n${params.draftEdict.refinedQuestion}`;
  const selected = new Set<UnifiedDepartmentId>(['jinyiwei']);
  const reasons: Partial<Record<UnifiedDepartmentId, string>> = {
    jinyiwei: '统一 Loop 要求情报先行，先核查事实、来源和证据缺口。',
  };

  for (const department of listDepartments({ enabledOnly: true })) {
    if (department.id === 'jinyiwei') continue;
    if (hasAny(text, department.triggerKeywords) || hasAny(text, department.highRiskKeywords)) {
      selected.add(department.id);
      reasons[department.id] = `命中${department.name}职责：${department.mission}`;
    }
  }

  if (hasFinanceIntent(text)) {
    selected.add('finance');
    reasons.finance = '命中户部财务、预算、报价、付款或现金流意图。';
  }
  if (hasSalesIntent(text)) {
    selected.add('war');
    reasons.war = '命中客户、销售、报价或合作推进意图。';
  }
  if (hasLegalIntent(text)) {
    selected.add('justice');
    reasons.justice = '命中正式报价、合同、承诺、预付或不可逆法律风险。';
  }

  if (selected.size === 1) {
    for (const id of ['finance', 'war', 'personnel', 'justice'] as UnifiedDepartmentId[]) {
      selected.add(id);
      reasons[id] = '默认启用经营会审视角，避免单点判断。';
    }
  }

  return {
    taskId: params.taskId,
    selectedDepartments: [...selected],
    reasons,
    sourceLabel: params.sourceLabel ?? params.draftEdict.sourceLabel,
  };
}

export function buildIntelligencePack(plan: UnifiedReviewPlan, draftEdict: UnifiedDraftEdict): IntelligencePack {
  const missingEvidence = [...new Set([
    ...draftEdict.unknownGaps,
    ...(draftEdict.originalQuestion.includes('客户') ? ['客户需求范围确认'] : []),
    ...(draftEdict.originalQuestion.includes('报价') ? ['报价依据和有效期'] : []),
  ])];
  return {
    departmentId: 'jinyiwei',
    facts: draftEdict.knownFacts,
    evidenceBasis: ['用户原始问题', '当前已启用部门注册表', '本地规则推断'],
    missingEvidence,
    unsupportedClaims: missingEvidence.length > 0 ? ['当前仍有缺证，不得包装成确定性结论。'] : [],
    sourceLabel: plan.sourceLabel,
  };
}

export function buildHubuDepartmentWorkOrder(params: {
  plan: UnifiedReviewPlan;
  draftEdict: UnifiedDraftEdict;
  intelligencePack: IntelligencePack;
}): HubuDepartmentWorkOrder | undefined {
  if (!params.plan.selectedDepartments.includes('finance')) return undefined;

  const department = getDepartment('finance');
  const text = `${params.draftEdict.originalQuestion}\n${params.draftEdict.refinedQuestion}`;
  const sourceLabel = mergeSourceLabels([
    params.plan.sourceLabel,
    params.draftEdict.sourceLabel,
    params.intelligencePack.sourceLabel,
  ]);
  const financeRequiredEvidence = department.requiredEvidence.filter((item) => {
    if (/报价|正式报价|底价|毛利/.test(text)) {
      return ['成本表', '目标毛利率', '付款条件', '报价有效期', '现金影响'].includes(item);
    }
    if (/投资|合作|ROI|项目推进|立项/.test(text)) {
      return ['现金影响', 'ROI 假设'].includes(item);
    }
    return true;
  });
  const requiredEvidence = [...new Set([
    ...financeRequiredEvidence,
    ...params.intelligencePack.missingEvidence.filter((item) => /报价|成本|毛利|付款|现金|回款|预算|ROI|投资|审批|合同|有效期/.test(item)),
  ])];

  return {
    taskId: params.plan.taskId,
    departmentId: 'finance',
    focusQuestion: `请户部 CFO Office 判断「${params.draftEdict.originalQuestion}」的财务边界、现金影响、ROI 假设、审批责任和唯一下一步。`,
    requiredEvidence,
    expectedOutputs: ['CFO 立场', '关键数字', '缺证清单', '风险清单', '唯一下一步', '人工确认要求'],
    sourceLabel,
  };
}

export function buildBingbuDepartmentWorkOrder(params: {
  plan: UnifiedReviewPlan;
  draftEdict: UnifiedDraftEdict;
  intelligencePack: IntelligencePack;
}): BingbuDepartmentWorkOrder | undefined {
  if (!params.plan.selectedDepartments.includes('war')) return undefined;

  const department = getDepartment('war');
  const text = `${params.draftEdict.originalQuestion}\n${params.draftEdict.refinedQuestion}`;
  const sourceLabel = mergeSourceLabels([
    params.plan.sourceLabel,
    params.draftEdict.sourceLabel,
    params.intelligencePack.sourceLabel,
  ]);
  const salesRequiredEvidence = department.requiredEvidence.filter((item) => {
    if (/正式报价|报价|折扣|底价|毛利|压价/.test(text)) {
      return ['需求范围', '预算确认', '下一步触发点'].some((token) => item.includes(token));
    }
    if (/客户|大客户|决策链|重点客户/.test(text)) {
      return ['客户决策链', '需求范围', '下一步触发点'].includes(item);
    }
    if (/forecast|pipeline|商机|线索|展会/.test(text)) {
      return ['客户决策链', '预算确认', '下一步触发点'].includes(item);
    }
    return true;
  });
  const requiredEvidence = [...new Set([
    ...salesRequiredEvidence,
    ...params.intelligencePack.missingEvidence.filter((item) => /客户|报价|预算|需求|决策链|商机|阶段|竞品|渠道|承诺|证据|交期/.test(item)),
  ])];
  const requestedArtifacts = /报价|折扣|底价/.test(text)
    ? ['报价前检查清单', '报价策略草案']
    : /竞品/.test(text)
      ? ['竞品 battlecard', '谈判策略']
      : /渠道|代理/.test(text)
        ? ['渠道伙伴计划', '渠道政策草案']
        : /forecast|pipeline/.test(text)
          ? ['Pipeline 风险表', 'Forecast 解释卡']
          : ['客户跟进方案', '销售下一步行动卡'];

  return {
    taskId: params.plan.taskId,
    departmentId: 'war',
    focusQuestion: `请兵部 CRO / Sales / RevOps Office 判断「${params.draftEdict.originalQuestion}」的商机阶段、客户推进、报价策略、跨部门复核和唯一销售下一步。`,
    requiredEvidence,
    expectedOutputs: ['CRO 立场', '商机阶段', '销售 owner 或缺口', '证据/缺口', '跨部门复核', '唯一销售动作', '人工确认要求'],
    requestedArtifacts,
    sourceLabel,
  };
}

export function buildXingbuDepartmentWorkOrder(params: {
  plan: UnifiedReviewPlan;
  draftEdict: UnifiedDraftEdict;
  intelligencePack: IntelligencePack;
}): XingbuDepartmentWorkOrder | undefined {
  if (!params.plan.selectedDepartments.includes('justice')) return undefined;

  const department = getDepartment('justice');
  const text = `${params.draftEdict.originalQuestion}\n${params.draftEdict.refinedQuestion}`;
  const sourceLabel = mergeSourceLabels([
    params.plan.sourceLabel,
    params.draftEdict.sourceLabel,
    params.intelligencePack.sourceLabel,
  ]);
  const legalRequiredEvidence = department.requiredEvidence.filter((item) => {
    if (/正式报价|报价|客户确认函|承诺|保证收益|保底收益/.test(text)) {
      return ['合同正文或材料原文', '适用地区/司法辖区', '交易主体信息', '授权记录', '承诺边界', '人工确认记录'].includes(item);
    }
    if (/合同|协议|签约|签字|盖章|印章/.test(text)) {
      return ['合同正文或材料原文', '适用地区/司法辖区', '交易主体信息', '授权记录', '人工确认记录'].includes(item);
    }
    if (/股权|分红|对赌|投融资|合伙人退出/.test(text)) {
      return ['适用地区/司法辖区', '交易主体信息', '授权记录', '人工确认记录'].includes(item);
    }
    return true;
  });
  const requiredEvidence = [...new Set([
    ...legalRequiredEvidence,
    ...params.intelligencePack.missingEvidence.filter((item) => /合同|主体|授权|报价|承诺|客户|证据|人工确认|适用地区|司法辖区|股权|付款|审批/.test(item)),
  ])];

  return {
    taskId: params.plan.taskId,
    departmentId: 'justice',
    focusQuestion: `请刑部 CLO/CCO Office 判断「${params.draftEdict.originalQuestion}」的合同、授权、对外承诺、不可逆动作和人工确认要求。`,
    requiredEvidence,
    expectedOutputs: ['CLO/CCO 立场', '法律风险清单', '禁止动作', '跨部门复核', '唯一下一步', '人工确认要求'],
    sourceLabel,
  };
}

export function buildRitesDepartmentWorkOrder(params: {
  plan: UnifiedReviewPlan;
  draftEdict: UnifiedDraftEdict;
  intelligencePack: IntelligencePack;
}): RitesDepartmentWorkOrder | undefined {
  if (!params.plan.selectedDepartments.includes('ritual')) return undefined;

  const department = getDepartment('ritual');
  const text = `${params.draftEdict.originalQuestion}\n${params.draftEdict.refinedQuestion}`;
  const sourceLabel = mergeSourceLabels([
    params.plan.sourceLabel,
    params.draftEdict.sourceLabel,
    params.intelligencePack.sourceLabel,
  ]);
  const ritesRequiredEvidence = department.requiredEvidence.filter((item) => {
    if (/正式报价|报价|ROI|收益|回报|保底收益|保证收益/.test(text)) {
      return ['受众', '目标', '渠道', '事实依据', '禁用表达', '客户确认或授权'].includes(item);
    }
    if (/招商|合作方案|Pitch Deck|销售材料|官网|产品介绍/.test(text)) {
      return ['受众', '目标', '渠道', '主口径', '事实依据', '禁用表达'].includes(item);
    }
    if (/媒体|危机|舆情|投诉|竞品|行业第一|客户案例公开/.test(text)) {
      return ['受众', '目标', '渠道', '主口径', '事实依据', '禁用表达', '客户确认或授权'].includes(item);
    }
    return true;
  });
  const requiredEvidence = [...new Set([
    ...ritesRequiredEvidence,
    ...params.intelligencePack.missingEvidence.filter((item) => /客户|报价|证据|授权|确认|需求|事实|渠道|材料/.test(item)),
  ])];
  const audience = /媒体|新闻|采访|舆情|危机/.test(text)
    ? '媒体、公众或利益相关方'
    : /招商|合作|Pitch Deck|合作方案/.test(text)
      ? '合作方或招商对象'
      : '客户或潜在客户';
  const goal = /危机|投诉|舆情/.test(text)
    ? '先稳住事实口径并避免扩大承诺'
    : /招商|合作|Pitch Deck/.test(text)
      ? '形成可信招商表达并暴露承诺边界'
      : /报价|ROI|收益|交期/.test(text)
        ? '给出安全回复口径并触发必要复核'
        : '形成可审查的对外表达草稿';
  const channel = /官网/.test(text)
    ? '官网'
    : /公众号|朋友圈|小红书|LinkedIn|社媒/.test(text)
      ? '社媒或公众号'
      : /媒体|采访|新闻/.test(text)
        ? '媒体沟通'
        : /PPT|Pitch Deck/.test(text)
          ? '演示材料'
          : '客户沟通';
  const requestedArtifacts = /危机|舆情|投诉/.test(text)
    ? ['危机回应 holding statement']
    : /媒体|采访/.test(text)
      ? ['媒体 Q&A']
      : /招商|合作方案/.test(text)
        ? ['招商话术', '合作方案大纲']
        : /PPT|Pitch Deck/.test(text)
          ? ['Pitch Deck 大纲']
          : /官网/.test(text)
            ? ['官网文案']
            : /报价|交期|ROI|收益/.test(text)
              ? ['客户回复草稿']
              : ['对外邮件草稿'];

  return {
    taskId: params.plan.taskId,
    departmentId: 'ritual',
    audience,
    goal,
    channel,
    requestedArtifacts,
    requiredEvidence,
    expectedOutputs: ['CMO/CCO 立场', '主口径', '禁用表达', '材料草稿', '跨部门复核', '唯一下一步', '人工确认要求'],
    sourceLabel,
  };
}

export function buildGongbuDepartmentWorkOrder(params: {
  plan: UnifiedReviewPlan;
  draftEdict: UnifiedDraftEdict;
  intelligencePack: IntelligencePack;
}): GongbuDepartmentWorkOrder | undefined {
  if (!params.plan.selectedDepartments.includes('works')) return undefined;

  const department = getDepartment('works');
  const text = `${params.draftEdict.originalQuestion}\n${params.draftEdict.refinedQuestion}`;
  const sourceLabel = mergeSourceLabels([
    params.plan.sourceLabel,
    params.draftEdict.sourceLabel,
    params.intelligencePack.sourceLabel,
  ]);
  const worksRequiredEvidence = department.requiredEvidence.filter((item) => {
    if (/BOM|设备|物料|供应链|供应商|采购/.test(text)) {
      return ['BOM', '交期', '供应链锁定'].includes(item);
    }
    if (/交付|交期|30天|30 天|固定交期|一定交付|承诺/.test(text)) {
      return ['BOM', '交期', '验收标准', '供应链锁定', '现场条件'].includes(item);
    }
    if (/验收|测试|质量|上线|缺陷/.test(text)) {
      return ['验收标准'].includes(item);
    }
    if (/现场|施工|安装|并网/.test(text)) {
      return ['现场条件', '交期'].includes(item);
    }
    return true;
  });
  const requiredEvidence = [...new Set([
    ...worksRequiredEvidence,
    ...params.intelligencePack.missingEvidence.filter((item) => /BOM|交期|验收|供应链|现场|设备|施工|质量|测试|产能|关键路径/.test(item)),
  ])];

  return {
    taskId: params.plan.taskId,
    departmentId: 'works',
    focusQuestion: `请工部 CTO/CPO Delivery Office 判断「${params.draftEdict.originalQuestion}」的技术方案、BOM、供应链、交期、验收、现场条件和交付承诺边界。`,
    requiredEvidence,
    expectedOutputs: ['CTO/CPO 立场', '交付缺证清单', '不可承诺事项', '跨部门复核', '唯一下一步', '人工确认要求'],
    sourceLabel,
  };
}

export function buildDepartmentWorkOrders(params: {
  plan: UnifiedReviewPlan;
  draftEdict: UnifiedDraftEdict;
  intelligencePack: IntelligencePack;
}): UnifiedDepartmentWorkOrders {
  const finance = buildHubuDepartmentWorkOrder(params);
  const war = buildBingbuDepartmentWorkOrder(params);
  const justice = buildXingbuDepartmentWorkOrder(params);
  const ritual = buildRitesDepartmentWorkOrder(params);
  const works = buildGongbuDepartmentWorkOrder(params);
  return {
    ...(finance ? { finance } : {}),
    ...(war ? { war } : {}),
    ...(justice ? { justice } : {}),
    ...(ritual ? { ritual } : {}),
    ...(works ? { works } : {}),
  };
}

function buildDepartmentOpinion(
  departmentId: UnifiedDepartmentId,
  draftEdict: UnifiedDraftEdict,
  intel: IntelligencePack,
  sourceLabel: SourceLabel,
  workOrders: UnifiedDepartmentWorkOrders = {},
): DepartmentOpinion {
  if (departmentId === 'finance') {
    return buildHubuDepartmentOpinion({
      draftEdict,
      intelligencePack: intel,
      departmentWorkOrder: workOrders.finance,
      sourceLabel,
    });
  }
  if (departmentId === 'war') {
    return buildBingbuDepartmentOpinion({
      draftEdict,
      intelligencePack: intel,
      departmentWorkOrder: workOrders.war,
      sourceLabel,
    });
  }
  if (departmentId === 'justice') {
    return buildXingbuDepartmentOpinion({
      draftEdict,
      intelligencePack: intel,
      departmentWorkOrder: workOrders.justice,
      sourceLabel,
    });
  }
  if (departmentId === 'ritual') {
    return buildRitesDepartmentOpinion({
      draftEdict,
      intelligencePack: intel,
      departmentWorkOrder: workOrders.ritual,
      sourceLabel,
    });
  }
  if (departmentId === 'works') {
    return buildGongbuDepartmentOpinion({
      draftEdict,
      intelligencePack: intel,
      departmentWorkOrder: workOrders.works,
      sourceLabel,
    });
  }

  const department = getDepartment(departmentId);
  const text = `${draftEdict.originalQuestion}\n${draftEdict.refinedQuestion}`;
  const highRisk = hasAny(text, department.highRiskKeywords);
  const missingEvidence = department.requiredEvidence.filter((item) => !text.includes(item));
  const evidence = [`${department.name}依据：${department.mission}`, ...intel.evidenceBasis];
  let signal: UnifiedSignal = missingEvidence.length > 1 ? 'YELLOW' : 'GREEN';
  let verdict: UnifiedVerdict = missingEvidence.length > 1 ? 'NEED_EVIDENCE' : 'APPROVE';

  if (sourceLabel === 'FALLBACK' || sourceLabel === 'DEMO') {
    signal = 'GRAY';
    verdict = 'NEED_EVIDENCE';
  }

  return {
    departmentId,
    signal,
    verdict,
    summary:
      signal === 'GREEN'
        ? `${department.name}认为可进入下一步，但仍需保留证据链。`
        : `${department.name}要求先补证：${missingEvidence.slice(0, 2).join('、') || '证据链'}`,
    evidence,
    missingEvidence,
    risks: [
      ...(highRisk ? [`${department.name}识别高风险：${department.highRiskKeywords.filter((kw) => text.includes(kw)).join('、') || '需人工确认'}`] : []),
      ...(missingEvidence.length ? [`${department.name}缺证不能被包装成确定性结论`] : []),
    ],
    nextAction: missingEvidence[0] ? `补齐${missingEvidence[0]}` : '进入军机处合奏',
    needsHumanConfirmation: highRisk,
    sourceLabel,
  };
}

export function runEnabledDepartmentReviews(
  plan: UnifiedReviewPlan,
  draftEdict: UnifiedDraftEdict,
  intelligencePack: IntelligencePack,
  workOrders: UnifiedDepartmentWorkOrders = {},
  /** 接点①:户部声音改用真主库数字裁决(铁律6 一个户部脑)。 */
  financeOpinionOverride?: DepartmentOpinion,
): DepartmentOpinion[] {
  const opinions = plan.selectedDepartments
    .filter((id) => id !== 'jinyiwei')
    .filter((id) => DEPARTMENT_REGISTRY[id]?.enabled)
    .map((id) =>
      id === 'finance' && financeOpinionOverride
        ? financeOpinionOverride
        : buildDepartmentOpinion(id, draftEdict, intelligencePack, plan.sourceLabel, workOrders),
    );
  // 有真户部裁决但计划没选中户部 → 补进来(我们确有财务意见,合奏不该缺席)。不可变:spread 不 push(会审 MEDIUM-1)。
  return financeOpinionOverride && !opinions.some((o) => o.departmentId === 'finance')
    ? [...opinions, financeOpinionOverride]
    : opinions;
}

export function identifyUnifiedConflicts(opinions: DepartmentOpinion[]): UnifiedConflict[] {
  const conflicts: UnifiedConflict[] = [];
  const greens = opinions.filter((item) => item.signal === 'GREEN');
  const blockers = opinions.filter((item) => item.signal === 'RED' || item.signal === 'YELLOW');
  for (const green of greens) {
    for (const blocker of blockers) {
      if (green.departmentId === blocker.departmentId) continue;
      conflicts.push({
        between: [green.departmentId, blocker.departmentId],
        summary: `${getDepartment(green.departmentId).name}倾向推进，但${getDepartment(blocker.departmentId).name}${blocker.signal === 'RED' ? '红灯阻断' : '要求补证'}：${blocker.summary}`,
      });
    }
  }
  const byId = new Map(opinions.map((opinion) => [opinion.departmentId, opinion]));
  const addTension = (a: UnifiedDepartmentId, b: UnifiedDepartmentId, summary: string) => {
    if (!byId.has(a) || !byId.has(b)) return;
    if (conflicts.some((conflict) => conflict.between[0] === a && conflict.between[1] === b)) return;
    conflicts.push({ between: [a, b], summary });
  };
  const war = byId.get('war');
  const finance = byId.get('finance');
  const justice = byId.get('justice');
  const ritual = byId.get('ritual');
  const works = byId.get('works');
  const personnel = byId.get('personnel');
  if (war && finance && (finance.signal === 'YELLOW' || finance.signal === 'RED')) {
    addTension('war', 'finance', `兵部关注客户机会，但户部未放行财务边界：${finance.summary}`);
  }
  if (war && justice && (justice.signal === 'YELLOW' || justice.signal === 'RED')) {
    addTension('war', 'justice', `兵部关注推进节奏，但刑部提示对外承诺或合同风险：${justice.summary}`);
  }
  if (ritual && justice && (justice.signal === 'YELLOW' || justice.signal === 'RED')) {
    addTension('ritual', 'justice', `礼部可以形成对外表达草稿，但刑部未放行法律或承诺边界：${justice.summary}`);
  }
  if (ritual && finance && (finance.signal === 'YELLOW' || finance.signal === 'RED')) {
    addTension('ritual', 'finance', `礼部可以整理客户口径，但户部未放行报价、收益或投入数字：${finance.summary}`);
  }
  if (war && works && (works.signal === 'YELLOW' || works.signal === 'RED')) {
    addTension('war', 'works', `兵部关注客户推进节奏，但工部未放行交付、BOM、交期或验收条件：${works.summary}`);
  }
  if (ritual && works && (works.signal === 'YELLOW' || works.signal === 'RED')) {
    addTension('ritual', 'works', `礼部可以整理客户口径，但工部未放行交付能力或固定交期：${works.summary}`);
  }
  if (works && justice && works.needsHumanConfirmation) {
    addTension('works', 'justice', `工部识别交付承诺或供应商锁定风险，需刑部复核不可逆承诺：${works.summary}`);
  }
  if (works && finance && (finance.signal === 'YELLOW' || finance.signal === 'RED')) {
    addTension('works', 'finance', `工部交付方案不能脱离户部财务边界：${finance.summary}`);
  }
  if (personnel && personnel.signal !== 'GREEN') {
    for (const opinion of opinions) {
      if (opinion.departmentId === 'personnel') continue;
      addTension(opinion.departmentId, 'personnel', `${getDepartment(opinion.departmentId).name}意见不能直接执行，吏部尚未确认责任承接：${personnel.summary}`);
    }
  }
  return conflicts;
}

export function buildInteractionCheckpoint(
  intel: IntelligencePack,
  opinions: DepartmentOpinion[],
  sourceLabel: SourceLabel,
): InteractionCard | undefined {
  const allMissing = [...new Set([...intel.missingEvidence, ...opinions.flatMap((item) => item.missingEvidence)])];
  if (allMissing.length === 0) return undefined;
  const topGap = allMissing[0];
  return {
    id: `interaction_${topGap}`,
    question: `当前最缺一项材料：${topGap}。是否补充？`,
    reason: '统一 Loop 原则：能继续就继续，不能继续才问；一次只问最关键问题。',
    actions: ['UPLOAD_EVIDENCE', 'ANSWER_TEXT', 'CONTINUE_WITH_GAPS'],
    sourceLabel,
  };
}

function computeMemorialVerdict(opinions: DepartmentOpinion[], sourceLabel: SourceLabel): UnifiedVerdict {
  if (opinions.some((item) => item.signal === 'RED')) return 'RECHECK';
  if (sourceLabel === 'FALLBACK' || sourceLabel === 'DEMO') return 'NEED_EVIDENCE';
  if (opinions.filter((item) => item.signal === 'YELLOW' || item.signal === 'GRAY').length > 0) return 'NEED_EVIDENCE';
  return 'APPROVE';
}

export function synthesizeUnifiedMemorial(params: {
  draftEdict: UnifiedDraftEdict;
  intelligencePack: IntelligencePack;
  opinions: DepartmentOpinion[];
  conflicts: UnifiedConflict[];
  sourceLabel: SourceLabel;
}): UnifiedMemorial {
  const evidence = [...new Set([
    ...params.intelligencePack.evidenceBasis,
    ...params.opinions.flatMap((item) => item.evidence),
  ])];
  const missingEvidence = [...new Set([
    ...params.intelligencePack.missingEvidence,
    ...params.opinions.flatMap((item) => item.missingEvidence),
  ])];
  const risks = [...new Set(params.opinions.flatMap((item) => item.risks))];
  const needsHumanConfirmation = params.opinions.some((item) => item.needsHumanConfirmation);
  const verdict = computeMemorialVerdict(params.opinions, params.sourceLabel);
  const blockingIssues = [
    ...(needsHumanConfirmation ? ['高风险事项必须人工确认'] : []),
    ...(params.sourceLabel === 'FALLBACK' || params.sourceLabel === 'DEMO' ? [`${params.sourceLabel} 不得作为最终强结论`] : []),
    ...(params.opinions.some((item) => item.signal === 'RED') ? ['红灯部门不能被最终奏折静默忽略'] : []),
  ];
  return {
    verdict,
    oneSentence:
      verdict === 'APPROVE'
        ? '当前可推进，但必须带证据链归档。'
        : verdict === 'RECHECK'
          ? '当前不能直接采纳，需先复核红灯与人工确认项。'
          : '当前最稳妥动作是补证后再裁决。',
    departmentSummaries: params.opinions,
    intelligencePack: params.intelligencePack,
    conflicts: params.conflicts,
    evidence,
    missingEvidence,
    risks,
    nextAction: blockingIssues.length > 0
      ? '先处理质门阻断项'
      : missingEvidence[0]
        ? `先补齐${missingEvidence[0]}`
        : '进入用户裁决',
    qualityGate: {
      passed: blockingIssues.length === 0,
      blockingIssues,
      warnings: missingEvidence.length ? ['存在缺证，不能包装成确定性结论'] : [],
    },
    sourceLabel: params.sourceLabel,
    needsHumanConfirmation,
  };
}

export function runCourtUnifiedDecisionLoop(params: {
  rawQuestion: string;
  taskId?: string;
  sourceLabel?: SourceLabel;
  /** 接点①:户部声音改用真主库数字裁决(features/hubu/evaluateProject → hubuEvaluationToOpinion)。 */
  financeOpinionOverride?: DepartmentOpinion;
}): UnifiedLoopResult {
  const sourceLabel = params.sourceLabel ?? 'MIXED';
  const taskId = params.taskId ?? makeTaskId(params.rawQuestion);
  const loopTraceId = loopTraceIdForTask(taskId);
  const draftEdict = draftUnifiedEdict(params.rawQuestion, sourceLabel);
  const reviewPlan = planUnifiedReview({ taskId, draftEdict, sourceLabel });
  const intelligencePack = buildIntelligencePack(reviewPlan, draftEdict);
  const departmentWorkOrders = buildDepartmentWorkOrders({ plan: reviewPlan, draftEdict, intelligencePack });
  const departmentOpinions = runEnabledDepartmentReviews(reviewPlan, draftEdict, intelligencePack, departmentWorkOrders, params.financeOpinionOverride);
  const conflicts = identifyUnifiedConflicts(departmentOpinions);
  const interactionCard = buildInteractionCheckpoint(intelligencePack, departmentOpinions, sourceLabel);
  const mergedSourceLabel = mergeSourceLabels([
    draftEdict.sourceLabel,
    reviewPlan.sourceLabel,
    intelligencePack.sourceLabel,
    ...departmentOpinions.map((item) => item.sourceLabel),
  ]);
  const memorial = synthesizeUnifiedMemorial({
    draftEdict,
    intelligencePack,
    opinions: departmentOpinions,
    conflicts,
    sourceLabel: mergedSourceLabel,
  });

  return {
    taskId,
    loopTraceId,
    loopId: LOOP_ID,
    states: [
      'DAILY_PREP',
      'HOME_READY',
      'INTAKE_RECEIVED',
      'DRAFT_READY',
      'EMPEROR_CONFIRMED',
      'REVIEW_PLANNED',
      'INTELLIGENCE_READY',
      'DEPARTMENTS_REVIEWED',
      'EVIDENCE_AUDITED',
      'CONFLICTS_IDENTIFIED',
      ...(interactionCard ? ['INTERACTION_CHECKPOINT' as const] : []),
      'MEMORIAL_READY',
      'QUALITY_GATED',
      'CHANCELLOR_BRIEFED',
    ],
    draftEdict,
    reviewPlan,
    intelligencePack,
    departmentWorkOrders,
    departmentOpinions,
    conflicts,
    interactionCard,
    memorial,
    sourceLabel: mergedSourceLabel,
  };
}

export function currentEnabledDepartmentNames(): string[] {
  return enabledDepartmentIds().map((id) => getDepartment(id).name);
}

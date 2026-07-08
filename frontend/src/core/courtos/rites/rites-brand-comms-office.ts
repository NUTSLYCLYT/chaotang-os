import type { SourceLabel } from '../types';
import { mergeSourceLabels } from '../source-label.ts';
import type { DepartmentOpinion, IntelligencePack, UnifiedDraftEdict } from '../unified/unified-types.ts';
import type {
  RitesBrandCommsOfficeLoopInput,
  RitesBrandCommsOfficeLoopResult,
  RitesBrandCommsQuestionType,
  RitesCMOCCOOpinion,
  RitesConfidence,
  RitesDepartmentWorkOrder,
  RitesEvidence,
  RitesGeneratedArtifact,
  RitesMessageRiskLevel,
  RitesPosition,
  RitesQualityGateResult,
  RitesSubOfficeId,
  RitesSubOfficeOpinion,
} from './rites-types.ts';

const SUB_OFFICE_NAMES: Record<RitesSubOfficeId, string> = {
  rites_cmo_cco_chief: '礼部尚书',
  rites_brand_strategy: '品牌司',
  rites_customer_insight: '客群司',
  rites_content_copy: '文宣司',
  rites_partnership_pitch: '招商司',
  rites_pr_reputation: '公关司',
  rites_channel_campaign: '传播渠道司',
  rites_message_quality_gate: '审辞司',
};

const FORBIDDEN_MARKETING_EXPRESSIONS = ['保底收益', '稳赚', '无风险', '行业第一', '唯一', '最强', '一定交付', '保证收益', '包成功'];

function hasAny(text: string, words: readonly string[]): boolean {
  return words.some((word) => text.includes(word));
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items.filter(Boolean))];
}

function makeEvidence(title: string, sourceLabel: SourceLabel): RitesEvidence {
  return {
    title,
    sourceType: sourceLabel === 'FALLBACK' || sourceLabel === 'DEMO' ? 'FALLBACK' : 'USER_INPUT',
    usable: sourceLabel !== 'DEMO',
    confidence: sourceLabel === 'LIVE' || sourceLabel === 'LIVE_SWARM' ? '高' : '中',
  };
}

function makeTypedEvidence(
  title: string,
  sourceType: RitesEvidence['sourceType'],
  sourceLabel: SourceLabel,
  sourceRef?: string,
): RitesEvidence {
  return {
    title,
    sourceType,
    sourceRef,
    usable: sourceType !== 'FALLBACK' && sourceLabel !== 'DEMO',
    confidence: sourceLabel === 'LIVE' || sourceLabel === 'LIVE_SWARM' ? '高' : '中',
  };
}

export function classifyRitesBrandCommsQuestion(text: string): RitesBrandCommsQuestionType {
  if (hasAny(text, ['AI 生成', 'AI生成', '直接发', '自动发送', '能不能直接发'])) return 'AI生成内容审查';
  if (hasAny(text, ['危机', '舆情', '投诉', '第一小时', '回应声明', '负面'])) return '危机沟通';
  if (hasAny(text, ['媒体', '采访', '新闻稿', '记者', 'Q&A', '公关'])) return '公关媒体';
  if (hasAny(text, ['竞品', '对手', '不专业', '贬低', '行业第一'])) return '竞品回应';
  if (hasAny(text, ['客户案例', '案例公开', 'Logo', '公开客户'])) return '客户案例授权';
  if (hasAny(text, ['正式报价', '报价', '报价话术', '价格'])) return '正式报价表达';
  if (hasAny(text, ['招商', 'Pitch Deck', '合作方案', '保底收益', 'ROI', '收益承诺', '合作介绍'])) return '招商材料';
  if (hasAny(text, ['官网', '公司介绍', '产品介绍', 'PPT', '宣传册', '定位'])) return hasAny(text, ['定位']) ? '品牌定位' : '官网/宣传资料';
  if (hasAny(text, ['展会', '朋友圈', '公众号', '小红书', 'LinkedIn', '社媒', '活动'])) return '销售话术';
  if (hasAny(text, ['邮件', '回复', '客户问', '客户催', '客户来访', '会议议程'])) return '客户回复';
  return '其他品牌传播问题';
}

export function selectRitesSubOffices(type: RitesBrandCommsQuestionType, text: string): RitesSubOfficeId[] {
  const selected = new Set<RitesSubOfficeId>(['rites_cmo_cco_chief', 'rites_message_quality_gate']);
  const add = (...ids: RitesSubOfficeId[]) => ids.forEach((id) => selected.add(id));

  switch (type) {
    case '客户回复':
      add('rites_customer_insight', 'rites_content_copy');
      break;
    case '销售话术':
      add('rites_customer_insight', 'rites_content_copy', 'rites_channel_campaign');
      break;
    case '招商材料':
      add('rites_brand_strategy', 'rites_customer_insight', 'rites_partnership_pitch', 'rites_content_copy');
      break;
    case '品牌定位':
      add('rites_brand_strategy', 'rites_customer_insight', 'rites_content_copy');
      break;
    case '官网/宣传资料':
      add('rites_brand_strategy', 'rites_content_copy', 'rites_customer_insight');
      break;
    case '公关媒体':
      add('rites_pr_reputation', 'rites_brand_strategy', 'rites_content_copy');
      break;
    case '危机沟通':
      add('rites_pr_reputation', 'rites_customer_insight', 'rites_content_copy');
      break;
    case '竞品回应':
      add('rites_pr_reputation', 'rites_brand_strategy', 'rites_content_copy');
      break;
    case '正式报价表达':
      add('rites_customer_insight', 'rites_content_copy', 'rites_partnership_pitch');
      break;
    case '客户案例授权':
      add('rites_pr_reputation', 'rites_brand_strategy', 'rites_content_copy');
      break;
    case 'AI生成内容审查':
      add('rites_content_copy');
      break;
    default:
      add('rites_customer_insight', 'rites_content_copy');
  }

  if (hasAny(text, ['媒体', '危机', '舆情', '投诉', '竞品', '不专业', '行业第一'])) selected.add('rites_pr_reputation');
  if (hasAny(text, ['招商', '合作方案', 'Pitch Deck', '投资回报', '保底收益'])) selected.add('rites_partnership_pitch');
  if (hasAny(text, ['展会', '公众号', '朋友圈', '小红书', 'LinkedIn', '渠道', '活动'])) selected.add('rites_channel_campaign');
  return [...selected];
}

function requiredRitesEvidence(type: RitesBrandCommsQuestionType, text: string): string[] {
  const common = ['目标受众', '沟通目标', '使用渠道'];
  if (type === '正式报价表达') return [...common, '报价依据', '成本边界', '报价有效期', '审批人'];
  if (type === '招商材料') return [...common, '价值主张依据', '合作边界', '收益/ROI 依据', '风险披露'];
  if (type === '危机沟通') return [...common, '事实核验', '责任边界', '法务复核', '统一口径审批'];
  if (type === '公关媒体') return [...common, '事实核验', '媒体问题清单', '禁答边界', '授权发言人'];
  if (type === '竞品回应') return [...common, '竞品事实证据', '第三方依据', '刑部复核'];
  if (type === '客户案例授权') return [...common, '客户授权', '隐私权限', '可公开范围'];
  if (type === '品牌定位') return [...common, '品牌事实依据', '客户痛点证据', '差异化依据'];
  if (type === '官网/宣传资料') return [...common, '产品事实依据', '客户价值证据', '禁用表达清单'];
  if (type === 'AI生成内容审查') return [...common, '人工复核记录', '审辞司质门', '对外发布授权'];
  if (hasAny(text, ['交期', '交付', '30 天', '30天'])) return [...common, '交期依据', '交付条件', '相关部门复核'];
  return common;
}

function inferMissingEvidence(text: string, required: string[]): string[] {
  return required.filter((item) => !text.includes(item));
}

function inferAudienceGoalChannel(text: string, workOrder?: RitesDepartmentWorkOrder): {
  audience: string;
  goal: string;
  channel: string;
} {
  const audience = workOrder?.audience
    ?? (hasAny(text, ['媒体', '记者']) ? '媒体/公众'
      : hasAny(text, ['招商', '合作方', '伙伴']) ? '合作方/招商对象'
        : hasAny(text, ['员工', '内部']) ? '内部团队'
          : '客户/潜在客户');
  const goal = workOrder?.goal
    ?? (hasAny(text, ['危机', '投诉', '舆情']) ? '控制风险并稳定信任'
      : hasAny(text, ['报价']) ? '安全回应报价诉求'
        : hasAny(text, ['招商', '合作']) ? '说明合作价值并避免越界承诺'
          : '清晰表达价值并推进下一步沟通');
  const channel = workOrder?.channel
    ?? (hasAny(text, ['公众号']) ? '公众号'
      : hasAny(text, ['朋友圈']) ? '朋友圈'
        : hasAny(text, ['小红书']) ? '小红书'
          : hasAny(text, ['LinkedIn']) ? 'LinkedIn'
            : hasAny(text, ['邮件']) ? '邮件'
              : hasAny(text, ['媒体', '新闻稿']) ? '媒体/新闻稿'
                : hasAny(text, ['展会']) ? '展会现场'
                  : '一对一客户沟通');
  return { audience, goal, channel };
}

function inferRequiredCrossReviews(type: RitesBrandCommsQuestionType, text: string): string[] {
  const reviews: string[] = [];
  if (type === '正式报价表达' || hasAny(text, ['正式报价', '报价', '价格', '收益', 'ROI', '保底收益', '投资回报'])) {
    reviews.push('户部', '刑部');
  }
  if (hasAny(text, ['合同', '股权', '独家', '付款', '法律责任', '承诺', '正式声明'])) reviews.push('刑部');
  if (hasAny(text, ['交期', '交付', '30 天', '30天', '产能', '技术能力'])) reviews.push('工部', '刑部');
  if (type === '危机沟通' || type === '公关媒体' || hasAny(text, ['媒体', '危机', '舆情', '采访'])) reviews.push('公关司', '刑部', '军机处');
  if (type === '竞品回应' || hasAny(text, ['竞品', '行业第一', '对手'])) reviews.push('锦衣卫', '刑部');
  if (type === '客户案例授权' || hasAny(text, ['客户案例', 'Logo', '隐私'])) reviews.push('隐私权限检查', '刑部');
  if (hasAny(text, ['客户意图', '销售', '成交', '展会'])) reviews.push('兵部');
  return unique(reviews);
}

function inferForbiddenExpressions(text: string): string[] {
  return FORBIDDEN_MARKETING_EXPRESSIONS.filter((word) => text.includes(word));
}

function inferMessageRiskLevel(params: {
  text: string;
  type: RitesBrandCommsQuestionType;
  sourceLabel: SourceLabel;
  missingEvidence: string[];
  forbiddenExpressions: string[];
}): RitesMessageRiskLevel {
  const { text, type, sourceLabel, missingEvidence, forbiddenExpressions } = params;
  if (forbiddenExpressions.some((word) => ['保底收益', '稳赚', '无风险', '行业第一', '包成功'].includes(word))) return 'BLOCKED';
  if (type === '危机沟通' || type === '公关媒体') return 'HIGH';
  if (hasAny(text, ['正式报价', '合同', '股权', '独家', '付款', '正式声明', '法律责任'])) return 'HIGH';
  if (hasAny(text, ['ROI', '收益', '交期', '交付', '竞品', '客户案例', '隐私'])) return 'HIGH';
  if (type === 'AI生成内容审查') return 'HIGH';
  if ((sourceLabel === 'FALLBACK' || sourceLabel === 'DEMO') && missingEvidence.length > 0) return 'HIGH';
  if (missingEvidence.length > 3) return 'MEDIUM';
  return 'LOW';
}

function buildRitesLoopText(params: {
  confirmedEdict: UnifiedDraftEdict;
  intelligencePack?: IntelligencePack;
  departmentWorkOrder?: RitesDepartmentWorkOrder;
}): string {
  const { confirmedEdict, intelligencePack, departmentWorkOrder } = params;
  return [
    confirmedEdict.originalQuestion,
    confirmedEdict.refinedQuestion,
    confirmedEdict.decisionType,
    ...confirmedEdict.knownFacts,
    departmentWorkOrder?.audience,
    departmentWorkOrder?.goal,
    departmentWorkOrder?.channel,
    ...(departmentWorkOrder?.requestedArtifacts ?? []),
    ...(departmentWorkOrder?.requiredEvidence ?? []),
    ...(departmentWorkOrder?.expectedOutputs ?? []),
    ...(intelligencePack?.facts ?? []),
    ...(intelligencePack?.evidenceBasis ?? []),
  ]
    .filter(Boolean)
    .join('\n');
}

function collectRitesLoopEvidence(params: {
  intelligencePack?: IntelligencePack;
  departmentWorkOrder?: RitesDepartmentWorkOrder;
  sourceLabel: SourceLabel;
}): RitesEvidence[] {
  const { intelligencePack, departmentWorkOrder, sourceLabel } = params;
  const evidence: RitesEvidence[] = [];
  if (intelligencePack) {
    for (const fact of intelligencePack.facts) {
      evidence.push(makeTypedEvidence(`锦衣卫事实：${fact}`, 'TOOL_RESULT', intelligencePack.sourceLabel));
    }
    for (const basis of intelligencePack.evidenceBasis) {
      evidence.push(makeTypedEvidence(`锦衣卫证据：${basis}`, 'TOOL_RESULT', intelligencePack.sourceLabel));
    }
  }
  if (departmentWorkOrder?.goal || departmentWorkOrder?.requestedArtifacts?.length) {
    evidence.push(makeTypedEvidence(
      `军机处礼部工单：${departmentWorkOrder.goal ?? departmentWorkOrder.requestedArtifacts?.join('、')}`,
      'USER_INPUT',
      departmentWorkOrder.sourceLabel ?? sourceLabel,
    ));
  }
  return evidence;
}

function buildSubOfficeOpinion(params: {
  officeId: RitesSubOfficeId;
  type: RitesBrandCommsQuestionType;
  text: string;
  missingEvidence: string[];
  forbiddenExpressions: string[];
  requiredCrossReviews: string[];
  messageRiskLevel: RitesMessageRiskLevel;
  sourceLabel: SourceLabel;
}): RitesSubOfficeOpinion {
  const { officeId, type, text, missingEvidence, forbiddenExpressions, requiredCrossReviews, messageRiskLevel, sourceLabel } = params;
  const evidenceUsed = [makeEvidence('用户原始问题', sourceLabel)];
  const risks: string[] = [];
  let position: RitesPosition = missingEvidence.length > 0 ? '补证' : '可作为草稿';
  let finding = `${SUB_OFFICE_NAMES[officeId]}认为当前可先形成内部草稿，但不得未经审查外发。`;
  const officeMissingEvidence: string[] = [];
  const officeForbiddenExpressions: string[] = [];
  const officeReviews: string[] = [];

  if (officeId === 'rites_brand_strategy') {
    officeMissingEvidence.push(...missingEvidence.filter((item) => /品牌|价值|差异|客户痛点|事实依据/.test(item)));
    finding = officeMissingEvidence.length ? '品牌主张和信任资产依据不足，不能写成确定性领先叙事。' : '品牌叙事有基础，可进入表达打磨。';
    risks.push(...(officeMissingEvidence.length ? ['品牌主张无证据', '信任资产不足'] : []));
  }

  if (officeId === 'rites_customer_insight') {
    officeMissingEvidence.push(...missingEvidence.filter((item) => /目标受众|客户|痛点|决策|需求/.test(item)));
    finding = officeMissingEvidence.length ? '目标受众、客户痛点或决策链不清，容易写成自说自话。' : '客户视角较清晰，可围绕痛点组织表达。';
    risks.push(...(officeMissingEvidence.length ? ['受众不清', '价值主张错位'] : []));
  }

  if (officeId === 'rites_content_copy') {
    officeMissingEvidence.push(...missingEvidence.filter((item) => /沟通目标|使用渠道|产品|禁用表达|人工复核/.test(item)));
    officeForbiddenExpressions.push(...forbiddenExpressions);
    finding = forbiddenExpressions.length ? '文案含高风险绝对化或承诺性表达，必须改写。' : '可生成内部草稿，但需要审辞司复核后才能外发。';
    position = forbiddenExpressions.length ? '先改稿' : position;
    risks.push(...(forbiddenExpressions.length ? ['夸大宣传', '承诺性表达'] : []));
  }

  if (officeId === 'rites_partnership_pitch') {
    officeMissingEvidence.push(...missingEvidence.filter((item) => /合作|招商|收益|ROI|风险披露|边界/.test(item)));
    officeReviews.push(...requiredCrossReviews.filter((item) => item === '户部' || item === '刑部'));
    finding = officeMissingEvidence.length || officeReviews.length
      ? '招商材料涉及收益、合作边界或对外承诺，需先补证并联动户部/刑部。'
      : '招商材料可形成草稿，仍需保留证据链。';
    risks.push(...(officeReviews.length ? ['收益承诺风险', '合作边界越界'] : []));
  }

  if (officeId === 'rites_pr_reputation') {
    officeMissingEvidence.push(...missingEvidence.filter((item) => /事实核验|媒体|危机|口径|授权|竞品/.test(item)));
    officeReviews.push(...requiredCrossReviews.filter((item) => ['刑部', '军机处', '锦衣卫', '公关司'].includes(item)));
    finding = type === '危机沟通' || type === '公关媒体'
      ? '公关/媒体事项必须先统一事实和授权口径，不能抢发。'
      : '声誉风险需要事实证据支撑，避免攻击性竞品表述。';
    risks.push(...(officeReviews.length || officeMissingEvidence.length ? ['声誉风险', '舆情扩散风险'] : []));
    position = officeReviews.length ? '复核' : position;
  }

  if (officeId === 'rites_channel_campaign') {
    officeMissingEvidence.push(...missingEvidence.filter((item) => /使用渠道|节奏|目标受众|活动/.test(item)));
    finding = officeMissingEvidence.length ? '渠道、节奏或触点未明确，内容不应直接发布。' : '渠道表达可进入版本生成。';
    risks.push(...(officeMissingEvidence.length ? ['渠道错配', '传播节奏失控'] : []));
  }

  if (officeId === 'rites_message_quality_gate') {
    officeMissingEvidence.push(...missingEvidence);
    officeForbiddenExpressions.push(...forbiddenExpressions);
    officeReviews.push(...requiredCrossReviews);
    if (messageRiskLevel === 'BLOCKED') {
      position = '禁止外发';
      finding = '审辞司阻断：存在绝对化、收益承诺、无证据领先或其他不可直接外发表达。';
    } else if (messageRiskLevel === 'HIGH') {
      position = '复核';
      finding = '审辞司要求高风险对外表达先完成跨部门复核和人工确认。';
    } else {
      finding = '审辞司允许生成内部草稿，但仍不得自动外发。';
    }
    risks.push(...(messageRiskLevel === 'LOW' ? [] : ['表达质门风险']));
  }

  if (officeId === 'rites_cmo_cco_chief') {
    officeReviews.push(...requiredCrossReviews);
    finding = messageRiskLevel === 'BLOCKED'
      ? '礼部尚书判断当前表达不能外发，应先改稿并补证。'
      : messageRiskLevel === 'HIGH'
        ? '礼部尚书判断该事项可做内部草稿，但必须进入复核。'
        : '礼部尚书判断可先形成内部表达草稿。';
    position = messageRiskLevel === 'BLOCKED' ? '禁止外发' : messageRiskLevel === 'HIGH' ? '复核' : position;
    risks.push(...(requiredCrossReviews.length ? ['跨部门复核未完成'] : []));
  }

  if (messageRiskLevel === 'BLOCKED') position = '禁止外发';

  return {
    officeId,
    officeName: SUB_OFFICE_NAMES[officeId],
    position,
    finding,
    evidenceUsed,
    missingEvidence: unique(officeMissingEvidence),
    forbiddenExpressions: unique(officeForbiddenExpressions),
    risks: unique(risks),
    requiredCrossReviews: unique(officeReviews),
  };
}

function synthesizePosition(subOpinions: RitesSubOfficeOpinion[], messageRiskLevel: RitesMessageRiskLevel, sourceLabel: SourceLabel): RitesPosition {
  if (messageRiskLevel === 'BLOCKED') return '禁止外发';
  if (sourceLabel === 'FALLBACK' || sourceLabel === 'DEMO') return '补证';
  if (subOpinions.some((item) => item.position === '复核')) return '复核';
  if (subOpinions.some((item) => item.position === '先改稿')) return '先改稿';
  if (subOpinions.some((item) => item.position === '补证')) return '补证';
  return '可作为草稿';
}

function buildNextAction(params: {
  position: RitesPosition;
  messageRiskLevel: RitesMessageRiskLevel;
  missingEvidence: string[];
  requiredCrossReviews: string[];
  type: RitesBrandCommsQuestionType;
}): string {
  const { position, messageRiskLevel, missingEvidence, requiredCrossReviews, type } = params;
  if (position === '禁止外发') return '先删除高风险承诺/绝对化表达，并补齐证据后重拟';
  if (messageRiskLevel === 'HIGH' || requiredCrossReviews.length > 0) return `先完成${requiredCrossReviews.slice(0, 3).join('、')}复核和人工确认`;
  if (missingEvidence.length > 0) return `先补齐${missingEvidence.slice(0, 4).join('、')}`;
  if (type === 'AI生成内容审查') return '交由审辞司做人工复核后再决定是否外发';
  return '生成内部草稿并提交审辞司复核';
}

function buildGeneratedArtifacts(params: {
  requestedArtifacts?: string[];
  type: RitesBrandCommsQuestionType;
  audience: string;
  goal: string;
  channel: string;
  sourceLabel: SourceLabel;
  evidenceUsed: RitesEvidence[];
  missingEvidence: string[];
  riskRegister: string[];
  requiredCrossReviews: string[];
  messageRiskLevel: RitesMessageRiskLevel;
}): RitesGeneratedArtifact[] {
  const defaultArtifact = params.type === '正式报价表达'
    ? '客户回复草稿'
    : params.type === '招商材料'
      ? '招商话术'
      : params.type === '危机沟通'
        ? '危机回应 holding statement'
        : params.type === '公关媒体'
          ? '媒体 Q&A'
          : params.type === '品牌定位'
            ? '品牌定位卡'
            : '对外邮件草稿';
  const artifactTypes = unique(params.requestedArtifacts?.length ? params.requestedArtifacts : [defaultArtifact]);
  const draftStatus: RitesGeneratedArtifact['draftStatus'] = params.messageRiskLevel === 'BLOCKED'
    ? 'BLOCKED'
    : params.messageRiskLevel === 'HIGH' || params.requiredCrossReviews.length > 0
      ? 'NEEDS_REVIEW'
      : 'DRAFT_ONLY';

  return artifactTypes.map((artifactType) => ({
    artifactType,
    audience: params.audience,
    goal: params.goal,
    channel: params.channel,
    draftStatus,
    contentOutline: [
      '先确认对方诉求和当前阶段',
      '只表达已证实能力和可讨论边界',
      '把报价、收益、交付、法律承诺留给复核后确认',
      '给出一个低风险下一步动作',
    ],
    evidenceUsed: params.evidenceUsed,
    missingEvidence: params.missingEvidence,
    riskFlags: params.riskRegister,
    requiredReviews: params.requiredCrossReviews,
    mayPublish: false,
    sourceLabel: params.sourceLabel,
  }));
}

export function runRitesBrandCommsOfficeReview(params: {
  text: string;
  sourceLabel?: SourceLabel;
  audience?: string;
  goal?: string;
  channel?: string;
  requestedArtifacts?: string[];
  extraEvidenceUsed?: RitesEvidence[];
  extraMissingEvidence?: string[];
}): RitesCMOCCOOpinion {
  const sourceLabel = params.sourceLabel ?? 'MIXED';
  const text = params.text.trim();
  const brandCommsQuestionType = classifyRitesBrandCommsQuestion(text);
  const requiredSubOffices = selectRitesSubOffices(brandCommsQuestionType, text);
  const context = inferAudienceGoalChannel(text, {
    departmentId: 'ritual',
    audience: params.audience,
    goal: params.goal,
    channel: params.channel,
  });
  const requiredEvidence = requiredRitesEvidence(brandCommsQuestionType, text);
  const missingEvidence = unique([
    ...inferMissingEvidence(text, requiredEvidence),
    ...(params.extraMissingEvidence ?? []),
  ]);
  const forbiddenExpressions = inferForbiddenExpressions(text);
  const requiredCrossReviews = inferRequiredCrossReviews(brandCommsQuestionType, text);
  const messageRiskLevel = inferMessageRiskLevel({
    text,
    type: brandCommsQuestionType,
    sourceLabel,
    missingEvidence,
    forbiddenExpressions,
  });
  const subOfficeOpinions = requiredSubOffices.map((officeId) => buildSubOfficeOpinion({
    officeId,
    type: brandCommsQuestionType,
    text,
    missingEvidence,
    forbiddenExpressions,
    requiredCrossReviews,
    messageRiskLevel,
    sourceLabel,
  }));
  const riskRegister = unique([
    ...subOfficeOpinions.flatMap((item) => item.risks),
    ...(requiredCrossReviews.length ? ['跨部门复核未完成'] : []),
    ...(forbiddenExpressions.length ? ['禁用表达命中'] : []),
  ]);
  const position = synthesizePosition(subOfficeOpinions, messageRiskLevel, sourceLabel);
  const evidenceUsed = unique([...(params.extraEvidenceUsed ?? []), makeEvidence('用户原始问题', sourceLabel)]);
  const generatedArtifacts = buildGeneratedArtifacts({
    requestedArtifacts: params.requestedArtifacts,
    type: brandCommsQuestionType,
    audience: context.audience,
    goal: context.goal,
    channel: context.channel,
    sourceLabel,
    evidenceUsed,
    missingEvidence,
    riskRegister,
    requiredCrossReviews,
    messageRiskLevel,
  });
  const nextBestAction = buildNextAction({
    position,
    messageRiskLevel,
    missingEvidence,
    requiredCrossReviews,
    type: brandCommsQuestionType,
  });
  const confidence: RitesConfidence = sourceLabel === 'LIVE' || sourceLabel === 'LIVE_SWARM'
    ? (missingEvidence.length ? '中' : '高')
    : missingEvidence.length > 2 ? '低' : '中';
  const highRiskRequiresHumanConfirmation = messageRiskLevel === 'HIGH'
    || messageRiskLevel === 'BLOCKED'
    || requiredCrossReviews.includes('刑部')
    || requiredCrossReviews.includes('户部')
    || requiredCrossReviews.includes('军机处');

  return {
    department: '礼部',
    position,
    confidence,
    executiveSummary: position === '可作为草稿'
      ? '礼部认为可以先形成内部表达草稿，但默认不得直接外发。'
      : position === '禁止外发'
        ? '礼部审辞司阻断当前表达：存在高风险承诺、绝对化表达或证据不足。'
        : '礼部建议先补证、改稿或完成跨部门复核，再形成可外发材料。',
    brandCommsQuestionType,
    requiredSubOffices,
    audience: context.audience,
    goal: context.goal,
    channel: context.channel,
    messageRiskLevel,
    keyMessages: [
      '只表达已证实事实和可讨论边界，收益、报价、交期、法律责任必须复核后再对外承诺。',
    ],
    subOfficeOpinions,
    generatedArtifacts,
    evidenceUsed,
    missingEvidence,
    forbiddenExpressions: unique(subOfficeOpinions.flatMap((item) => item.forbiddenExpressions)),
    requiredCrossReviews,
    riskRegister,
    nextBestAction,
    questionsForEmperor: missingEvidence[0] ? [`是否先补充「${missingEvidence[0]}」再生成对外材料？`] : [],
    highRiskRequiresHumanConfirmation,
    mayPublish: false,
    archiveReady: true,
    sourceLabel,
    source_label: sourceLabel,
  };
}

export function runRitesBrandCommsOfficeLoopV1(params: RitesBrandCommsOfficeLoopInput): RitesBrandCommsOfficeLoopResult {
  const labels: SourceLabel[] = [
    params.sourceLabel ?? params.confirmedEdict.sourceLabel,
    params.confirmedEdict.sourceLabel,
  ];
  if (params.intelligencePack) labels.push(params.intelligencePack.sourceLabel);
  if (params.departmentWorkOrder?.sourceLabel) labels.push(params.departmentWorkOrder.sourceLabel);
  const sourceLabel = mergeSourceLabels(labels);
  const text = buildRitesLoopText(params);
  const extraEvidenceUsed = collectRitesLoopEvidence({
    intelligencePack: params.intelligencePack,
    departmentWorkOrder: params.departmentWorkOrder,
    sourceLabel,
  });
  const extraMissingEvidence = unique([
    ...(params.confirmedEdict.unknownGaps ?? []),
    ...(params.intelligencePack?.missingEvidence ?? []),
    ...(params.departmentWorkOrder?.requiredEvidence ?? []),
  ]);
  const opinion = runRitesBrandCommsOfficeReview({
    text,
    sourceLabel,
    audience: params.departmentWorkOrder?.audience,
    goal: params.departmentWorkOrder?.goal,
    channel: params.departmentWorkOrder?.channel,
    requestedArtifacts: params.departmentWorkOrder?.requestedArtifacts,
    extraEvidenceUsed,
    extraMissingEvidence,
  });
  return {
    loopId: 'rites_brand_comms_office_loop_v1',
    opinion,
    qualityGate: evaluateRitesQualityGate(opinion),
  };
}

export function evaluateRitesQualityGate(opinion: RitesCMOCCOOpinion): RitesQualityGateResult {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const requiredActions: string[] = [];

  if (!opinion.sourceLabel || !opinion.source_label) blockingIssues.push('source_label_required');
  if (opinion.mayPublish) blockingIssues.push('no_external_message_without_review');
  if (opinion.evidenceUsed.length === 0 && opinion.missingEvidence.length === 0) blockingIssues.push('evidence_or_gap_required');
  if (opinion.forbiddenExpressions.length > 0) blockingIssues.push('no_exaggerated_marketing_claim');
  if (opinion.messageRiskLevel === 'BLOCKED') blockingIssues.push('blocked_message_risk');
  if (opinion.requiredCrossReviews.includes('户部')) requiredActions.push('no_roi_or_revenue_claim_without_hubu_review');
  if (opinion.requiredCrossReviews.includes('刑部')) requiredActions.push('no_legal_or_contract_claim_without_xingbu_review');
  if (opinion.requiredCrossReviews.includes('工部')) requiredActions.push('no_price_or_delivery_commitment_without_review');
  if (opinion.brandCommsQuestionType === 'AI生成内容审查') requiredActions.push('ai_generated_external_content_requires_review');
  if (opinion.brandCommsQuestionType === '危机沟通' || opinion.brandCommsQuestionType === '公关媒体') requiredActions.push('crisis_comms_requires_human_confirmation');
  if (opinion.requiredCrossReviews.includes('隐私权限检查')) requiredActions.push('sensitive_data_requires_permission_guard');
  if (opinion.requiredCrossReviews.includes('锦衣卫')) warnings.push('competitor_claims_require_evidence');
  if (!opinion.audience || !opinion.goal || !opinion.channel) blockingIssues.push('audience_and_goal_required');
  if (opinion.keyMessages.length !== 1) warnings.push('one_primary_message_required');
  if ((opinion.sourceLabel === 'FALLBACK' || opinion.sourceLabel === 'DEMO') && opinion.position === '可作为草稿') {
    blockingIssues.push('no_fallback_or_demo_external_certainty');
  }
  if (opinion.messageRiskLevel === 'HIGH' && !opinion.highRiskRequiresHumanConfirmation) {
    blockingIssues.push('high_risk_requires_human_confirmation');
  }
  if (opinion.missingEvidence.length > 0 && opinion.position === '可作为草稿') warnings.push('no_unverified_claims');

  const signal = blockingIssues.length > 0 || opinion.position === '禁止外发' || opinion.messageRiskLevel === 'BLOCKED'
    ? 'RED'
    : opinion.position === '复核' || opinion.messageRiskLevel === 'HIGH'
      ? 'RED'
      : opinion.position === '补证' || opinion.position === '先改稿'
        ? 'YELLOW'
        : opinion.sourceLabel === 'FALLBACK' || opinion.sourceLabel === 'DEMO'
          ? 'GRAY'
          : 'GREEN';
  const verdict = signal === 'RED' ? 'RECHECK' : signal === 'GREEN' ? 'APPROVE' : 'NEED_EVIDENCE';

  return {
    passed: blockingIssues.length === 0 && signal !== 'RED',
    signal,
    verdict,
    blockingIssues,
    warnings,
    requiredActions: unique(requiredActions),
    highRiskRequiresHumanConfirmation: opinion.highRiskRequiresHumanConfirmation,
    mayPublish: false,
    sourceLabel: opinion.sourceLabel,
  };
}

export function buildRitesDepartmentOpinion(params: {
  draftEdict: UnifiedDraftEdict;
  sourceLabel: SourceLabel;
  intelligencePack?: IntelligencePack;
  departmentWorkOrder?: RitesDepartmentWorkOrder;
}): DepartmentOpinion {
  const result = runRitesBrandCommsOfficeLoopV1({
    confirmedEdict: params.draftEdict,
    intelligencePack: params.intelligencePack,
    departmentWorkOrder: params.departmentWorkOrder,
    sourceLabel: params.sourceLabel,
  });
  const ritesOpinion = result.opinion;
  const gate = result.qualityGate;
  return {
    departmentId: 'ritual',
    signal: gate.signal,
    verdict: gate.verdict,
    summary: `礼部 CMO/CCO Office：${ritesOpinion.position}。${ritesOpinion.executiveSummary}`,
    evidence: ritesOpinion.evidenceUsed.map((item) => item.title),
    missingEvidence: ritesOpinion.missingEvidence,
    risks: unique([...ritesOpinion.riskRegister, ...gate.blockingIssues, ...gate.warnings, ...gate.requiredActions]),
    nextAction: ritesOpinion.nextBestAction,
    needsHumanConfirmation: ritesOpinion.highRiskRequiresHumanConfirmation || gate.signal === 'RED',
    sourceLabel: ritesOpinion.sourceLabel,
    ritesOpinion,
  };
}

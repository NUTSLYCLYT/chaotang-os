import type { EvoMapEvent, UnifiedLoopResult } from './unified-types.ts';

export type UnifiedUserAction = EvoMapEvent['userAction'];

export interface UnifiedArchiveLearningRecord {
  id: string;
  taskId: string;
  loopTraceId: string;
  originalQuestion: string;
  refinedIntent: string;
  verdict: string;
  sourceLabel: UnifiedLoopResult['sourceLabel'];
  overallSignal: string;
  missingEvidence: string[];
  needsHumanConfirmation: boolean;
  salesLearning?: {
    questionType: string;
    salesOwnerOrGap: string;
    opportunityStageOrGap: string;
    forbiddenActions: string[];
    crossDepartmentReviews: string[];
    maySendExternally: false;
  };
  deliveryLearning?: {
    questionType: string;
    forbiddenActions: string[];
    crossDepartmentReviews: string[];
    deliveryCommitmentRisk: boolean;
  };
  reusableLessons: string[];
  createdAt: string;
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function getHubuOpinion(result: UnifiedLoopResult) {
  return result.departmentOpinions.find((item) => item.departmentId === 'finance')?.cfoOpinion;
}

function getBingbuOpinion(result: UnifiedLoopResult) {
  return result.departmentOpinions.find((item) => item.departmentId === 'war')?.warOpinion;
}

function getGongbuOpinion(result: UnifiedLoopResult) {
  return result.departmentOpinions.find((item) => item.departmentId === 'works')?.gongbuOpinion;
}

function summarizeOverallSignal(result: UnifiedLoopResult): string {
  if (result.departmentOpinions.some((item) => item.signal === 'RED')) return 'RED';
  if (result.departmentOpinions.some((item) => item.signal === 'YELLOW')) return 'YELLOW';
  if (result.departmentOpinions.some((item) => item.signal === 'GRAY')) return 'GRAY';
  return 'GREEN';
}

export function extractUnifiedReusableLessons(result: UnifiedLoopResult): string[] {
  const hubu = getHubuOpinion(result);
  const bingbu = getBingbuOpinion(result);
  const gongbu = getGongbuOpinion(result);
  const lessons: string[] = [
    result.memorial.qualityGate.passed
      ? '质门通过时，仍需保留证据链和来源标签再进入归档。'
      : '质门阻断时，不能把缺证或高风险包装成确定性结论。',
  ];

  if (result.memorial.missingEvidence.length > 0) {
    lessons.push(`下次同类问题优先补齐：${result.memorial.missingEvidence.slice(0, 4).join('、')}。`);
  }
  if (result.memorial.needsHumanConfirmation) {
    lessons.push('涉及高风险、红灯或人工确认事项时，准奏前必须留下人工确认记录。');
  }
  if (result.conflicts.length > 0) {
    lessons.push('部门分歧必须进入奏折，不得用平均结论掩盖冲突。');
  }
  if (hubu) {
    lessons.push(`户部 CFO 对「${hubu.financeQuestionType}」的默认判断是：${hubu.cfoPosition}。`);
    if (hubu.missingEvidence.length > 0) {
      lessons.push(`户部同类问题优先检查：${hubu.missingEvidence.slice(0, 4).join('、')}。`);
    }
    if (hubu.riskRegister.length > 0) {
      lessons.push(`户部风险词需提前提示：${hubu.riskRegister.slice(0, 4).join('、')}。`);
    }
  }
  if (bingbu) {
    lessons.push(`兵部 CRO 对「${bingbu.salesRevenueQuestionType}」的默认判断是：${bingbu.position}。`);
    if (bingbu.missingEvidence.length > 0) {
      lessons.push(`兵部同类问题优先检查：${bingbu.missingEvidence.slice(0, 4).join('、')}。`);
    }
    if (bingbu.forbiddenActions.length > 0) {
      lessons.push(`兵部同类问题不得提前动作：${bingbu.forbiddenActions.slice(0, 4).join('、')}。`);
    }
    if (bingbu.salesRevenueQuestionType === 'QUOTE_STRATEGY') {
      lessons.push('客户要求正式报价时，先发安全回复，补齐需求范围、成本毛利、报价有效期和授权，再生成正式报价。');
    }
  }
  if (gongbu) {
    lessons.push(`工部 CTO/CPO 对「${gongbu.deliveryQuestionType}」的默认判断是：${gongbu.ctoCpoPosition}。`);
    if (gongbu.missingEvidence.length > 0) {
      lessons.push(`工部同类问题优先检查：${gongbu.missingEvidence.slice(0, 4).join('、')}。`);
    }
    if (gongbu.forbiddenActions.length > 0) {
      lessons.push(`工部同类问题不得提前承诺：${gongbu.forbiddenActions.slice(0, 4).join('、')}。`);
    }
    if (gongbu.deliveryCommitmentRisk) {
      lessons.push('涉及固定交期、交付能力或供应商锁定时，必须先过工部交付质门，并联动刑部、礼部或兵部复核。');
    }
  }
  return unique(lessons);
}

export function inferUnifiedFailureMode(result: UnifiedLoopResult): string | undefined {
  const hubu = getHubuOpinion(result);
  const bingbu = getBingbuOpinion(result);
  const gongbu = getGongbuOpinion(result);
  if (result.sourceLabel === 'FALLBACK' || result.sourceLabel === 'DEMO') return 'source_not_live';
  if (!result.memorial.qualityGate.passed) return 'quality_gate_blocked';
  if (result.memorial.needsHumanConfirmation) return 'human_confirmation_required';
  if (bingbu?.salesRevenueQuestionType === 'QUOTE_STRATEGY' && bingbu.maySendExternally === false) return 'bingbu_quote_not_ready';
  if (bingbu?.missingEvidence.length) return 'bingbu_missing_sales_evidence';
  if (gongbu?.deliveryCommitmentRisk) return 'gongbu_delivery_commitment_risk';
  if (gongbu?.missingEvidence.length) return 'gongbu_missing_delivery_evidence';
  if (hubu?.missingEvidence.length) return 'hubu_missing_finance_evidence';
  if (result.memorial.missingEvidence.length) return 'missing_evidence';
  return undefined;
}

export function buildUnifiedArchiveLearningRecord(params: {
  result: UnifiedLoopResult;
  userAction: UnifiedUserAction;
  createdAt: string;
}): UnifiedArchiveLearningRecord {
  const { result, userAction, createdAt } = params;
  const bingbu = getBingbuOpinion(result);
  const gongbu = getGongbuOpinion(result);
  return {
    id: `archive_${result.taskId}_${userAction}`,
    taskId: result.taskId,
    loopTraceId: result.loopTraceId,
    originalQuestion: result.draftEdict.originalQuestion,
    refinedIntent: result.draftEdict.refinedQuestion,
    verdict: result.memorial.verdict,
    sourceLabel: result.sourceLabel,
    overallSignal: summarizeOverallSignal(result),
    missingEvidence: result.memorial.missingEvidence,
    needsHumanConfirmation: result.memorial.needsHumanConfirmation,
    salesLearning: bingbu
      ? {
          questionType: bingbu.salesRevenueQuestionType,
          salesOwnerOrGap: bingbu.salesOwnerOrGap,
          opportunityStageOrGap: bingbu.opportunityStageOrGap,
          forbiddenActions: bingbu.forbiddenActions,
          crossDepartmentReviews: bingbu.crossDepartmentReviews,
          maySendExternally: bingbu.maySendExternally,
        }
      : undefined,
    deliveryLearning: gongbu
      ? {
          questionType: gongbu.deliveryQuestionType,
          forbiddenActions: gongbu.forbiddenActions,
          crossDepartmentReviews: gongbu.crossDepartmentReviews,
          deliveryCommitmentRisk: gongbu.deliveryCommitmentRisk,
        }
      : undefined,
    reusableLessons: extractUnifiedReusableLessons(result),
    createdAt,
  };
}

export function buildUnifiedEvoMapEvent(params: {
  result: UnifiedLoopResult;
  userAction: UnifiedUserAction;
  createdAt?: string;
}): EvoMapEvent {
  const { result, userAction } = params;
  const hubu = getHubuOpinion(result);
  const bingbu = getBingbuOpinion(result);
  const gongbu = getGongbuOpinion(result);
  const failureMode = inferUnifiedFailureMode(result);
  const createdAt = params.createdAt ?? new Date().toISOString();
  const eventId = `evomap_${result.taskId}_${createdAt.replace(/[^0-9A-Za-z]/g, '')}`;
  const learnedPreference = userAction === 'accept'
    ? '用户愿意按当前奏折推进，但系统仍需保留证据、来源和人工确认记录。'
    : userAction === 'request_evidence'
      ? '用户倾向先补证再裁决，下次同类问题应提前准备缺证清单。'
      : userAction === 'request_recheck'
        ? '用户倾向复核高风险或红灯事项，下次应提前突出质门和人工确认。'
        : userAction === 'reject'
          ? '用户驳回当前方案，下次应更早暴露风险、分歧和替代路径。'
          : '用户继续追问，说明摘要或证据链仍不够可裁决。';
  const recommendedChange = gongbu?.deliveryCommitmentRisk
    ? '工部 CTO/CPO Office 下次提前阻断固定交期、交付能力或供应商锁定承诺，并要求刑部/礼部/兵部复核。'
    : bingbu?.salesRevenueQuestionType === 'QUOTE_STRATEGY'
      ? '兵部 CRO / Sales / RevOps Office 下次提前准备安全客户回复、报价前检查清单，并强制联动户部和刑部复核。'
      : gongbu?.missingEvidence.length
        ? `工部 CTO/CPO Office 下次提前索要：${gongbu.missingEvidence.slice(0, 4).join('、')}。`
        : bingbu?.missingEvidence.length
          ? `兵部 CRO / Sales / RevOps Office 下次提前索要：${bingbu.missingEvidence.slice(0, 4).join('、')}。`
          : hubu?.missingEvidence.length
            ? `户部 CFO Office 下次提前索要：${hubu.missingEvidence.slice(0, 4).join('、')}。`
            : result.memorial.qualityGate.blockingIssues[0]
              ? `优先修正质门阻断：${result.memorial.qualityGate.blockingIssues[0]}。`
              : '保持当前闭环，并将裁决结果写入史馆供下次召回。';

  return {
    schema_version: 'EvoMapEventV1',
    event_id: eventId,
    task_id: result.taskId,
    loop_trace_id: result.loopTraceId,
    loop_id: 'court_unified_decision_loop_v1',
    user_action: userAction,
    learned_preference: learnedPreference,
    failure_mode: failureMode,
    recommended_change: recommendedChange,
    source_label: result.sourceLabel,
    created_at: createdAt,
    auto_apply: false,
    taskId: result.taskId,
    loopTraceId: result.loopTraceId,
    loopId: 'court_unified_decision_loop_v1',
    userAction,
    learnedPreference,
    failureMode,
    recommendedChange,
    sourceLabel: result.sourceLabel,
  };
}

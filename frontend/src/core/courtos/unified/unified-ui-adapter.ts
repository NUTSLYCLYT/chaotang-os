import { getDepartment } from './department-registry.ts';
import type { UnifiedDepartmentId, UnifiedLoopResult } from './unified-types.ts';

export interface FormalQuoteDecisionBrief {
  decision: string;
  reason: string;
  riskLevel: 'RED' | 'YELLOW' | 'GREEN';
  primaryAction: string;
  missingEvidence: string[];
  safeReplyDraft: string;
  quoteChecklist: string[];
  materialActions: string[];
  triggeredDepartments: Array<{ id: UnifiedDepartmentId; name: string; reason: string }>;
  maySendExternally: false;
  needsHumanConfirmation: boolean;
  sourceLabel: string;
}

export interface UnifiedLoopViewModel {
  headline: string;
  primaryAction: string;
  formalQuoteDecisionBrief?: FormalQuoteDecisionBrief;
  memorialScroll: {
    seal: '奏折' | '機密';
    verdict: string;
    oneSentence: string;
    ministrySignals: Array<{ id: string; name: string; signal: string; summary: string }>;
    redBlueHighlights: Array<{ department: string; main: string; deputy: string }>;
    conflicts: string[];
    evidence: string[];
    missingEvidence: string[];
    risks: string[];
    nextAction: string;
    qualityGate: {
      status: '通过' | '阻断';
      blockingIssues: string[];
      warnings: string[];
    };
    sourceLabel: string;
    needsHumanConfirmation: boolean;
    decisionActions: string[];
  };
  enabledDepartments: Array<{ id: string; name: string; summary: string; signal: string }>;
  worksDeliveryBrief?: {
    signal: string;
    summary: string;
    missingEvidence: string[];
    forbiddenCommitments: string[];
    crossDepartmentReviews: string[];
    nextAction: string;
    needsHumanConfirmation: boolean;
  };
  evidenceGaps: string[];
  risks: string[];
  conflicts: string[];
  sourceLabel: string;
  needsHumanConfirmation: boolean;
  qualityGateStatus: 'passed' | 'blocked';
}

function unique(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function isFormalQuoteTask(result: UnifiedLoopResult): boolean {
  const text = `${result.draftEdict.originalQuestion}\n${result.draftEdict.refinedQuestion}`;
  const warOpinion = result.departmentOpinions.find((opinion) => opinion.departmentId === 'war')?.warOpinion;
  return warOpinion?.salesRevenueQuestionType === 'QUOTE_STRATEGY' || /正式报价|报价单|发报价|客户.*报价/.test(text);
}

function buildFormalQuoteDecisionBrief(result: UnifiedLoopResult): FormalQuoteDecisionBrief | undefined {
  if (!isFormalQuoteTask(result)) return undefined;

  const byId = new Map(result.departmentOpinions.map((opinion) => [opinion.departmentId, opinion]));
  const missingEvidence = unique([
    ...result.intelligencePack.missingEvidence,
    ...result.departmentOpinions.flatMap((opinion) => opinion.missingEvidence),
    '客户确认需求范围',
    '成本表',
    '目标毛利率或折扣底线',
    '付款条件',
    '报价有效期',
    '内部报价审批人',
  ]);
  const departmentReasons: Partial<Record<UnifiedDepartmentId, string>> = {
    jinyiwei: '核验客户要求、预算、承诺来源和缺证。',
    war: '判断是否值得报价、怎么推进、唯一销售下一步。',
    finance: '复核成本、毛利、折扣、现金和报价有效期。',
    justice: '复核正式报价、承诺边界、授权和合同风险。',
    ritual: '生成安全客户回复草稿，不自动外发。',
  };
  const triggeredDepartments = (['jinyiwei', 'war', 'finance', 'justice', 'ritual'] as UnifiedDepartmentId[])
    .filter((id) => id === 'jinyiwei' || result.reviewPlan.selectedDepartments.includes(id) || byId.has(id))
    .map((id) => ({
      id,
      name: getDepartment(id).name,
      reason: departmentReasons[id] ?? '参与正式报价前会审。',
    }));

  return {
    decision: '先不要直接发送正式报价。',
    reason: '当前缺少客户需求范围、成本/毛利边界、付款条件、报价有效期或授权记录，直接发送可能形成价格、交付或商务承诺。',
    riskLevel: result.memorial.needsHumanConfirmation || result.memorial.qualityGate.blockingIssues.length ? 'RED' : missingEvidence.length ? 'YELLOW' : 'GREEN',
    primaryAction: '先发安全回复，并补齐报价前检查清单。',
    missingEvidence,
    safeReplyDraft: '收到，我们可以推进报价准备。为避免报价和交付边界不准确，我需要先确认需求范围、数量/版本、交付时间、付款条件和报价有效期；我们内部完成成本和审批核对后，再给你正式报价。',
    quoteChecklist: [
      '客户确认需求范围、版本、数量和交付边界',
      '成本表、目标毛利率、折扣底线和审批人',
      '付款条件、账期、开票方式和现金影响',
      '报价有效期、适用范围和不包含事项',
      '客户预算或采购意向的来源记录',
      '合同、授权和对外承诺边界复核',
    ],
    materialActions: ['生成客户安全回复草稿', '生成报价前检查清单', '进入军机处深审', '归档史馆'],
    triggeredDepartments,
    maySendExternally: false,
    needsHumanConfirmation: true,
    sourceLabel: result.sourceLabel,
  };
}

const VERDICT_LABEL: Record<string, string> = {
  APPROVE: '准奏',
  NEED_EVIDENCE: '补证',
  RECHECK: '复核',
  REJECT: '驳回',
};

function buildRedBlueHighlights(result: UnifiedLoopResult): Array<{ department: string; main: string; deputy: string }> {
  return result.departmentOpinions.map((opinion) => {
    const missing = opinion.missingEvidence[0];
    const risk = opinion.risks[0];
    return {
      department: getDepartment(opinion.departmentId).name,
      main: opinion.summary,
      deputy: risk ?? (missing ? `副手挑战：缺少${missing}，不得包装成确定性结论。` : '副手挑战：保留证据链并等待用户裁决。'),
    };
  });
}

function buildMemorialScroll(result: UnifiedLoopResult): UnifiedLoopViewModel['memorialScroll'] {
  const blocked = !result.memorial.qualityGate.passed || result.memorial.needsHumanConfirmation;
  const ministrySignals = [
    {
      id: 'jinyiwei',
      name: getDepartment('jinyiwei').name,
      signal: result.intelligencePack.missingEvidence.length ? 'YELLOW' : 'GREEN',
      summary: result.intelligencePack.unsupportedClaims[0] ?? '情报先行：已整理事实、来源和证据缺口。',
    },
    ...result.departmentOpinions.map((opinion) => ({
      id: opinion.departmentId,
      name: getDepartment(opinion.departmentId).name,
      signal: opinion.signal,
      summary: opinion.summary,
    })),
  ];

  return {
    seal: blocked ? '機密' : '奏折',
    verdict: VERDICT_LABEL[result.memorial.verdict] ?? result.memorial.verdict,
    oneSentence: result.memorial.oneSentence,
    ministrySignals,
    redBlueHighlights: buildRedBlueHighlights(result),
    conflicts: result.memorial.conflicts.map((conflict) => conflict.summary),
    evidence: result.memorial.evidence,
    missingEvidence: result.memorial.missingEvidence,
    risks: result.memorial.risks,
    nextAction: result.memorial.nextAction,
    qualityGate: {
      status: result.memorial.qualityGate.passed ? '通过' : '阻断',
      blockingIssues: result.memorial.qualityGate.blockingIssues,
      warnings: result.memorial.qualityGate.warnings,
    },
    sourceLabel: result.memorial.sourceLabel,
    needsHumanConfirmation: result.memorial.needsHumanConfirmation,
    decisionActions: result.memorial.needsHumanConfirmation
      ? ['补证', '复核', '驳回重拟', '追问', '人工确认后归档']
      : ['准奏归档', '补证', '复核', '驳回重拟', '追问'],
  };
}

export function buildUnifiedLoopViewModel(result: UnifiedLoopResult): UnifiedLoopViewModel {
  const worksOpinion = result.departmentOpinions.find((opinion) => opinion.departmentId === 'works');
  const gongbuOpinion = worksOpinion?.gongbuOpinion;
  const formalQuoteDecisionBrief = buildFormalQuoteDecisionBrief(result);
  return {
    headline: formalQuoteDecisionBrief?.decision ?? result.memorial.oneSentence,
    primaryAction: formalQuoteDecisionBrief?.primaryAction ?? result.memorial.nextAction,
    formalQuoteDecisionBrief,
    memorialScroll: buildMemorialScroll(result),
    enabledDepartments: [
      {
        id: 'jinyiwei',
        name: getDepartment('jinyiwei').name,
        summary: '情报先行：已整理事实、来源和缺证。',
        signal: result.intelligencePack.missingEvidence.length ? 'YELLOW' : 'GREEN',
      },
      ...result.departmentOpinions.map((opinion) => ({
        id: opinion.departmentId,
        name: getDepartment(opinion.departmentId).name,
        summary: opinion.summary,
        signal: opinion.signal,
      })),
    ],
    worksDeliveryBrief: worksOpinion && gongbuOpinion
      ? {
          signal: worksOpinion.signal,
          summary: worksOpinion.summary,
          missingEvidence: gongbuOpinion.missingEvidence,
          forbiddenCommitments: gongbuOpinion.forbiddenActions,
          crossDepartmentReviews: gongbuOpinion.crossDepartmentReviews,
          nextAction: gongbuOpinion.recommendedNextAction,
          needsHumanConfirmation: gongbuOpinion.humanConfirmationRequired || worksOpinion.needsHumanConfirmation,
        }
      : undefined,
    evidenceGaps: result.memorial.missingEvidence,
    risks: result.memorial.risks,
    conflicts: result.conflicts.map((conflict) => conflict.summary),
    sourceLabel: result.sourceLabel,
    needsHumanConfirmation: result.memorial.needsHumanConfirmation,
    qualityGateStatus: result.memorial.qualityGate.passed ? 'passed' : 'blocked',
  };
}

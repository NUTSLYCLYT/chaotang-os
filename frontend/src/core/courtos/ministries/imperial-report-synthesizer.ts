/**
 * 奏折合成 Loop（Loop5）—— 六部红蓝 + 御史台审计 → 老板可读的圣旨/奏折。
 * 纯函数，无 @/ 运行时依赖 → 可离线单测。
 */
import type {
  MinistryId,
  MinistrySignal,
  MinistryVerdict,
  MinistryConflict,
  MinistryReviewResult,
  YushitaiAuditResult,
} from './ministry-types.ts';
import type { SourceLabel } from '../types';
import { MINISTRY_REGISTRY } from './ministry-registry.ts';

export interface ImperialReport {
  verdict: MinistryVerdict; // 圣裁
  oneSentence: string;
  ministrySignals: Partial<Record<MinistryId, MinistrySignal>>; // 六部红黄绿灯
  departmentSummaries: Array<{ ministry: string; signal: MinistrySignal; ruling: string }>;
  redBlueHighlights: Array<{ ministry: string; main: string; deputy: string }>;
  conflicts: MinistryConflict[];
  evidence: string[];
  missingEvidence: string[];
  risks: string[];
  nextAction: string; // 后令(唯一主动作)
  qualityGate: { needsHumanConfirmation: boolean; warnings: string[] }; // 质门
  sourceLabel: SourceLabel; // 来源
  needsHumanConfirmation: boolean;
  yushitaiWarnings: string[];
  decisionActions: Array<'accept' | 'need_evidence' | 'recheck' | 'reject' | 'follow_up'>;
}

function decideVerdict(review: MinistryReviewResult, audit: YushitaiAuditResult): MinistryVerdict {
  const justiceRed = review.cards.some((c) => c.ministryId === 'justice' && c.signal === 'RED');
  if (justiceRed) return 'RECHECK';
  if (!audit.passed) return review.missingEvidence.length ? 'NEED_EVIDENCE' : 'RECHECK';
  if (review.overallSignal === 'RED') return 'RECHECK';
  if (
    review.missingEvidence.length > 0 ||
    review.overallSignal === 'YELLOW' ||
    review.overallSignal === 'GRAY'
  ) {
    return 'NEED_EVIDENCE';
  }
  // 全绿 + 御史台通过；但 FALLBACK/DEMO 不许无条件准奏
  if (review.sourceLabel === 'FALLBACK' || review.sourceLabel === 'DEMO') return 'NEED_EVIDENCE';
  if (review.overallSignal === 'GREEN' && audit.passed) return 'APPROVE';
  return 'NEED_EVIDENCE';
}

const VERDICT_CN: Record<MinistryVerdict, string> = {
  APPROVE: '准奏', NEED_EVIDENCE: '补证', RECHECK: '复核', REJECT: '驳回',
};

function pickNextAction(verdict: MinistryVerdict, review: MinistryReviewResult): string {
  if (verdict === 'RECHECK' && review.vetoes.length) {
    return `先消解${review.vetoes.map((v) => MINISTRY_REGISTRY[v].nameCn).join('、')}红灯（人工确认或补救）`;
  }
  if (verdict === 'NEED_EVIDENCE' && review.missingEvidence.length) {
    return `补齐关键证据：${review.missingEvidence.slice(0, 4).join('、')}`;
  }
  if (verdict === 'APPROVE') return '可进入执行，指定 DRI 与 7/30/90 天计划';
  return '复核后重新会审';
}

export function synthesizeImperialReport(params: {
  review: MinistryReviewResult;
  audit: YushitaiAuditResult;
  evidence?: string[];
}): ImperialReport {
  const { review, audit } = params;
  const verdict = decideVerdict(review, audit);

  const ministrySignals: Partial<Record<MinistryId, MinistrySignal>> = {};
  for (const c of review.cards) ministrySignals[c.ministryId] = c.signal;

  const departmentSummaries = review.cards.map((c) => ({
    ministry: MINISTRY_REGISTRY[c.ministryId].nameCn,
    signal: c.signal,
    ruling: c.ruling,
  }));
  const redBlueHighlights = review.cards.map((c) => ({
    ministry: MINISTRY_REGISTRY[c.ministryId].nameCn,
    main: c.mainThesis,
    deputy: c.deputyChallenge,
  }));
  const risks = [...new Set(review.cards.flatMap((c) => c.deputyRisks))];
  const needsHumanConfirmation = review.humanApprovalRequired || audit.needsHumanConfirmation || verdict === 'RECHECK';

  return {
    verdict,
    oneSentence: `${VERDICT_CN[verdict]}：${review.overallSuggestion}`,
    ministrySignals,
    departmentSummaries,
    redBlueHighlights,
    conflicts: review.conflicts,
    evidence: params.evidence ?? [],
    missingEvidence: review.missingEvidence,
    risks,
    nextAction: pickNextAction(verdict, review),
    qualityGate: { needsHumanConfirmation, warnings: audit.warnings },
    sourceLabel: review.sourceLabel,
    needsHumanConfirmation,
    yushitaiWarnings: [...audit.blockingIssues, ...audit.warnings],
    decisionActions: ['accept', 'need_evidence', 'recheck', 'reject', 'follow_up'],
  };
}

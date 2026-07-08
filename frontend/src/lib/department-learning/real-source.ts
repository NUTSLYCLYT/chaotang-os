import { AGENT_META, type AgentCode } from '@/lib/contracts/agent';
import { hasCourtArchive } from '@/core/courtos/archive/archive-store';
import { logger } from '@/lib/logger';
import type {
  DepartmentLearningRealSourceAction,
  DepartmentLearningRealSourceInput,
  DepartmentLearningRecord,
} from '@/lib/contracts/department-learning';
import { loadBossDecisionOutcomeEvidence } from '@/lib/swarm/boss-ledger';
import { agentCodeForDept } from './advisor-signal';
import { resolveArchiveConfirmation } from './archive-correlation';
import { buildDepartmentLearningRecord } from './loop';
import { loadLearningRecords, saveLearningRecord } from './store';
import { deriveThresholdedVerdict, MIN_SAMPLES_FOR_VERDICT } from './verdict-threshold';

function verdictForAction(action: DepartmentLearningRealSourceAction): 'confirmed' | 'refuted' {
  return action === 'rejected' ? 'refuted' : 'confirmed';
}

function resolveAgentCode(input: Pick<DepartmentLearningRealSourceInput, 'agentCode' | 'dept'>): AgentCode | null {
  if (input.agentCode && input.agentCode in AGENT_META) return input.agentCode;
  if (input.dept) return agentCodeForDept(input.dept);
  return null;
}

function actionLabel(action: DepartmentLearningRealSourceAction): string {
  if (action === 'signed') return '老板已原样签核';
  if (action === 'edited') return '老板已修改后采纳';
  return '老板已驳回';
}

function bossDecisionIdFromEvidence(evidenceId: string | undefined): number | null {
  const matched = evidenceId?.match(/^boss_decision:(\d+)$/);
  if (!matched) return null;
  const id = Number(matched[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function verifyEvidence(input: DepartmentLearningRealSourceInput): Promise<{
  ok: boolean;
  archiveConfirmed: boolean;
  evidence: string[];
}> {
  const decisionId = bossDecisionIdFromEvidence(input.evidenceId);
  if (decisionId) {
    const outcome = await loadBossDecisionOutcomeEvidence(decisionId);
    if (!outcome) return { ok: false, archiveConfirmed: false, evidence: [] };
    if (outcome.outcome !== input.action) return { ok: false, archiveConfirmed: false, evidence: [] };
    if (input.dept && outcome.chosenDept && outcome.chosenDept !== input.dept) {
      return { ok: false, archiveConfirmed: false, evidence: [] };
    }

    // 会审HIGH修复(2026-07-03)：archiveConfirmed 此前只查"任意归档是否存在于表里"，不问它
    // 是不是这条签核真正在等的那次归档——导致 archive-backfill.ts 的陈旧 pending 签核，会被
    // 任何不相关的新归档事件误配对、反复计入 verdict-threshold.ts 的累计样本(以为攒够3个
    // 独立样本，实为同一件事被算了3次)。能双方对上 taskId 时严格校验，对不上直接拒绝。
    const archiveExists = await hasCourtArchive(input.archiveId);
    const { archiveConfirmed, usedStrictCheck } = resolveArchiveConfirmation({
      outcomeTaskId: outcome.taskId,
      expectedTaskId: input.expectedTaskId,
      archiveExists,
    });
    // 会审MEDIUM修复(2026-07-03)：只在"真的在尝试用某个归档确认"(input.archiveId 有值)时
    // 才告警——否则每次老板签核(此时通常还没有归档，archiveId 本就未传)都会打一条误导性
    // warn，把"正常的初始未归档状态"说成"存量数据漂移待排查"，噪声掩盖真信号。
    if (!usedStrictCheck && input.archiveId) {
      logger.warn('[real-source] verifyEvidence 缺 task_id 可比对，退回弱校验(仅查归档存在)', {
        decisionId,
        hasOutcomeTaskId: Boolean(outcome.taskId),
        hasExpectedTaskId: Boolean(input.expectedTaskId),
      });
    }

    return {
      ok: true,
      archiveConfirmed,
      evidence: [
        `boss_decision:${outcome.id}`,
        `boss_outcome_hash:${outcome.outcomeHash}`,
        archiveConfirmed ? `archive:${input.archiveId}` : 'archive:pending',
      ],
    };
  }

  // e2e 后门已移除(安全·解冻做安全 2026-06-22):非 production 用 e2e-* evidenceId
  // 伪造"老板签核+史馆归档"双证据提权的旁路删除。证据只认真实 boss_decision 签核链。
  return { ok: false, archiveConfirmed: false, evidence: [] };
}

export function isTrustedEvidenceId(evidenceId: string | undefined): boolean {
  if (!evidenceId) return false;
  // 收紧(会审 HIGH):排除 boss_decision:0 / :00 —— id 必须 ≥1,否则 isTrustedEvidenceId
  // 会假阳性放行,虽下游 verifyEvidence 仍会拒,但此门契约不应误导。
  return /^boss_decision:[1-9]\d*$/.test(evidenceId);
}

export interface ApplyDepartmentLearningRealSourceResult {
  applied: boolean;
  record: DepartmentLearningRecord | null;
}

export async function applyDepartmentLearningRealSource(
  input: DepartmentLearningRealSourceInput,
  now = new Date(),
): Promise<ApplyDepartmentLearningRealSourceResult> {
  if (input.source !== 'boss_signoff') return { applied: false, record: null };
  if (!isTrustedEvidenceId(input.evidenceId)) return { applied: false, record: null };
  const verified = await verifyEvidence(input);
  if (!verified.ok) return { applied: false, record: null };

  const agentCode = resolveAgentCode(input);
  if (!agentCode) return { applied: false, record: null };

  const records = await loadLearningRecords();
  const current = records.find((record) => record.agentCode === agentCode)
    ?? buildDepartmentLearningRecord(agentCode, now);
  const finalVerdict = verdictForAction(input.action);

  // 样本量闸门(2026-07-03 P2修 · 会审驱动)：只有双证据(签核链+史馆归档)才计入累计样本，
  // 单证据维持既有"observing,不提权"语义(thisRoundOutcome=null，不计数)。纯判定逻辑见
  // verdict-threshold.ts(抽成纯函数，供 nodetest 绕开本文件 archive-store.ts 的 server-only 依赖)。
  const { confirmedCount, refutedCount, verdict } = deriveThresholdedVerdict(
    current.confirmedCount ?? 0,
    current.refutedCount ?? 0,
    verified.archiveConfirmed ? finalVerdict : null,
  );
  const totalSamples = confirmedCount + refutedCount;
  const belowThreshold = totalSamples < MIN_SAMPLES_FOR_VERDICT;

  const evidence = [
    ...current.evidence,
    `real_source:boss_signoff:${input.action}`,
    input.dept ? `dept:${input.dept}` : `agent:${agentCode}`,
    input.evidenceId ? `evidence:${input.evidenceId}` : null,
    ...verified.evidence,
  ].filter((item): item is string => Boolean(item));

  const record: DepartmentLearningRecord = {
    ...current,
    sourceLabel: 'PRIMARY',
    verdict,
    confirmedCount,
    refutedCount,
    calibrationDelta: !verified.archiveConfirmed
      ? `单证据真实结果源：${actionLabel(input.action)}，签核链可查但史馆归档未回填，暂记 observing，不长期提权。`
      : belowThreshold
        ? `双证据真实结果源：${actionLabel(input.action)}，已累计 ${totalSamples}/${MIN_SAMPLES_FOR_VERDICT} 个真实样本，未过样本量闸门，暂记 observing，不让单次事件左右权重。`
        : `双证据真实结果源：累计 ${totalSamples} 个真实样本(confirmed ${confirmedCount} / refuted ${refutedCount})，过闸后将该部门本轮判断标记为 ${verdict}。`,
    nextLesson: !verified.archiveConfirmed
      ? `下一课：等待史馆归档后再为「${current.calibrationTarget}」改判 confirmed/refuted。`
      : belowThreshold
        ? `下一课：再积累 ${MIN_SAMPLES_FOR_VERDICT - totalSamples} 个真实样本才够样本量闸门，暂不改判。`
        : verdict === 'confirmed'
        ? `下一课：抽取「${current.calibrationTarget}」中被采纳的判断模式，复用到下一次相似任务。`
        : `下一课：复盘「${current.calibrationTarget}」为何被否，先找反证再给下一次建议。`,
    evidence,
    updatedAt: now.toISOString(),
  };

  await saveLearningRecord(record);
  return { applied: true, record };
}

export async function applyDepartmentLearningOutcomeFromBossSignoff(input: {
  decisionId: number;
  action: DepartmentLearningRealSourceAction;
  chosenDept: string | null;
  note?: string | null;
}): Promise<ApplyDepartmentLearningRealSourceResult> {
  if (!input.chosenDept) return { applied: false, record: null };
  return applyDepartmentLearningRealSource({
    source: 'boss_signoff',
    action: input.action,
    dept: input.chosenDept,
    evidenceId: `boss_decision:${input.decisionId}`,
    note: input.note ?? undefined,
  });
}

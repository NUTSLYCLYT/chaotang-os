/**
 * NextBestActionEngine（V3 Prompt 4）：任何状态都输出唯一主动作（原则 8）。
 * 风险地板优先：高风险/需人工确认 永远先于状态；DEMO/FALLBACK 不得推向正式裁决。
 */
import { isFallbackLike } from '../source-label.ts';
import type { NextBestAction, PendingTaskSnapshot } from './interaction-types.ts';

type ActionInput = Pick<PendingTaskSnapshot, 'phase' | 'sourceLabel' | 'needsHumanConfirmation' | 'riskLevel'>;

export function nextBestAction(task: ActionInput): NextBestAction {
  // 地板：高风险/需人工确认，永远先要人工确认，不被任何状态绕过。
  if (task.needsHumanConfirmation || task.riskLevel === 'high') {
    return { actionId: 'human_confirm', label: '人工确认', reason: '高风险事项不可一键采纳，必须人工确认。' };
  }
  // DEMO 只能查看样板，不允许正式裁决。
  if (task.sourceLabel === 'DEMO') {
    return { actionId: 'view_demo_only', label: '查看样板', reason: 'DEMO 样板，不可作为真实裁决依据。' };
  }

  switch (task.phase) {
    case 'DRAFT':
    case 'INTENT_REFINED':
      return { actionId: 'confirm_and_start', label: '确认发起', reason: '拟旨已就绪，确认后进入军机处会审。' };
    case 'EVIDENCE_CHECKING':
    case 'WAITING_FOR_EVIDENCE':
      return { actionId: 'upload_evidence', label: '上传材料', reason: '缺关键证据，补齐后才能继续。' };
    case 'REVIEWING':
      return { actionId: 'review_report', label: '查看进度', reason: '军机处会审中。' };
    case 'REPORT_READY':
    case 'WAITING_FOR_DECISION':
      // FALLBACK 不作最终裁决依据 → 引导重试/存草稿，而非采纳。
      return isFallbackLike(task.sourceLabel)
        ? { actionId: 'retry_or_save_draft', label: '重试或存草稿', reason: '结果为兜底来源，不作最终裁决依据。' }
        : { actionId: 'make_decision', label: '裁决', reason: '奏折已生成，请采纳/补证/复核/驳回/追问。' };
    case 'ACCEPTED':
      return { actionId: 'archive_or_track', label: '归档 / 执行跟踪', reason: '已采纳，进入归档与执行跟踪。' };
    case 'REJECTED':
      return { actionId: 'record_reject_reason', label: '记录驳回原因', reason: '驳回需记录原因以形成复利。' };
    case 'FOLLOWING_UP':
    case 'RECHECKING':
      return { actionId: 'continue_followup', label: '继续', reason: '追问 / 复核进行中。' };
    case 'FAILED':
      return { actionId: 'retry_or_save_draft', label: '重试或存草稿', reason: '生成失败，任务未丢，可重试。' };
    case 'ARCHIVED':
      return { actionId: 'review_report', label: '查看归档', reason: '已归档，可作旧案引用。' };
    default:
      return { actionId: 'review_report', label: '查看', reason: '查看当前状态。' };
  }
}

/**
 * 朝堂 OS V2 · 奏折详情面板 + 裁决 (approve / reject / inquire)
 *
 * 八段式渲染：背景 / 目标 / 会审意见 / 风险 / 推荐 / 执行路径 / 待裁决 / 下一步
 * 裁决成功后通过 sonner toast 通知并回调 onReviewed 刷新列表。
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { X, CheckCircle, XCircle, Search, AlertTriangle } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { chaotang } from '@/lib/api/chaotang';
import type { MemorialBrief, MemorialDetail, ReviewActionType } from '@/lib/contracts/memorial';
import { AGENT_META } from '@/types/agent';
import type { AgentCode } from '@/types/agent';

interface Props {
  brief: MemorialBrief;
  onClose: () => void;
  onReviewed: () => void;
}

const ACTION_MAP: { action: ReviewActionType; label: string; color: string; borderColor: string }[] = [
  { action: 'approve', label: '批准', color: '#3DD68C', borderColor: 'rgba(61,214,140,0.5)' },
  { action: 'reject',  label: '驳回', color: '#F43F5E', borderColor: 'rgba(244,63,94,0.5)' },
  { action: 'inquire', label: '查办', color: '#F0C66A', borderColor: 'rgba(240,198,106,0.5)' },
];

const ACTION_LABEL_ZH: Record<ReviewActionType, string> = {
  approve: '已批准',
  reject: '已驳回',
  inquire: '查办中',
};

const ACTION_COLOR: Record<ReviewActionType, string> = {
  approve: '#3DD68C',
  reject: '#F43F5E',
  inquire: '#F0C66A',
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#F43F5E',
  high: '#FB923C',
  medium: '#F0C66A',
  low: '#9AA3C4',
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

const HIGH_RISK_TERMS = [
  '金额', '付款', '预付款', '合同', '法务', '法律', '对外发布', '公开发布', '客户承诺',
  '承诺', '人事', '任免', '辞退', '删除', '生产环境', '部署', '供应商', '权限', '签字',
];

function stringField(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function approvalGateFor(detail: MemorialDetail | null, brief: MemorialBrief) {
  if (!detail) return { required: false, reasons: [] as string[] };

  const fullContent = detail.fullContent ?? {};
  const sourceLabel = stringField(fullContent, ['sourceLabel', 'source_label', 'source']);
  const sourceRequiresConfirmation = sourceLabel
    ? /fallback|demo|unknown|missing|兜底|演示|未知/i.test(sourceLabel)
    : false;
  const scanText = [
    brief.title,
    brief.summary,
    detail.memorial.background,
    detail.memorial.objective,
    detail.memorial.recommendation,
    ...detail.memorial.risks,
    ...detail.memorial.decisionsNeeded,
    ...detail.memorial.nextSteps,
  ].join('\n');
  const matchedTerms = HIGH_RISK_TERMS.filter((term) => scanText.includes(term));
  const reasons: string[] = [];

  if (brief.priority === 'urgent' || brief.priority === 'high') {
    reasons.push(`优先级为${PRIORITY_LABEL[brief.priority] ?? brief.priority}`);
  }
  if (detail.memorial.risks.length > 0) {
    reasons.push(`奏折列出 ${detail.memorial.risks.length} 条风险`);
  }
  if (matchedTerms.length > 0) {
    reasons.push(`命中高风险词：${Array.from(new Set(matchedTerms)).slice(0, 6).join('、')}`);
  }
  if (sourceRequiresConfirmation && sourceLabel) {
    reasons.push(`来源为 ${sourceLabel}，需人工确认后才能准奏`);
  }
  if (typeof detail.qualityScore === 'number' && detail.qualityScore < 60) {
    reasons.push(`质量评分 ${detail.qualityScore} 分，低于裁决安全线`);
  }

  return { required: reasons.length > 0, reasons };
}

export function MemorialDetailPanel({ brief, onClose, onReviewed }: Props) {
  const [detail, setDetail] = useState<MemorialDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmingApprove, setConfirmingApprove] = useState(false);

  const agentMeta = AGENT_META[brief.agentCode as AgentCode];
  const priorityColor = PRIORITY_COLOR[brief.priority] ?? '#9AA3C4';
  const priorityLabel = PRIORITY_LABEL[brief.priority] ?? brief.priority;
  const approvalGate = approvalGateFor(detail, brief);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setConfirmingApprove(false);
    chaotang.memorialDetail(brief.id)
      .then((d) => { if (!cancelled) { setDetail(d); setLoading(false); } })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '加载失败');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [brief.id]);

  const handleReview = useCallback(async (action: ReviewActionType) => {
    if (action === 'approve' && approvalGate.required && !confirmingApprove) {
      setConfirmingApprove(true);
      toast.warning('此奏折涉及高风险，请二次确认后再准奏');
      return;
    }

    setSubmitting(true);
    try {
      await chaotang.review(brief.id, action, comment);
      toast.success(`裁决已提交：${ACTION_LABEL_ZH[action]}`);
      setComment('');
      setConfirmingApprove(false);
      onReviewed();
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '裁决提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }, [approvalGate.required, brief.id, comment, confirmingApprove, onReviewed, onClose]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-start justify-end"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Drawer */}
      <div
        className="relative flex h-full w-full max-w-[720px] flex-col overflow-hidden"
        style={{
          background: 'rgba(12, 16, 36, 0.98)',
          backdropFilter: 'blur(24px)',
          borderLeft: '1px solid rgba(240,198,106,0.2)',
        }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-start justify-between gap-4 px-6 py-5"
          style={{ borderBottom: '1px solid rgba(26,33,66,0.8)' }}
        >
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              {agentMeta && (
                <span
                  className="rounded px-2 py-0.5 text-[11px] font-medium"
                  style={{ background: `${agentMeta.color}18`, color: agentMeta.color }}
                >
                  {agentMeta.emoji} {agentMeta.nameCn}
                </span>
              )}
              <span
                className="rounded px-2 py-0.5 text-[11px] font-medium"
                style={{ background: `${priorityColor}18`, color: priorityColor }}
              >
                {priorityLabel}
              </span>
              <span className="text-[11px] text-[#6A7299]">{brief.sourceDepartment}</span>
            </div>
            <h2 className="section-title text-[20px] leading-snug">{brief.title}</h2>
            <p className="mt-1 text-[12px] leading-6 text-[#9AA3C4]">{brief.summary}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 transition-colors hover:bg-white/5"
          >
            <X size={16} className="text-[#6A7299]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-transparent"
                style={{ borderTopColor: 'rgba(240,198,106,0.9)', borderRightColor: 'rgba(240,198,106,0.3)' }}
              />
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <div className="text-[13px] text-[#F43F5E]">{error}</div>
            </div>
          )}

          {detail && !loading && (
            <div className="space-y-5">
              {/* Quality Score */}
              {detail.qualityScore !== null && (
                <div className="flex items-center gap-3">
                  <div className="page-eyebrow">质量评分</div>
                  <div
                    className="rounded-full px-3 py-0.5 text-[12px] font-semibold"
                    style={{
                      background: detail.qualityScore >= 80
                        ? 'rgba(61,214,140,0.12)'
                        : detail.qualityScore >= 60
                        ? 'rgba(240,198,106,0.12)'
                        : 'rgba(244,63,94,0.12)',
                      color: detail.qualityScore >= 80
                        ? '#3DD68C'
                        : detail.qualityScore >= 60
                        ? '#F0C66A'
                        : '#F43F5E',
                      border: `1px solid ${detail.qualityScore >= 80
                        ? 'rgba(61,214,140,0.3)'
                        : detail.qualityScore >= 60
                        ? 'rgba(240,198,106,0.3)'
                        : 'rgba(244,63,94,0.3)'}`,
                    }}
                  >
                    {detail.qualityScore} 分
                  </div>
                </div>
              )}

              {/* 一 · 背景 */}
              <Section label="一、背景" content={detail.memorial.background} />

              {/* 二 · 目标 */}
              <Section label="二、目标" content={detail.memorial.objective} />

              {/* 三 · 会审意见 */}
              <div>
                <div className="mb-2 page-eyebrow">三、会审意见</div>
                {detail.memorial.opinions.length === 0 ? (
                  <p className="text-[12px] text-[#6A7299]">暂无会审意见</p>
                ) : (
                  <div className="space-y-2">
                    {detail.memorial.opinions.map((op, i) => {
                      const am = AGENT_META[op.agentCode as AgentCode];
                      return (
                        <GlassPanel key={i} tone="flat" padding="sm">
                          <div className="mb-1 flex items-center gap-1.5">
                            {am && (
                              <span className="text-[11px]" style={{ color: am.color }}>
                                {am.emoji} {am.nameCn}
                              </span>
                            )}
                            {!am && (
                              <span className="text-[11px] text-[#9AA3C4]">{op.agentCode}</span>
                            )}
                          </div>
                          <p className="body-copy text-[12px] leading-6 text-[#C6C0B2]">{op.text}</p>
                        </GlassPanel>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 四 · 风险 */}
              {detail.memorial.risks.length > 0 && (
                <div>
                  <div className="mb-2 page-eyebrow">四、风险</div>
                  <ul className="space-y-1">
                    {detail.memorial.risks.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px] text-[#C6C0B2]">
                        <span className="mt-1 shrink-0 text-[#F43F5E]">▪</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 五 · 推荐 */}
              <Section label="五、推荐" content={detail.memorial.recommendation} />

              {/* 六 · 执行路径 */}
              {detail.memorial.executionPath.length > 0 && (
                <div>
                  <div className="mb-2 page-eyebrow">六、执行路径</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]" style={{ borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(26,33,66,0.8)' }}>
                          {['阶段', '任务', '负责人', '状态'].map((h) => (
                            <th key={h} className="py-2 pr-4 text-left text-[#6A7299] font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.memorial.executionPath.map((ep, i) => {
                          const am = AGENT_META[ep.owner as AgentCode];
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(26,33,66,0.5)' }}>
                              <td className="py-2 pr-4 text-[#9AA3C4]">{ep.phase}</td>
                              <td className="py-2 pr-4 text-[#C6C0B2]">{ep.task}</td>
                              <td className="py-2 pr-4" style={{ color: am?.color ?? '#9AA3C4' }}>
                                {am ? `${am.emoji} ${am.nameCn}` : ep.owner}
                              </td>
                              <td className="py-2 pr-4">
                                <span
                                  className="rounded px-1.5 py-0.5"
                                  style={{
                                    background: ep.status === 'done'
                                      ? 'rgba(61,214,140,0.12)'
                                      : ep.status === 'pending'
                                      ? 'rgba(240,198,106,0.12)'
                                      : 'rgba(107,160,255,0.12)',
                                    color: ep.status === 'done'
                                      ? '#3DD68C'
                                      : ep.status === 'pending'
                                      ? '#F0C66A'
                                      : '#6BA0FF',
                                  }}
                                >
                                  {ep.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 七 · 待裁决 */}
              {detail.memorial.decisionsNeeded.length > 0 && (
                <div>
                  <div className="mb-2 page-eyebrow">七、待裁决事项</div>
                  <ul className="space-y-1">
                    {detail.memorial.decisionsNeeded.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px] text-[#C6C0B2]">
                        <span className="mt-1 shrink-0 text-[#F0C66A]">◆</span>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 八 · 下一步 */}
              {detail.memorial.nextSteps.length > 0 && (
                <div>
                  <div className="mb-2 page-eyebrow">八、下一步行动</div>
                  <ul className="space-y-1">
                    {detail.memorial.nextSteps.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px] text-[#C6C0B2]">
                        <span className="mt-1 shrink-0 text-[#6BA0FF]">→</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer: 裁决区 */}
        <div
          className="shrink-0 px-6 py-5 space-y-3"
          style={{ borderTop: '1px solid rgba(26,33,66,0.8)' }}
        >
          {detail?.review ? (
            /* 已裁决：展示结果 */
            <div
              className="rounded-xl px-4 py-3"
              style={{
                background: `${ACTION_COLOR[detail.review.action]}12`,
                border: `1px solid ${ACTION_COLOR[detail.review.action]}33`,
              }}
            >
              <div className="mb-1 flex items-center gap-2">
                {detail.review.action === 'approve' && <CheckCircle size={14} color={ACTION_COLOR.approve} />}
                {detail.review.action === 'reject' && <XCircle size={14} color={ACTION_COLOR.reject} />}
                {detail.review.action === 'inquire' && <Search size={14} color={ACTION_COLOR.inquire} />}
                <span className="text-[13px] font-semibold" style={{ color: ACTION_COLOR[detail.review.action] }}>
                  {ACTION_LABEL_ZH[detail.review.action]}
                </span>
                <span className="text-[11px] text-[#6A7299]">
                  · {detail.review.reviewerName} · {new Date(detail.review.createdAt).toLocaleString('zh-CN')}
                </span>
              </div>
              {detail.review.comment && (
                <p className="text-[12px] leading-6 text-[#C6C0B2]">{detail.review.comment}</p>
              )}
              {detail.review.taskStatus && (
                <p className="mt-1 text-[11px] text-[#6A7299]">任务状态：{detail.review.taskStatus}</p>
              )}
            </div>
          ) : (
            /* 待裁决：操作区 */
            <>
              <textarea
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  if (confirmingApprove) setConfirmingApprove(false);
                }}
                placeholder="批示意见（选填）"
                rows={2}
                disabled={submitting || loading}
                className="w-full resize-none rounded-xl px-3 py-2.5 text-[12px] leading-6 text-[#EAEEFB] placeholder-[#4A5280] outline-none transition-colors"
                style={{
                  background: 'rgba(15,20,40,0.7)',
                  border: '1px solid rgba(26,33,66,0.9)',
                }}
              />
              {approvalGate.required && confirmingApprove && (
                <div
                  className="rounded-xl px-3 py-3"
                  role="alert"
                  style={{
                    background: 'rgba(244,63,94,0.09)',
                    border: '1px solid rgba(244,63,94,0.38)',
                  }}
                >
                  <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-[#F43F5E]">
                    <AlertTriangle size={15} />
                    高风险确认门
                  </div>
                  <p className="text-[12px] leading-6 text-[#F5E9C9]">
                    此事项涉及高风险操作。请确认依据完整、责任人明确、后果可控；如证据不足，请退回补证或交刑部复核。
                  </p>
                  <ul className="mt-2 space-y-1">
                    {approvalGate.reasons.map((reason) => (
                      <li key={reason} className="flex items-start gap-2 text-[11px] leading-5 text-[#E8A0A8]">
                        <span className="mt-1 text-[#F43F5E]">▪</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-2">
                {ACTION_MAP.map(({ action, label, color, borderColor }) => (
                  <button
                    key={action}
                    type="button"
                    disabled={submitting || loading}
                    onClick={() => handleReview(action)}
                    className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold transition-all hover:brightness-110 disabled:opacity-40"
                    style={{
                      background: `${color}14`,
                      border: `1px solid ${borderColor}`,
                      color,
                    }}
                  >
                    {submitting ? '提交中…' : action === 'approve' && confirmingApprove ? '确认后批准' : label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* Small helper: renders a labeled text block */
function Section({ label, content }: { label: string; content: string }) {
  return (
    <div>
      <div className="mb-1 page-eyebrow">{label}</div>
      <p className="body-copy text-[12px] leading-7 text-[#C6C0B2]">{content}</p>
    </div>
  );
}

/**
 * 史馆 · 证据回链面板(EvidenceChainPanel)
 *
 * 规格：jiqun_ai_fresh docs/frontend_ui/shiguan.md §③3.2 / §⑤ P2 交互
 * 桌面右抽屉，移动改底部 sheet（断点见 §⑦响应式）。
 *
 * 后端现状：truth_ledger 无 HTTP 查询路由，本面板按 evidence_ref scheme 解析规则渲染，
 * 命中的"原始记录"是按契约手填的示例——面板本身诚实标注，不冒充真实回链。
 */

'use client';

import { X, Link2, AlertTriangle } from 'lucide-react';
import { colors } from '@/config/design-tokens';
import { AUTH_COLOR, AUTH_LABEL, resolveEvidenceRef } from '../lib/court-doc';

interface EvidenceChainPanelProps {
  open: boolean;
  evidenceRef: string | null;
  onClose: () => void;
}

export function EvidenceChainPanel({ open, evidenceRef, onClose }: EvidenceChainPanelProps) {
  if (!open) return null;

  const resolution = resolveEvidenceRef(evidenceRef);

  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-label="证据回链"
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[70vh] flex-col rounded-t-2xl border-t p-4 md:inset-y-0 md:right-0 md:left-auto md:h-full md:max-h-none md:w-[360px] md:rounded-t-none md:rounded-l-2xl md:border-t-0 md:border-l"
        style={{ background: colors.surface1, borderColor: colors.border }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 size={14} style={{ color: colors.goldBright }} />
            <span className="section-eyebrow">Evidence Chain · 证据回链</span>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 transition-colors hover:bg-white/5">
            <X size={14} style={{ color: colors.textDim }} />
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto">
          {resolution.kind === 'unresolvable' ? (
            <div
              className="flex items-start gap-2 rounded-lg border px-3 py-3 text-[12px] leading-5"
              style={{ borderColor: `${colors.textMuted}40`, color: colors.textMuted, background: `${colors.textMuted}0a` }}
            >
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>
                {resolution.raw === null
                  ? '待考 · 无可回链证据（evidence_ref 为空）'
                  : '证据回链断裂 · 标记待考并上报（scheme 无法解析）'}
              </span>
            </div>
          ) : resolution.kind === 'truth_ledger' ? (
            <TruthLedgerRecord caseId={resolution.caseId} auth={resolution.auth} raw={resolution.raw} />
          ) : resolution.kind === 'annals' ? (
            <AnnalsRecord period={resolution.period} raw={resolution.raw} />
          ) : (
            <FlywheelHealthRecord raw={resolution.raw} />
          )}
        </div>
      </aside>
    </>
  );
}

function TruthLedgerRecord({ caseId, auth, raw }: { caseId: string; auth: 'authenticated' | 'orphan' | 'unknown'; raw: string }) {
  const color = AUTH_COLOR[auth];
  return (
    <div className="space-y-3">
      <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: `${color}40`, background: `${color}0a` }}>
        <div className="flex items-center justify-between text-[11px]">
          <span style={{ color: colors.textDim }}>鉴权态</span>
          <span className="font-semibold" style={{ color }}>{AUTH_LABEL[auth]}</span>
        </div>
      </div>
      <div className="rounded-lg border px-3 py-2.5 text-[11px] leading-6" style={{ borderColor: colors.border, color: colors.textSecondary }}>
        <div><span style={{ color: colors.textFaint }}>case_id · </span>{caseId}</div>
        <div className="mt-1"><span style={{ color: colors.textFaint }}>truth_ledger raw · </span><span className="font-mono">{raw}</span></div>
      </div>
      {auth === 'orphan' && (
        <div className="rounded-lg border px-3 py-2 text-[11px] leading-5" style={{ borderColor: `${colors.danger}55`, background: `${colors.danger}0f`, color: colors.danger }}>
          疑似脏源，勿采信 —— 脏燃料不进护身符。
        </div>
      )}
    </div>
  );
}

function AnnalsRecord({ period, raw }: { period: string; raw: string }) {
  return (
    <div className="rounded-lg border px-3 py-2.5 text-[11px] leading-6" style={{ borderColor: colors.border, color: colors.textSecondary }}>
      <div><span style={{ color: colors.textFaint }}>编年体史册 · </span>{period}</div>
      <div className="mt-1"><span style={{ color: colors.textFaint }}>annals raw · </span><span className="font-mono">{raw}</span></div>
      <div className="mt-2 text-[10.5px]" style={{ color: colors.textFaint }}>纪事 + 附议 + 史评（待接 GET /api/scribe/annals 编年序）</div>
    </div>
  );
}

function FlywheelHealthRecord({ raw }: { raw: string }) {
  return (
    <div className="rounded-lg border px-3 py-2.5 text-[11px] leading-6" style={{ borderColor: colors.border, color: colors.textSecondary }}>
      <div>跳转到复盘飞轮看板对应信号。</div>
      <div className="mt-1"><span style={{ color: colors.textFaint }}>raw · </span><span className="font-mono">{raw}</span></div>
    </div>
  );
}

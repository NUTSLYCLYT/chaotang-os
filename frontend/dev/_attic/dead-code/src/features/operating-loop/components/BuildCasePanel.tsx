import { Archive, GitBranch, ShieldAlert } from 'lucide-react';
import {
  BUILD_LEDGER_STATUS_LABEL,
  assessBuildLedgerEntry,
  type BuildLedgerEntry,
} from '@/features/operating-loop/lib/build-ledger';
import { getBuildCaseActions, type BuildCaseAction } from '@/features/operating-loop/lib/build-case';
import { BuildLedgerBackendTrace, BuildLedgerObjectPassport } from './ObjectPassport';
import { ReleaseArchiveGate } from './ReleaseArchiveGate';

type BuildCasePanelTone = 'blue' | 'gold' | 'emerald';

interface BuildCasePanelProps {
  entry: BuildLedgerEntry;
  tone?: BuildCasePanelTone;
  compact?: boolean;
  primaryAction?: {
    label: string;
    pending?: boolean;
    onClick: () => void;
  };
}

function actionToneClass(action: BuildCaseAction) {
  if (action.tone === 'primary') return 'border-[#6BA0FF]/30 bg-[#6BA0FF]/10 text-[#B9D0FF]';
  if (action.tone === 'success') return 'border-emerald-400/24 bg-emerald-400/[0.08] text-emerald-100';
  if (action.tone === 'warning') return 'border-[#F0C66A]/28 bg-[#F0C66A]/[0.08] text-[#F5D891]';
  if (action.tone === 'danger') return 'border-[#F43F5E]/28 bg-[#F43F5E]/[0.08] text-[#FCA5A5]';
  return 'border-white/10 bg-white/[0.04] text-[#C8CDD8]';
}

export function BuildCasePanel({
  entry,
  tone = 'blue',
  compact = false,
  primaryAction,
}: BuildCasePanelProps) {
  const assessment = assessBuildLedgerEntry(entry);
  const actions = getBuildCaseActions(entry);
  const visibleEvidence = entry.evidence.slice(0, compact ? 3 : 5);
  const visibleAudit = (entry.auditTrail ?? []).slice(-3);

  return (
    <section aria-label={`建设案底座 ${entry.taskId}`} className="space-y-2.5">
      <BuildLedgerObjectPassport entry={entry} tone={tone} compact={compact} />
      <BuildLedgerBackendTrace entry={entry} compact={compact} />
      <ReleaseArchiveGate entry={entry} compact={compact} />

      <div className="rounded-lg border border-white/10 bg-black/15 px-3 py-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D9C79A]">
              <GitBranch size={12} />
              Build Case Actions · 建设案动作
            </div>
            <div className="mt-1 text-[12px] font-semibold text-[#F5E9C9]">
              状态 {BUILD_LEDGER_STATUS_LABEL[entry.status]} · 质量 {assessment.grade}
            </div>
          </div>
          <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-[#AAB4C4]">
            score {assessment.score}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {actions.map((action) => (
            <span
              key={action.id}
              title={action.reason}
              className={`rounded border px-2 py-1 text-[10.5px] ${actionToneClass(action)} ${action.disabled ? 'opacity-55' : ''}`}
            >
              {action.label}
            </span>
          ))}
        </div>

        {primaryAction ? (
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={primaryAction.pending}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#F0C66A]/35 bg-[#F0C66A]/10 px-3 py-2 text-[12px] text-[#F0C66A] transition hover:bg-[#F0C66A]/[0.16] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {primaryAction.pending ? '处理中…' : primaryAction.label}
          </button>
        ) : null}
      </div>

      <div className="rounded-lg border border-white/10 bg-black/15 px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D9C79A]">
          <Archive size={12} />
          Evidence · 证据
        </div>
        {visibleEvidence.length > 0 ? (
          <div className="mt-2 grid gap-1.5">
            {visibleEvidence.map((item) => (
              <div key={item} className="rounded border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[10.5px] leading-4 text-[#AAB4C4]">
                {item}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 flex items-start gap-2 rounded border border-[#F43F5E]/18 bg-[#F43F5E]/[0.055] px-2 py-1.5 text-[10.5px] leading-4 text-[#FCA5A5]">
            <ShieldAlert size={12} className="mt-0.5 shrink-0" />
            没有证据，不允许状态迁移。
          </div>
        )}
      </div>

      {visibleAudit.length > 0 ? (
        <div className="rounded-lg border border-white/10 bg-black/15 px-3 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D9C79A]">
            Audit Trail · 审计
          </div>
          <div className="mt-2 grid gap-1.5">
            {visibleAudit.map((event) => (
              <div key={event.id} className="text-[10.5px] leading-4 text-[#AAB4C4]">
                {new Date(event.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} · {event.actor} · {event.note}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

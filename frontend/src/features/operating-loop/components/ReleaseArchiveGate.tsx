import {
  assessBuildLedgerEntry,
  type BuildLedgerEntry,
} from '@/features/operating-loop/lib/build-ledger';
import { nextOwnerForBuildLedger } from './ObjectPassport';

interface ReleaseArchiveGateProps {
  entry: BuildLedgerEntry;
  compact?: boolean;
}

export function isBuildLedgerArchiveGatePassed(entry: BuildLedgerEntry) {
  const assessment = assessBuildLedgerEntry(entry);
  return assessment.riskLevel === 'low' && entry.evidence.length > 0;
}

export function getBuildLedgerArchiveGateIssues(entry: BuildLedgerEntry) {
  const assessment = assessBuildLedgerEntry(entry);
  const issues = [...assessment.riskNotes];
  if (entry.evidence.length === 0) issues.push('归档前必须有至少 1 条证据');
  return Array.from(new Set(issues));
}

export function ReleaseArchiveGate({ entry, compact = false }: ReleaseArchiveGateProps) {
  const assessment = assessBuildLedgerEntry(entry);
  const passed = isBuildLedgerArchiveGatePassed(entry);
  const issues = getBuildLedgerArchiveGateIssues(entry);
  const owner = nextOwnerForBuildLedger(entry);
  const reusePoint = passed
    ? '史馆复盘后反哺上书房召回'
    : '先补齐 QA issue，再进入史馆复盘';

  return (
    <section
      aria-label={`发布归档双闸 ${entry.taskId}`}
      className={`rounded-lg border ${
        passed
          ? 'border-emerald-400/22 bg-emerald-400/[0.055]'
          : 'border-rose-400/24 bg-rose-400/[0.07]'
      } ${compact ? 'px-2.5 py-2' : 'px-3 py-2.5'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D9C79A]">
            Release / Archive Gate · 发布/归档双闸
          </div>
          <div className="mt-1 text-[12px] font-semibold text-[#F5E9C9]">
            {passed ? '可归档 · 不等于可对外发布' : '禁止归档 · 先补 QA issue'}
          </div>
        </div>
        <span
          className={`shrink-0 rounded border px-2 py-0.5 text-[10px] ${
            passed
              ? 'border-emerald-400/24 bg-emerald-400/[0.08] text-emerald-100'
              : 'border-rose-400/28 bg-rose-400/[0.09] text-rose-100'
          }`}
        >
          {passed ? 'QA pass' : 'QA fail'}
        </span>
      </div>
      <div className="mt-2 grid gap-1.5 text-[10.5px] leading-4 text-[#AAB4C4]">
        <div className="grid grid-cols-2 gap-1.5">
          <span className="rounded border border-white/10 bg-black/15 px-2 py-1">
            证据 {entry.evidence.length} 条
          </span>
          <span className="rounded border border-white/10 bg-black/15 px-2 py-1">
            负责人 {owner}
          </span>
        </div>
        <div className="rounded border border-white/10 bg-black/15 px-2 py-1">
          复用点 {reusePoint}
        </div>
        <div className={passed ? 'text-emerald-100/80' : 'text-rose-100/85'}>
          {passed
            ? `QA：${assessment.grade} · ${assessment.nextSuggestion}`
            : `阻断：${issues.join('、')}`}
        </div>
        <div className="text-[#7D88A4]">
          完成数只代表执行结束；归档需通过双闸，对外发布仍需负责人审签。
        </div>
      </div>
    </section>
  );
}

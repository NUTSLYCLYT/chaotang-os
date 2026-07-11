import { BUILD_LEDGER_STATUS_LABEL, assessBuildLedgerEntry, type BuildLedgerEntry } from '@/features/operating-loop/lib/build-ledger';

function buildCaseStatusTone(status: BuildLedgerEntry['status']) {
  if (status === 'archived') return '#3DD68C';
  if (status === 'returned') return '#FB923C';
  if (status === 'reviewing') return '#7EC8E3';
  return '#F0C66A';
}

function buildCasePrimaryHref(entry: BuildLedgerEntry): string {
  const params = new URLSearchParams({ from: 'study', taskId: entry.taskId });
  if (entry.status === 'archived') return `/shiguan?${params.toString()}`;
  if (entry.status === 'returned') return `/departments?${params.toString()}`;
  return `/command-center?${params.toString()}`;
}

function buildCasePrimaryLabel(status: BuildLedgerEntry['status']): string {
  if (status === 'archived') return '去史馆';
  if (status === 'returned') return '去六部补证';
  if (status === 'reviewing') return '去军机处';
  return '交军机处';
}

export function BuildCaseBriefingPanel({
  entries,
  onApply,
}: {
  entries: BuildLedgerEntry[];
  onApply: (entry: BuildLedgerEntry) => void;
}) {
  const visible = entries.slice(0, 3);
  if (visible.length === 0) return null;

  return (
    <section
      data-testid="build-case-briefing"
      aria-label="建设案待办"
      className="mt-2 rounded-xl border border-[#6BA0FF]/20 bg-[#08101F]/72 px-3 py-2.5 shadow-[0_18px_48px_rgba(0,0,0,0.24)]"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8F98B8]">
            Build Ledger · 工部建设案
          </div>
          <h2 className="mt-0.5 text-[13px] font-semibold text-[#F5E9C9]" style={{ fontFamily: 'var(--font-serif)' }}>
            建设案待办
          </h2>
        </div>
        <span className="rounded-full border border-[#6BA0FF]/28 bg-[#6BA0FF]/10 px-2 py-0.5 text-[10px] text-[#B9D0FF]">
          {visible.length} 件回流上书房
        </span>
      </div>

      <div className="grid gap-2 xl:grid-cols-3">
        {visible.map((entry) => {
          const assessment = assessBuildLedgerEntry(entry);
          const tone = buildCaseStatusTone(entry.status);
          return (
            <article
              key={entry.id}
              className="min-h-[148px] rounded-lg border bg-black/18 px-3 py-2.5"
              style={{ borderColor: `${tone}33` }}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className="rounded border px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ borderColor: `${tone}4D`, background: `${tone}14`, color: tone }}
                >
                  {BUILD_LEDGER_STATUS_LABEL[entry.status]}
                </span>
                <span className="rounded border border-white/10 bg-white/[0.035] px-1.5 py-0.5 text-[10px] text-[#AAB4C4]">
                  质量 {assessment.grade}
                </span>
              </div>

              <h3 className="mt-2 line-clamp-2 text-[13px] font-semibold leading-5 text-[#EAEEFB]" style={{ fontFamily: 'var(--font-serif)' }}>
                {entry.title}
              </h3>
              <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-[#9DA8C5]">
                {entry.suggestion ?? assessment.nextSuggestion}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-[#8F98B8]">
                <span>证据 {entry.evidence.length} 条</span>
                <span>部门 {entry.ministers.slice(0, 3).join('、') || '待分派'}</span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a
                  href={buildCasePrimaryHref(entry)}
                  className="inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-[11px] font-semibold transition hover:brightness-110"
                  style={{ borderColor: `${tone}55`, background: `${tone}12`, color: tone }}
                >
                  {buildCasePrimaryLabel(entry.status)}
                </a>
                <a
                  href={`/departments?from=study&taskId=${encodeURIComponent(entry.taskId)}`}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-[#C8CDD8] transition hover:border-[#6BA0FF]/35 hover:text-[#B9D0FF]"
                >
                  看六部
                </a>
                <button
                  type="button"
                  onClick={() => onApply(entry)}
                  className="rounded-full border border-[#F0C66A]/28 bg-[#F0C66A]/[0.07] px-3 py-1.5 text-[11px] font-semibold text-[#F0C66A] transition hover:bg-[#F0C66A]/[0.14]"
                >
                  带入下旨
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

import {
  BUILD_LEDGER_STATUS_LABEL,
  type BuildLedgerEntry,
} from '@/features/operating-loop/lib/build-ledger';

type PassportTone = 'gold' | 'blue' | 'emerald';

interface ObjectPassportProps {
  objectId: string;
  title: string;
  statusLabel: string;
  sourceLabel: string;
  evidenceCount: number;
  nextOwner: string;
  updatedAt?: string | null;
  tone?: PassportTone;
  compact?: boolean;
}

const toneClass: Record<PassportTone, {
  border: string;
  bg: string;
  text: string;
  chip: string;
}> = {
  gold: {
    border: 'border-[#F0C66A]/22',
    bg: 'bg-[#F0C66A]/[0.055]',
    text: 'text-[#F0C66A]',
    chip: 'border-[#F0C66A]/24 bg-[#F0C66A]/[0.07] text-[#F5D891]',
  },
  blue: {
    border: 'border-[#6BA0FF]/24',
    bg: 'bg-[#6BA0FF]/[0.055]',
    text: 'text-[#9FC1FF]',
    chip: 'border-[#6BA0FF]/24 bg-[#6BA0FF]/[0.07] text-[#B9D0FF]',
  },
  emerald: {
    border: 'border-emerald-400/22',
    bg: 'bg-emerald-400/[0.055]',
    text: 'text-emerald-100',
    chip: 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-100',
  },
};

function formatTime(value?: string | null) {
  if (!value) return '待记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '待记录';
  return date.toLocaleString('zh-CN');
}

export function nextOwnerForBuildLedger(entry: BuildLedgerEntry) {
  if (entry.status === 'returned') return '工部补证';
  if (entry.status === 'archived') return '上书房召回';
  if (entry.status === 'reviewing') return '史馆复盘';
  return '军机处复核';
}

export function ObjectPassport({
  objectId,
  title,
  statusLabel,
  sourceLabel,
  evidenceCount,
  nextOwner,
  updatedAt,
  tone = 'gold',
  compact = false,
}: ObjectPassportProps) {
  const classes = toneClass[tone];

  return (
    <section
      aria-label={`对象护照 ${objectId}`}
      className={`rounded-lg border ${classes.border} ${classes.bg} ${compact ? 'px-2.5 py-2' : 'px-3 py-2.5'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${classes.text}`}>
            Object Passport · 对象护照
          </div>
          <div className="mt-1 truncate text-[12px] font-semibold text-[#F5E9C9]">
            {title}
          </div>
        </div>
        <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] ${classes.chip}`}>
          {statusLabel}
        </span>
      </div>
      <div className="mt-2 grid gap-1.5 text-[10.5px] leading-4 text-[#AAB4C4]">
        <div className="truncate font-mono text-[#D9C79A]">objectId: {objectId}</div>
        <div className="grid grid-cols-2 gap-1.5">
          <span className="rounded border border-white/10 bg-black/15 px-2 py-1">
            证据 {evidenceCount} 条
          </span>
          <span className="rounded border border-white/10 bg-black/15 px-2 py-1">
            下一责任 {nextOwner}
          </span>
        </div>
        <div className="truncate text-[#7D88A4]">
          来源 {sourceLabel} · 更新时间 {formatTime(updatedAt)}
        </div>
      </div>
    </section>
  );
}

export function BuildLedgerObjectPassport({
  entry,
  tone = 'gold',
  compact,
}: {
  entry: BuildLedgerEntry;
  tone?: PassportTone;
  compact?: boolean;
}) {
  return (
    <ObjectPassport
      objectId={entry.taskId}
      title={entry.title}
      statusLabel={BUILD_LEDGER_STATUS_LABEL[entry.status]}
      sourceLabel={entry.source ?? 'Build Ledger'}
      evidenceCount={entry.evidence.length}
      nextOwner={nextOwnerForBuildLedger(entry)}
      updatedAt={entry.updatedAt ?? entry.createdAt}
      tone={tone}
      compact={compact}
    />
  );
}

function releaseGateLabel(value?: string | null) {
  if (value === 'clear') return 'QA clear';
  if (value === 'blocked') return 'QA blocked';
  if (value === 'pending') return 'QA pending';
  return 'QA unknown';
}

export function BuildLedgerBackendTrace({
  entry,
  compact = false,
}: {
  entry: BuildLedgerEntry;
  compact?: boolean;
}) {
  if (!entry.jiqunSessionId && !entry.jiqunTaskId && !entry.jiqunEntrySwarm && !entry.releaseGate) return null;

  return (
    <section
      aria-label={`jiqun 后端会话 ${entry.taskId}`}
      className={`rounded-lg border border-[#6BA0FF]/20 bg-[#6BA0FF]/[0.055] ${compact ? 'px-2.5 py-2' : 'px-3 py-2.5'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9FC1FF]">
          Jiqun Session · 后端蜂群
        </div>
        <span className="rounded border border-[#6BA0FF]/24 bg-[#6BA0FF]/10 px-2 py-0.5 text-[10px] text-[#B9D0FF]">
          {releaseGateLabel(entry.releaseGate)}
        </span>
      </div>
      <div className="mt-2 grid gap-1.5 text-[10.5px] leading-4 text-[#AAB4C4]">
        {entry.jiqunSessionId ? (
          <div className="truncate font-mono text-[#D9C79A]">jiqunSessionId: {entry.jiqunSessionId}</div>
        ) : null}
        <div className="grid grid-cols-2 gap-1.5">
          <span className="truncate rounded border border-white/10 bg-black/15 px-2 py-1">
            task {entry.jiqunTaskId ?? 'pending'}
          </span>
          <span className="truncate rounded border border-white/10 bg-black/15 px-2 py-1">
            swarm {entry.jiqunEntrySwarm ?? 'sdlc'}
          </span>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";

interface RetrospectiveControlProps {
  archiveId: string;
  status: string | undefined;
  onUpdate: (archiveId: string, status: string) => Promise<void>;
}

function statusBadgeClass(s: string | undefined): string {
  if (!s || s === 'not_started') return 'border-slatey-400/35 bg-slatey-400/10 text-slatey-300';
  if (s === '达成') return 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200';
  if (s === '未达成') return 'border-red-400/35 bg-red-400/10 text-red-200';
  if (s === '部分') return 'border-amber-400/35 bg-amber-400/10 text-amber-200';
  return 'border-slatey-400/35 bg-slatey-400/10 text-slatey-300';
}

function statusLabel(s: string | undefined): string {
  if (!s || s === 'not_started') return '未回填';
  return s;
}

const OUTCOME_OPTIONS = ['达成', '未达成', '部分'] as const;

export function RetrospectiveControl({ archiveId, status, onUpdate }: RetrospectiveControlProps) {
  const [busy, setBusy] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const handleClick = async (newStatus: string) => {
    if (busy) return;
    setBusy(true);
    setInlineError(null);
    try {
      await onUpdate(archiveId, newStatus);
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : '更新失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-1 space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        <span className={`rounded border px-1.5 py-0.5 text-[10px] leading-none ${statusBadgeClass(status)}`}>
          {statusLabel(status)}
        </span>
        {OUTCOME_OPTIONS.map((o) => (
          <button
            key={o}
            type="button"
            disabled={busy}
            onClick={() => void handleClick(o)}
            className={`rounded border px-1.5 py-0.5 text-[10px] leading-none transition
              ${status === o
                ? 'border-gold-300/50 bg-gold-300/12 text-gold-100'
                : 'border-white/12 bg-white/[0.04] text-slatey-400 hover:text-slatey-200 hover:border-white/25 disabled:opacity-40'
              }`}
          >
            {busy && status === o ? '…' : o}
          </button>
        ))}
        {busy && <span className="text-[10px] text-slatey-400">保存中…</span>}
      </div>
      {inlineError && (
        <p className="text-[10px] text-red-300">{inlineError}</p>
      )}
    </div>
  );
}

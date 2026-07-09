'use client';

import { useState } from 'react';
import type { JunjichuPageView } from '../model/types';

type VerdictAction = 'adopt' | 'request_evidence' | 'recheck' | 'reject' | 'followup';

export function VerdictActionBar({
  view,
  onDecision,
}: {
  view: JunjichuPageView;
  onDecision?: (action: VerdictAction, reason: string) => Promise<void> | void;
}) {
  const [pending, setPending] = useState<VerdictAction | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const rows: Array<{ action: VerdictAction; state: JunjichuPageView['actions'][keyof JunjichuPageView['actions']] }> = [
    { action: 'adopt', state: view.actions.adopt },
    { action: 'request_evidence', state: view.actions.requestEvidence },
    { action: 'recheck', state: view.actions.recheck },
    { action: 'reject', state: view.actions.reject },
    { action: 'followup', state: view.actions.followup },
  ];

  async function submit(action: VerdictAction, label: string) {
    if (!onDecision) return;
    const reason = `军机处${label}：阶段=${view.stage}；质量门=${view.gate.status}；案=${view.caseIdentity.title}`;
    setPending(action);
    setFeedback(null);
    try {
      await onDecision(action, reason);
      setFeedback(`${label}已提交`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : `${label}提交失败`);
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="rounded-[8px] border border-[#F0C66A]/24 bg-black/28 px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F0C66A]">五键裁决</div>
        <div className="text-[10px] text-[#9AA3C4]">{view.decision.note}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {rows.map(({ action, state }) => (
          <button
            key={action}
            type="button"
            disabled={!state.enabled || Boolean(pending)}
            title={state.disabledReason}
            onClick={() => void submit(action, state.label)}
            className="min-h-9 rounded-md border border-[#F0C66A]/28 bg-[#F0C66A]/[0.07] px-2 text-[11px] font-semibold text-[#F5E9C9] transition hover:bg-[#F0C66A]/[0.12] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {pending === action ? '提交中' : state.label}
          </button>
        ))}
      </div>
      {feedback && <div className="mt-2 text-[11px] text-[#B9F6D2]">{feedback}</div>}
    </section>
  );
}

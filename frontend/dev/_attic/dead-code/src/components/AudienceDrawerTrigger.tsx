'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

interface Props {
  swarmId: string;
  swarmName: string;
  onSent?: () => void;
}

export function AudienceDrawerTrigger({ swarmId, swarmName, onSent }: Props) {
  const [open, setOpen] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!instructions.trim()) return;
    setSending(true);
    try {
      await api.post(`/swarms/${swarmId}/commands`, {
        taskId: 'audience-' + Date.now(),
        taskTitle: '觐见: ' + swarmName,
        instructions: instructions.trim(),
        actor: '皇帝',
      });
      setInstructions('');
      setOpen(false);
      onSent?.();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(v => !v);
        }}
        className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs hover:bg-neutral-800 transition-colors"
      >
        ⚑ 召见
      </button>

      {open && (
        <div
          className="absolute z-40 right-0 top-full mt-1 w-72 bg-neutral-900 border border-neutral-700 rounded-xl p-4"
          onClick={e => e.stopPropagation()}
        >
          <p className="text-xs font-semibold mb-3">{swarmName} 觐见</p>
          <form onSubmit={e => void submit(e)} className="flex flex-col gap-3">
            <textarea
              rows={3}
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              placeholder="发令内容…"
              className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-amber-600 resize-none"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={sending || !instructions.trim()}
                className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold hover:bg-amber-600 disabled:opacity-40 transition-colors"
              >
                {sending ? '…' : '发令'}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800 transition-colors"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 只需要 id+name 即可；接受 DeptStatus / SwarmUnit / 任意 {id,name} 子集 */
  swarms: ReadonlyArray<{ id: string; name: string }>;
  onSent?: () => void;
}

export function ProfessionalEntryDrawer({ open, onClose, swarms, onSent }: Props) {
  const [selectedSwarmId, setSelectedSwarmId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [sending, setSending] = useState(false);

  const effectiveSwarmId = selectedSwarmId || swarms[0]?.id || '';

  async function submit() {
    if (!effectiveSwarmId || !taskTitle.trim() || !instructions.trim()) return;
    setSending(true);
    try {
      await api.post(`/swarms/${effectiveSwarmId}/commands`, {
        taskId: 'cmd-' + Date.now(),
        taskTitle: taskTitle.trim(),
        instructions: instructions.trim(),
        actor: '皇帝',
      });
      setTaskTitle('');
      setInstructions('');
      onClose();
      onSent?.();
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="flex-1 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="w-96 max-w-full bg-neutral-900 border-l border-neutral-700 flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-700">
          <h2 className="text-sm font-semibold">专业入口 · 下达调度</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-100 text-lg leading-none">
            ×
          </button>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-4 px-6 py-5 flex-1">
          {/* Swarm selector */}
          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block">目标蜂群</label>
            <select
              value={selectedSwarmId || swarms[0]?.id || ''}
              onChange={e => setSelectedSwarmId(e.target.value)}
              className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-amber-600"
            >
              {swarms.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Task title */}
          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block">任务名称</label>
            <input
              value={taskTitle}
              onChange={e => setTaskTitle(e.target.value)}
              placeholder="任务名称"
              className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-amber-600"
            />
          </div>

          {/* Instructions */}
          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block">详细指令</label>
            <textarea
              rows={5}
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              placeholder="详细指令…"
              className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-amber-600 resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-neutral-700">
          <button
            onClick={() => void submit()}
            disabled={sending || !effectiveSwarmId || !taskTitle.trim() || !instructions.trim()}
            className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold hover:bg-amber-600 disabled:opacity-40 transition-colors"
          >
            {sending ? '…' : '下达'}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

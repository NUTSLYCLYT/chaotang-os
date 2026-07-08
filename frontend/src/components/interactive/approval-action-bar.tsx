/**
 * ApprovalActionBar — 御前批示操作栏
 *
 * 3 按钮：准奏 / 追问 / 驳回
 * 可选附言输入
 */

'use client';

import { useState } from 'react';
import { Check, X, MessageCircleQuestion, Loader2 } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';

export type ApprovalAction = 'approve' | 'inquire' | 'reject';

export interface ApprovalActionBarProps {
  taskId: string;
  disabled?: boolean;
  /** 可选：提交后的状态反馈 */
  pendingAction?: ApprovalAction | null;
  onApprove: (comment: string) => void;
  onInquire: (comment: string) => void;
  onReject: (comment: string) => void;
}

export function ApprovalActionBar({
  taskId,
  disabled,
  pendingAction,
  onApprove,
  onInquire,
  onReject,
}: ApprovalActionBarProps) {
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);

  const submit = (action: ApprovalAction) => {
    const c = comment.trim();
    if (action === 'approve') onApprove(c);
    if (action === 'inquire') onInquire(c);
    if (action === 'reject') onReject(c);
  };

  return (
    <GlassPanel variant="gold" tone="elevated" padding="md">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#6A7299]">
            Imperial Review
          </div>
          <h3 className="mt-0.5 text-[13px] font-medium text-[#F0C66A]">御前批示</h3>
        </div>
        <button
          type="button"
          onClick={() => setShowComment(!showComment)}
          className="text-[10px] text-[#9AA3C4] hover:text-[#F0C66A]"
        >
          {showComment ? '收起附言' : '亲笔附言'}
        </button>
      </div>

      {showComment && (
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder="陛下亲笔..."
          className="mt-3 w-full resize-none rounded-md border bg-transparent p-2 text-[11px] outline-none placeholder:text-[#484F72]"
          style={{
            borderColor: 'rgba(240, 198, 106, 0.3)',
            color: '#EAEEFB',
          }}
        />
      )}

      <div className="mt-3 flex gap-2">
        <ActionBtn
          Icon={Check}
          label="准奏"
          color="#3DD68C"
          pending={pendingAction === 'approve'}
          disabled={disabled || !!pendingAction}
          onClick={() => submit('approve')}
        />
        <ActionBtn
          Icon={MessageCircleQuestion}
          label="追问"
          color="#F0C66A"
          pending={pendingAction === 'inquire'}
          disabled={disabled || !!pendingAction}
          onClick={() => submit('inquire')}
        />
        <ActionBtn
          Icon={X}
          label="驳回"
          color="#F43F5E"
          pending={pendingAction === 'reject'}
          disabled={disabled || !!pendingAction}
          onClick={() => submit('reject')}
        />
      </div>

      <div className="mt-2 text-[9px] text-[#484F72]">
        任务 {taskId.slice(0, 16)} · 批示后任务将由史官归档
      </div>
    </GlassPanel>
  );
}

function ActionBtn({
  Icon,
  label,
  color,
  pending,
  disabled,
  onClick,
}: {
  Icon: typeof Check;
  label: string;
  color: string;
  pending: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-[12px] font-medium transition-all hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        borderColor: `${color}55`,
        backgroundColor: `${color}10`,
        color,
      }}
    >
      {pending ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
      {label}
    </button>
  );
}

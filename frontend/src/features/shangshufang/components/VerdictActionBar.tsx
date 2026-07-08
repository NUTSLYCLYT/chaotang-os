'use client';

import { AlertTriangle, ClipboardCheck, Gavel, MessageSquareText, ShieldCheck } from 'lucide-react';
import { ImperialButton } from './atoms';

/**
 * 朱批·五键决策动作 —— 上书房唯一真相源(SSOT)。
 * PRD §3/§6：老板对当前决策的五个拍板动作，中栏决策卡页脚与对话抽屉右侧共用这一套，
 * 禁止各分支(奏折/丞相建议)各自维护平行按钮组(铁律3 合并即清理)。
 */
export type VerdictAction = 'adopt' | 'supplement' | 'review' | 'reject' | 'followup';

const ACTIONS: Array<{ key: VerdictAction; label: string; icon: typeof Gavel }> = [
  { key: 'adopt', label: '采纳', icon: Gavel },
  { key: 'supplement', label: '补证', icon: ClipboardCheck },
  { key: 'review', label: '复核', icon: ShieldCheck },
  { key: 'reject', label: '驳回', icon: AlertTriangle },
  { key: 'followup', label: '追问', icon: MessageSquareText },
];

const GOLD_BTN =
  '!border !border-[#8a6a2a]/55 !bg-[#fff3c9]/90 !text-[#251806] text-[13px] font-bold tracking-[0] shadow-[inset_0_1px_0_rgba(255,250,235,0.76),0_5px_14px_rgba(58,33,8,0.14)] hover:!bg-[#ffe6a3] hover:!text-[#1b1306]';

interface VerdictActionBarProps {
  onAction: (action: VerdictAction) => void;
  disabled?: boolean;
  hint?: string;
}

export function VerdictActionBar({ onAction, disabled = false, hint }: VerdictActionBarProps) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      {hint ? (
        <span className="text-[11px] tracking-[0.1em]" style={{ color: '#8a7a52', fontFamily: 'var(--font-serif)' }}>
          {hint}
        </span>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {ACTIONS.map(({ key, label, icon: Icon }) => (
          <ImperialButton
            key={key}
            variant="gold"
            size="sm"
            serif
            disabled={disabled}
            icon={<Icon size={13} />}
            onClick={() => onAction(key)}
            className={GOLD_BTN}
          >
            {label}
          </ImperialButton>
        ))}
      </div>
    </div>
  );
}
